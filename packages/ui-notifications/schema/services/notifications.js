// Custom service: in-app notifications (the bell), with optional immediate email.
//
// Paste as the body of a custom service named `notifications` (the hooks and the digest call it by
// that name). The DaaS compiles this as a function body with one parameter, `context`, and keeps the
// object it returns. It uses only `context.services.items`, `.mail` and `.env`.
//
//   notify(rows)               create (or merge into) notification rows; returns { created, merged, skipped, ids }
//   audience(ids, actorId)     unique, lower-case ids without the actor (who never notifies themself)
//   markEmailed(ids)           set emailed_at on these rows; returns how many
//
// A row is { recipient? | recipient_email?, type, title, message?, link?, actor?, actor_name?,
//            source_collection?, source_id?, dedupe_key?, merge?, subject?, emailed? }.
//   recipient        a user id. recipient_email: a person without an account (digest email only);
//                    an address that belongs to a user is turned into that user's id.
//   link             app-relative deep link ("/tickets/T1?comment=C9"). Anything else (javascript:,
//                    https://…, //host, /\host) is stored as null: a notification only leads inside the app.
//   dedupe_key       at most one row ever exists per key (a re-run, a retried hook: no second row). It is
//                    checked first: a known key is skipped even when the row would merge.
//   emailed          true: the caller has already emailed this person about it (comment_mail.js does).
//                    The row is stored with emailed_at set, so the digest leaves it out, and no immediate
//                    email is sent for it. It merges only into rows that were emailed as well.
//   merge            true (or a plural noun such as "replies"): fold into the recipient's unread,
//                    un-emailed row (emailed, for an emailed: true row) of the same type and source
//                    instead of adding one. The title becomes "3 new replies on <subject>" and the row moves to the top.
//
// Nothing here ever throws: a notification problem must not undo the change that caused it. Failures
// are logged with ids only (no titles, no messages, no addresses).

const CONFIG = {
  collection: 'notifications',
  // Optional per-person email preference (email_mode: 'immediate' | 'digest' | 'off'). Set to null
  // when you do not create that collection.
  prefsCollection: 'notification_prefs',
  usersCollection: 'daas_users',
  appName: 'Acme',
  // Used when the APP_URL runtime env var is not exposed to services. No trailing slash.
  appUrl: 'https://app.example.com',
  // Types emailed at once (one email per row). Every other type waits for the daily digest.
  immediateTypes: [],
  // Types that merge by default (a row may still pass merge: true for any type).
  mergeTypes: ['reply'],
  // The plural noun in a merged title, per type: "3 new replies on …".
  mergeNouns: { reply: 'replies', comment: 'comments' },
  // At most this many people are notified by one notify() call; the rest are skipped (and logged).
  maxRecipients: 50,
  // Addresses that cannot receive mail (like comment_mail.js): no email, and an email-only row is skipped.
  denyDomains: ['daas.internal', 'example.com', 'example.org', 'example.net'],
  denyTlds: ['.test', '.invalid', '.localhost', '.example'],
};

// ── helpers ─────────────────────────────────────────────────────────────

const services = context.services;
const env = context.env || services.env || {};

