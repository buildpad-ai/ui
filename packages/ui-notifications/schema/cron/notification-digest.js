// Cron job "notification-digest": one email per person with the notifications they have not seen.
//
// Schedule: "0 9 * * *" (pick your timezone)   Timeout: 120000 ms   Create it inactive, dry-run it
// (ONLY_RECIPIENTS below, then run_now), then activate it.
//
// The DaaS runs this as a function body with (context, services, console, JSON, Date, Math), as the system.
//
// WHAT goes in: rows never emailed (emailed_at null), still unread (read_at null), at most MAX_AGE_DAYS
// old, and not an immediate type (those were emailed when they happened), except for people whose
// email_mode is 'digest', who get everything here. email_mode 'off': no email, rows marked handled.
// emailed_at means "handled by the digest": skipped rows (opted out, inactive, undeliverable) are
// marked too, so they are not looked at again.
//
// SAFE TO RE-RUN / OVERLAP: a person's rows are CLAIMED (emailed_at set where it is still null) before
// sending, and only claimed rows are sent. If the send fails the claim is released for the next run.
//
// ACCESS: with CONFIG.checkAccess on (do so when the notifications-visible hook is installed), rows
// about a record the person may not read are marked handled and never mailed. Fails closed.
//
// DRY RUN: when ONLY_RECIPIENTS is not empty, only those addresses are processed; nothing else is touched.

const CONFIG = {
  collection: 'notifications',
  prefsCollection: 'notification_prefs', // null when you do not have one
  usersCollection: 'daas_users',
  appName: 'Acme',
  appUrl: 'https://app.example.com', // used when APP_URL is not exposed to cron jobs. No trailing slash.
  immediateTypes: [], // keep in step with the notifications service
  typeLabels: { mention: 'Mentions', reply: 'Replies', assigned: 'Assigned to you' },
  maxItems: 40,
  maxRows: 5000,
  denyDomains: ['daas.internal', 'example.com', 'example.org', 'example.net'],
  denyTlds: ['.test', '.invalid', '.localhost', '.example'],
  // Turn on when you install hooks/notifications-visible.hook.js. This job runs as the system, so that
  // hook does not filter what it reads: without this, a digest could mail the title of a notification
  // about a record the person may no longer read. When on, each person's rows (people with an account)
  // are re-checked against their source record and the rows they cannot read are marked handled and
  // left out. A cron job cannot read as another user, so the rule is written here, per source
  // collection, as a filter in which '$CURRENT_USER' is replaced by the person's id. Mirror your read
  // permission for that collection. FAILS CLOSED: a source collection with no entry here (or a check
  // that errors) drops its rows.
  checkAccess: false,
  accessFilters: {
    // tickets: { _or: [{ assignee: { _eq: '$CURRENT_USER' } }, { reporter: { _eq: '$CURRENT_USER' } }] },
  },
  // Like CONFIG.checkedCollections in the hook: only these sources are checked. Empty: every source.
  checkedCollections: [],
};
const MAX_AGE_DAYS = 7;
const ONLY_RECIPIENTS = [];

const env = (context && context.env) || services.env || {};
const appUrl = String(env.APP_URL || CONFIG.appUrl || '').replace(/\/+$/, '');
const esc = (value) =>
  String(value == null ? '' : value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
const lower = (v) => (v == null || v === '' ? null : String(v).trim().toLowerCase());
const errMsg = (e) => String((e && e.message) || e).slice(0, 200);
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
// ── shared: visibleRows (the same text in notifications-visible.hook.js and notification-digest.js;
// the DaaS sandbox has no imports, so a test keeps the two copies identical) ──
// Keeps the rows whose source the reader may read. readIds(collection, ids) returns the Set of ids
// the reader may read; it is called once per source collection. A check that throws FAILS CLOSED: its
// rows are dropped. Rows with no source, rows in a collection not in `checked` (when not empty), and
// rows without an id (aggregates) pass.
async function visibleRows(rows, checked, readIds) {
  const hasSource = (r) => !!r && r.id != null && !!r.source_collection && r.source_id != null;
  const groups = new Map();
  for (const r of rows) {
    if (!hasSource(r)) continue;
    if (checked.length && checked.indexOf(r.source_collection) === -1) continue;
    if (!groups.has(r.source_collection)) groups.set(r.source_collection, new Set());
    groups.get(r.source_collection).add(String(r.source_id));
  }
  const readable = new Map(); // collection -> Set of readable ids, or null when the check failed
  for (const [collection, ids] of groups) {
    try {
      readable.set(collection, await readIds(collection, Array.from(ids)));
    } catch (error) {
      readable.set(collection, null);
      console.error('notifications access: check failed for', collection, String((error && error.message) || error).slice(0, 200));
    }
  }
  return rows.filter((r) => {
    if (!hasSource(r) || !readable.has(r.source_collection)) return true;
    const ok = readable.get(r.source_collection);
    return !!ok && ok.has(String(r.source_id));
  });
}
// ── end shared ──

/** A filter with every '$CURRENT_USER' replaced by this person's id. */
const asUser = (value, uid) =>
  value === '$CURRENT_USER'
    ? uid
    : Array.isArray(value)
      ? value.map((v) => asUser(v, uid))
      : value && typeof value === 'object'
        ? Object.fromEntries(Object.entries(value).map(([k, v]) => [k, asUser(v, uid)]))
        : value;

/** readIds for visibleRows, as `uid`: CONFIG.accessFilters, read as the system. */
const readIdsAs = (uid) => async (collection, ids) => {
  const rule = CONFIG.accessFilters[collection];
  if (!rule) throw new Error('no accessFilters entry');
  const items = await services.items(collection);
  const got = await items.readByQuery({ filter: { _and: [{ id: { _in: ids } }, asUser(rule, uid)] }, fields: ['id'], limit: -1 });
  return new Set((got || []).map((g) => String(g.id)));
};

const only = ONLY_RECIPIENTS.map(lower);
const dryRun = only.length > 0;
const stats = { people: 0, sent: 0, failed: 0, silent: 0, hidden: 0, rows: 0, dryRun };

const notifications = await services.items(CONFIG.collection);
const cutoff = new Date(Date.now() - MAX_AGE_DAYS * 86400000).toISOString();
const rows =
  (await notifications.readByQuery({
    filter: { _and: [{ emailed_at: { _null: true } }, { read_at: { _null: true } }, { created_at: { _gte: cutoff } }] },
    fields: ['id', 'recipient', 'recipient_email', 'type', 'title', 'message', 'link', 'actor_name', 'source_collection', 'source_id', 'created_at'],
    sort: ['-created_at'],
    limit: CONFIG.maxRows,
  })) || [];

// People and their preferences.
const userIds = Array.from(new Set(rows.map((r) => lower(r.recipient)).filter(Boolean)));
const users = new Map();
const modes = new Map();
if (userIds.length) {
  const u = await services.items(CONFIG.usersCollection);
  for (const row of (await u.readByQuery({ filter: { id: { _in: userIds } }, fields: ['id', 'email', 'status', 'first_name'], limit: -1 })) || []) {
    users.set(lower(row.id), row);
  }
  if (CONFIG.prefsCollection) {
    try {
      const p = await services.items(CONFIG.prefsCollection);
      for (const pref of (await p.readByQuery({ filter: { user: { _in: userIds } }, fields: ['user', 'email_mode'], limit: -1 })) || []) {
        modes.set(lower(pref.user), pref.email_mode);
      }
    } catch (error) {
      console.error('digest: prefs not read:', errMsg(error));
    }
  }
}

// Group per person: a user by id, a person without an account by address.
const people = new Map();
for (const r of rows) {
  const uid = lower(r.recipient);
  const key = uid ? 'u:' + uid : 'e:' + lower(r.recipient_email);
  if (!people.has(key)) {
    const user = uid ? users.get(uid) : null;
    people.set(key, {
      uid,
      email: uid ? lower(user && user.email) : lower(r.recipient_email),
      active: uid ? !!user && user.status === 'active' : true,
      name: user && user.first_name ? user.first_name : '',
      mode: uid ? modes.get(uid) || 'immediate' : 'digest',
      rows: [],
    });
  }
  people.get(key).rows.push(r);
}

async function claim(ids) {
  const claimedAt = new Date().toISOString();
  const keys = await notifications.updateByQuery({ filter: { _and: [{ id: { _in: ids } }, { emailed_at: { _null: true } }] } }, { emailed_at: claimedAt });
  return new Set((keys || []).map(String));
}

function compose(person, list) {
  const sections = new Map();
  const shown = list.slice(0, CONFIG.maxItems);
  for (const r of shown) {
    const label = CONFIG.typeLabels[r.type] || 'Updates';
    if (!sections.has(label)) sections.set(label, []);
    sections.get(label).push(r);
  }
  const more = list.length - shown.length;
  const count = list.length;
  const subject = count === 1 ? '1 new notification in ' + CONFIG.appName : count + ' new notifications in ' + CONFIG.appName;
  const greeting = person.name ? 'Hi ' + person.name + ',' : 'Hi,';
  const text = [greeting, '', 'Here is what you have not seen yet:'];
  let html =
    '<div style="font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:1.5;color:#1f2328">' +
    '<p style="margin:0 0 12px">' + esc(greeting) + '</p><p style="margin:0 0 16px">Here is what you have not seen yet:</p>';
  for (const [label, items] of sections) {
    text.push('', label);
    html += '<h3 style="margin:16px 0 8px;font-size:15px">' + esc(label) + '</h3><ul style="margin:0;padding-left:20px">';
    for (const r of items) {
      const link = appUrl + (r.link || '');
      text.push('- ' + r.title + (r.message ? ': ' + String(r.message).slice(0, 160) : '') + ' (' + link + ')');
      html +=
        '<li style="margin:0 0 6px"><a href="' + esc(link) + '">' + esc(r.title) + '</a>' +
        (r.message ? '<br><span style="color:#57606a">' + esc(String(r.message).slice(0, 160)) + '</span>' : '') + '</li>';
    }
    html += '</ul>';
  }
  if (more > 0) {
    text.push('', 'and ' + more + ' more');
    html += '<p style="margin:12px 0 0">and ' + more + ' more</p>';
  }
  text.push('', 'Open ' + CONFIG.appName + ': ' + appUrl);
  html +=
    '<p style="margin:16px 0"><a href="' + esc(appUrl) + '">Open ' + esc(CONFIG.appName) + '</a></p>' +
    '<p style="margin:16px 0 0;color:#8c959f;font-size:12px">' + esc(CONFIG.appName) + '</p></div>';
  return { subject, text: text.join('\n'), html };
}

for (const person of people.values()) {
  if (dryRun && only.indexOf(person.email) === -1) continue;
  let claimed = new Set();
  try {
    stats.people += 1;
    if (CONFIG.checkAccess && person.uid) {
      const visible = new Set(await visibleRows(person.rows, CONFIG.checkedCollections, readIdsAs(person.uid)));
      const hidden = person.rows.filter((r) => !visible.has(r));
      if (hidden.length) {
        // Handled: they are never mailed, and not looked at again.
        stats.hidden += (await claim(hidden.map((r) => r.id))).size;
        person.rows = person.rows.filter((r) => visible.has(r));
      }
    }
    const wanted = person.mode === 'digest' ? person.rows : person.rows.filter((r) => CONFIG.immediateTypes.indexOf(r.type) === -1);
    const silent = person.mode === 'off' || !person.active || !person.email || undeliverable(person.email);
    const handle = silent ? person.rows.filter((r) => CONFIG.immediateTypes.indexOf(r.type) === -1 || person.mode === 'off') : wanted;
    if (handle.length === 0) continue;
    claimed = await claim(handle.map((r) => r.id));
    if (claimed.size === 0) continue; // another run took them
    if (silent) {
      stats.silent += claimed.size;
      claimed = new Set();
      continue;
    }
    const list = wanted.filter((r) => claimed.has(String(r.id)));
    const mail = compose(person, list);
    const result = await services.mail({ to: person.email, subject: mail.subject, text: mail.text, html: mail.html });
    if (result && result.success === false) throw new Error('mail not sent');
    stats.sent += 1;
    stats.rows += list.length;
    claimed = new Set();
  } catch (error) {
    stats.failed += 1;
    console.error('digest: failed for', person.uid || '(email)', errMsg(error));
    if (claimed.size > 0) {
      try {
        await notifications.updateMany(Array.from(claimed), { emailed_at: null });
      } catch (releaseError) {
        console.error('digest: could not release claim for', person.uid || '(email)', errMsg(releaseError));
      }
    }
  }
}

console.log('digest:', JSON.stringify(stats));
return stats;