const esc = (value) =>
  String(value == null ? '' : value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

const lower = (value) => (value == null || value === '' ? null : String(value).trim().toLowerCase() || null);
const clip = (text, max) => {
  const s = String(text == null ? '' : text);
  return s.length > max ? s.slice(0, max - 1).trimEnd() + '…' : s;
};
const errMsg = (error) => String((error && error.message) || error).slice(0, 200);
// Same rule as isAppRelativeLink in the UI (src/shared.tsx): one leading '/', not '//' or '/\',
// no backslash or control characters anywhere.
// eslint-disable-next-line no-control-regex
const appLink = (link) => (typeof link === 'string' && /^\/(?![\/\\])/.test(link) && !/[\\\u0000-\u001f\u007f]/.test(link) ? link : null);
const appUrl = () => String(env.APP_URL || CONFIG.appUrl || '').replace(/\/+$/, '');

function undeliverable(email) {
  const address = String(email || '').trim().toLowerCase();
  const at = address.lastIndexOf('@');
  if (at < 1) return true;
  const domain = address.slice(at + 1);
  if (!domain || domain.indexOf('.') === -1) return true;
  if (address.startsWith('servicerole@')) return true;
  if (CONFIG.denyDomains.indexOf(domain) !== -1) return true;
  return CONFIG.denyTlds.some((tld) => domain.endsWith(tld));
}

/** A unique-constraint violation (Postgres 23505), however the driver words it. */
const isUniqueViolation = (error) =>
  !!error &&
  (String(error.code) === '23505' ||
    /23505|unique|duplicate/i.test(String(error.message || '')) ||
    (error.extensions && String(error.extensions.code) === 'RECORD_NOT_UNIQUE'));

const itemsOf = (collection) => services.items(collection, { elevated: true });

function countedTitle(previous, noun, subject) {
  const m = /^(\d+) new /.exec(String(previous || ''));
  const n = m ? Number(m[1]) + 1 : 2;
  return clip(n + ' new ' + noun + (subject ? ' on ' + subject : ''), 200);
}

async function readUsers(filter) {
  const items = await itemsOf(CONFIG.usersCollection);
  return (await items.readByQuery({ filter, fields: ['id', 'email', 'status'], limit: -1 })) || [];
}

async function readPrefs(userIds) {
  const map = new Map();
  if (!CONFIG.prefsCollection || userIds.length === 0) return map;
  try {
    const items = await itemsOf(CONFIG.prefsCollection);
    const rows = await items.readByQuery({ filter: { user: { _in: userIds } }, fields: ['user', 'email_mode'], limit: -1 });
    for (const p of rows || []) map.set(lower(p.user), p.email_mode);
  } catch (error) {
    // No prefs collection, or it cannot be read: treat everyone as the default.
    console.error('notifications: prefs not read:', errMsg(error));
  }
  return map;
}

/** Send one immediate email. Returns true when sent; never throws. */
async function sendNow(to, row) {
  try {
    const link = row.link ? appUrl() + row.link : appUrl();
    const text = [row.title, '', row.message || '', '', 'Open: ' + link].join('\n');
    const html =
      '<div style="font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:1.5;color:#1f2328">' +
      '<p style="margin:0 0 12px"><strong>' + esc(row.title) + '</strong></p>' +
      (row.message ? '<p style="margin:0 0 16px">' + esc(row.message).replace(/\n/g, '<br>') + '</p>' : '') +
      '<p style="margin:0 0 16px"><a href="' + esc(link) + '">Open</a></p>' +
      '<p style="margin:16px 0 0;color:#8c959f;font-size:12px">' + esc(CONFIG.appName) + '</p></div>';
    const result = await services.mail({ to, subject: clip(row.title, 200), text, html });
    if (result && result.success === false) {
      console.error('notifications: immediate email not sent for', row.id);
      return false;
    }
    return true;
  } catch (error) {
    console.error('notifications: immediate email failed for', row.id, errMsg(error));
    return false;
  }
}

function sourceFilter(row) {
  const f = [
    { type: { _eq: row.type } },
    { read_at: { _null: true } },
    // An already-emailed row folds only into rows that were emailed too, so it never hides an
    // un-emailed reply from the digest, and an emailed one never reaches the digest a second time.
    row.emailed ? { emailed_at: { _nnull: true } } : { emailed_at: { _null: true } },
    row.source_collection ? { source_collection: { _eq: row.source_collection } } : { source_collection: { _null: true } },
    row.source_id ? { source_id: { _eq: row.source_id } } : { source_id: { _null: true } },
  ];
  f.push(row.recipient ? { recipient: { _eq: row.recipient } } : { recipient_email: { _eq: row.recipient_email } });
  return { _and: f };
}

// ── the API ─────────────────────────────────────────────────────────────

async function markEmailed(ids) {
  const list = (Array.isArray(ids) ? ids : [ids]).filter(Boolean);
  if (list.length === 0) return 0;
  try {
    const items = await itemsOf(CONFIG.collection);
    await items.updateMany(list, { emailed_at: new Date().toISOString() });
    return list.length;
  } catch (error) {
    console.error('notifications: markEmailed failed for', list.join(','), errMsg(error));
    return 0;
  }
}

function audience(ids, actorId) {
  const actor = lower(actorId);
  const seen = new Set();
  const out = [];
  for (const raw of Array.isArray(ids) ? ids : [ids]) {
    const id = lower(raw && typeof raw === 'object' ? raw.id : raw);
    if (!id || id === actor || seen.has(id)) continue;
    seen.add(id);
    out.push(id);
  }
  return out;
}

async function notify(input) {
  const result = { created: 0, merged: 0, skipped: 0, ids: [] };
  try {
    const list = (Array.isArray(input) ? input : [input]).filter((r) => r && typeof r === 'object');

    // 1. Normalise, drop rows without a recipient or a type, and drop self-notifications.
    const rows = [];
    for (const r of list) {
      const row = {
        recipient: lower(r.recipient && typeof r.recipient === 'object' ? r.recipient.id : r.recipient),
        recipient_email: r.recipient ? null : lower(r.recipient_email),
        type: r.type ? String(r.type) : null,
        title: clip(r.title || '', 200),
        message: r.message == null ? null : clip(r.message, 2000),
        link: appLink(r.link),
        actor: lower(r.actor && typeof r.actor === 'object' ? r.actor.id : r.actor),
        actor_name: r.actor_name ? clip(r.actor_name, 120) : null,
        source_collection: r.source_collection ? String(r.source_collection) : null,
        source_id: r.source_id == null || r.source_id === '' ? null : String(r.source_id),
        dedupe_key: r.dedupe_key ? clip(r.dedupe_key, 200) : null,
        emailed: r.emailed === true,
        merge: r.merge,
        subject: r.subject ? String(r.subject) : null,
      };
      if (!row.type || (!row.recipient && !row.recipient_email)) {
        result.skipped += 1;
        continue;
      }
      rows.push(row);
    }
    if (rows.length === 0) return result;

    // 2. Resolve people: ids to users, addresses to users when they have an account.
    const ids = Array.from(new Set(rows.filter((r) => r.recipient).map((r) => r.recipient)));
    const emails = Array.from(new Set(rows.filter((r) => r.recipient_email).map((r) => r.recipient_email)));
    const byId = new Map();
    const byEmail = new Map();
    if (ids.length) for (const u of await readUsers({ id: { _in: ids } })) byId.set(lower(u.id), u);
    if (emails.length) {
      for (const u of await readUsers({ email: { _in: emails } })) {
        byEmail.set(lower(u.email), u);
        byId.set(lower(u.id), u);
      }
    }

    // 3. Decide who gets a row: one per person per type and source within this call.
    const seen = new Set();
    const ready = [];
    for (const row of rows) {
      if (row.recipient_email && byEmail.has(row.recipient_email)) {
        row.recipient = lower(byEmail.get(row.recipient_email).id);
        row.recipient_email = null;
      }
      const user = row.recipient ? byId.get(row.recipient) : null;
      const key = [row.recipient || row.recipient_email, row.type, row.source_collection, row.source_id].join('|');
      const skip =
        (row.actor && row.recipient === row.actor) ||
        seen.has(key) ||
        (row.recipient && (!user || user.status !== 'active')) ||
        (!row.recipient && undeliverable(row.recipient_email)) ||
        ready.length >= CONFIG.maxRecipients;
      if (skip) {
        result.skipped += 1;
        continue;
      }
      seen.add(key);
      row.email = user ? user.email : row.recipient_email;
      ready.push(row);
    }
    if (ready.length === 0) return result;

    const items = await itemsOf(CONFIG.collection);
    const needsPrefs = ready.some((r) => r.recipient && CONFIG.immediateTypes.indexOf(r.type) !== -1);
    const prefs = needsPrefs ? await readPrefs(ready.filter((r) => r.recipient).map((r) => r.recipient)) : new Map();

    // 4. Write each row on its own, so one failure does not stop the others.
    for (const row of ready) {
      try {
        const now = new Date().toISOString();
        const doMerge = row.merge === true || typeof row.merge === 'string' || (row.merge !== false && CONFIG.mergeTypes.indexOf(row.type) !== -1);
        // A key seen before is a no-op, before anything else: a retried hook must not bump a merged row.
        if (row.dedupe_key) {
          const existing = await items.readByQuery({ filter: { dedupe_key: { _eq: row.dedupe_key } }, fields: ['id'], limit: 1 });
          if (existing && existing.length) {
            result.skipped += 1;
            continue;
          }
        }
        if (doMerge) {
          const open = await items.readByQuery({ filter: sourceFilter(row), fields: ['id', 'title'], limit: 1 });
          if (open && open.length) {
            const noun = typeof row.merge === 'string' ? row.merge : CONFIG.mergeNouns[row.type] || 'updates';
            await items.updateOne(open[0].id, {
              title: countedTitle(open[0].title, noun, row.subject),
              message: row.message,
              link: row.link,
              actor: row.actor,
              actor_name: row.actor_name,
              created_at: now,
            });
            result.merged += 1;
            result.ids.push(open[0].id);
            continue;
          }
        }
        let id;
        try {
          id = await items.createOne({
            recipient: row.recipient,
            recipient_email: row.recipient_email,
            type: row.type,
            title: row.title,
            message: row.message,
            link: row.link,
            actor: row.actor,
            actor_name: row.actor_name,
            source_collection: row.source_collection,
            source_id: row.source_id,
            dedupe_key: row.dedupe_key,
            emailed_at: row.emailed ? now : null,
            created_at: now,
          });
        } catch (error) {
          // Another run inserted the same dedupe_key between the select and the insert.
          if (row.dedupe_key && isUniqueViolation(error)) {
            result.skipped += 1;
            continue;
          }
          throw error;
        }
        result.created += 1;
        result.ids.push(id);

        // 5. Immediate email, for immediate types, unless the person chose the digest or no email.
        const mode = row.recipient ? prefs.get(row.recipient) : null;
        if (!row.emailed && CONFIG.immediateTypes.indexOf(row.type) !== -1 && mode !== 'off' && mode !== 'digest' && row.email && !undeliverable(row.email)) {
          if (await sendNow(row.email, Object.assign({}, row, { id }))) await markEmailed([id]);
        }
      } catch (error) {
        result.skipped += 1;
        console.error('notifications: write failed for', row.recipient || '(email)', row.type, row.source_id || '', errMsg(error));
      }
    }
  } catch (error) {
    console.error('notifications: notify failed:', errMsg(error));
  }
  return result;
}

return { notify, audience, markEmailed, config: CONFIG };
