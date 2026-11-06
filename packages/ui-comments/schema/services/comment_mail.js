// Custom service: emails for comments (mentions and replies).
//
// Paste as the body of a custom service named `comment_mail` (or your own name: the two hooks call it
// by name). The DaaS compiles this as a function body with one parameter, `context`, and keeps the
// object it returns. It uses only `context.services.items`, `.mail` and `.env`.
//
//   notifyMentions(commentId)  emails each person @mentioned in a new comment
//   notifyReply(commentId)     emails the author of the comment that was answered
//
// Both are called by the action hooks in ../hooks, which fire once, when a comment is CREATED. An
// edit never emails anyone, and a comment is never emailed about twice. Nothing here ever throws:
// a mail problem must not undo a comment, so every failure is logged and swallowed.
//
// 1. Edit CONFIG below to match your collections and your app.
// 2. Expose APP_URL to services: RUNTIME_ENV_WHITELIST_CUSTOM_SERVICE=APP_URL (otherwise the
//    `appUrl` fallback in CONFIG is used).

const CONFIG = {
  // The comment collection, and the column on it that points at the thing commented on.
  comments: 'ticket_comments',
  hostField: 'ticket',
  // The thing commented on: its collection, and the column that holds its title.
  host: 'tickets',
  hostTitleField: 'title',
  usersCollection: 'daas_users',
  // Column names of the comment collection (the add-comments skill's defaults).
  fields: { parent: 'parent', author: 'author', body: 'body', photos: 'photos' },
  // What the emails call things.
  appName: 'Acme Tickets',
  hostNoun: 'ticket',
  // How the person's own post is called in a reply email: "replied to your post" / "your comment".
  words: { root: 'post', reply: 'comment' },
  // Where "Open the comment" goes. {host} and {comment} are replaced by the two ids.
  linkPath: '/tickets/{host}?comment={comment}',
  // Used when the APP_URL runtime env var is not exposed to services. No trailing slash.
  appUrl: 'https://app.example.com',
  // At most this many people are emailed for one comment (the kit keeps at most 10 as mentions).
  maxMentions: 10,
  // Put the commenter's address in Reply-To, so answering the email reaches them. Off by default:
  // it shows that address to everyone emailed, and many apps keep people's addresses from each other.
  // Turn it on when people in your app may see each other's email addresses anyway.
  replyToAuthor: false,
  // Shown to someone who has never signed in.
  firstTimeHint: 'This looks like your first time here: sign in with this email address to see it.',
  // Who may be emailed about a record. This FAILS CLOSED: until you set one of the two below, no
  // mention or reply email is sent, and each attempt logs why.
  //
  //   mentionsCheckedByCreateHook: true
  //     Your create hook (add-comments skill, step 3) already turns the token of anyone who may not
  //     read the record into plain text, so every id that reaches this service is a reader.
  //   canRead(host, userId) { ... }
  //     Your own access rule: return true only for people who may read `host` (the record, as read
  //     from CONFIG.host). When set, it decides, whatever the flag says.
  //
  // Without one of them, anyone who may comment could have the record's title and the comment text
  // mailed to any active user, just by typing a mention token for that person's id.
  mentionsCheckedByCreateHook: false,
  canRead: null,
};

// ── helpers ─────────────────────────────────────────────────────────────

const services = context.services;
const env = context.env || services.env || {};

/** Escape text for HTML. Every value that ends up in the HTML card goes through this. */
const esc = (value) =>
  String(value == null ? '' : value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

/** A person's display name: first and last name, else words from the email's local part, never the address. */
function personName(user) {
  if (!user) return 'Someone';
  const full = [user.first_name, user.last_name]
    .map((part) => String(part || '').trim())
    .filter(Boolean)
    .join(' ');
  if (full) return full;
  const local = String(user.email || '').split('@')[0] || '';
  const words = local
    .split(/[._+-]+/)
    .map((word) => word.replace(/\d+/g, ''))
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1));
  return words.join(' ') || 'Someone';
}

// Addresses that cannot receive mail: skipped, not failed.
const BAD_DOMAINS = ['daas.internal', 'example.com', 'example.org', 'example.net'];
const BAD_TLDS = ['.test', '.invalid', '.localhost', '.example'];
function undeliverable(email) {
  const address = String(email || '').trim().toLowerCase();
  const at = address.lastIndexOf('@');
  if (at < 1) return true;
  const domain = address.slice(at + 1);
  if (!domain || domain.indexOf('.') === -1) return true;
  if (address.startsWith('servicerole@')) return true;
  if (BAD_DOMAINS.indexOf(domain) !== -1) return true;
  return BAD_TLDS.some((tld) => domain.endsWith(tld));
}

const deliverable = (user) => !!user && user.status === 'active' && !undeliverable(user.email);

/** True when CONFIG says who may be emailed. Otherwise logs why nothing is sent (see CONFIG). */
function accessRuleConfigured() {
  if (typeof CONFIG.canRead === 'function' || CONFIG.mentionsCheckedByCreateHook === true) return true;
  console.error(
    'comment mail: nothing sent, because no access rule is configured. Set ' +
      'CONFIG.mentionsCheckedByCreateHook or CONFIG.canRead in the comment_mail service.',
  );
  return false;
}

/** Whether this person may be emailed about this record. A rule that returns nothing refuses. */
const mayRead = (host, userId) =>
  typeof CONFIG.canRead === 'function' ? !!CONFIG.canRead(host, userId) : CONFIG.mentionsCheckedByCreateHook === true;

// A new RegExp each time: a shared /g regex keeps its position between calls.
const tokenRe = () => /@\[([^\[\]()\n]{1,100})\]\(user:([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\)/gi;

/** The people a body mentions, once each, in order, lower-case. */
function mentionIds(body) {
  const seen = new Set();
  const out = [];
  for (const match of String(body || '').matchAll(tokenRe())) {
    const id = match[2].toLowerCase();
    if (!seen.has(id)) {
      seen.add(id);
      out.push(id);
    }
  }
  return out;
}

/** The comment as plain text for an email: mentions as their current @Name, formatting marks removed. */
function plain(body, nameOf) {
  return String(body || '')
    .replace(tokenRe(), (all, name, id) => '@' + (nameOf(id.toLowerCase()) || name))
    .replace(/\*\*([^*\n]+)\*\*/g, '$1')
    .replace(/\+\+([^+\n]+)\+\+/g, '$1')
    .replace(/\*([^*\n]+)\*/g, '$1')
    .replace(/\r\n?/g, '\n')
    .trim();
}

const clip = (text, max) => (text.length > max ? text.slice(0, max - 1).trimEnd() + '…' : text);

const appUrl = () => String(env.APP_URL || CONFIG.appUrl || '').replace(/\/+$/, '');

function linkTo(hostId, commentId) {
  return (
    appUrl() +
    CONFIG.linkPath.replace('{host}', encodeURIComponent(hostId)).replace('{comment}', encodeURIComponent(commentId))
  );
}

/** One item by id, read with the service's own rights (the people involved cannot read each other's rows). */
async function readItem(collection, id, fields) {
  if (!id) return null;
  try {
    const items = await services.items(collection, { elevated: true });
    return await items.readOne(id, { fields });
  } catch (error) {
    // readOne throws when the row is gone (a deleted comment, a deleted record).
    return null;
  }
}

/** The people with these ids, as a map keyed by lower-case id. */
async function readPeople(ids) {
  const wanted = Array.from(new Set(ids.filter(Boolean).map((id) => String(id).toLowerCase())));
  const map = new Map();
  if (wanted.length === 0) return map;
  const items = await services.items(CONFIG.usersCollection, { elevated: true });
  const rows = await items.readByQuery({
    filter: { id: { _in: wanted } },
    fields: ['id', 'first_name', 'last_name', 'email', 'status', 'last_access'],
    limit: wanted.length,
  });
  for (const row of rows || []) map.set(String(row.id).toLowerCase(), row);
  return map;
}

/** Send one mail. Returns 'sent', 'failed' or 'skipped'; never throws. */
async function send(message) {
  try {
    const result = await services.mail(message);
    if (result && result.success === false) {
      console.error('comment mail not sent:', String(result.error || 'unknown error').slice(0, 300));
      return 'failed';
    }
    return 'sent';
  } catch (error) {
    console.error('comment mail failed:', String((error && error.message) || error).slice(0, 300));
    return 'failed';
  }
}

/** The HTML card and the text part of one email. */
function compose(parts) {
  const { heading, hostTitle, quoteLabel, quote, bodyText, link, note } = parts;
  const lines = [heading, '', CONFIG.hostNoun + ': ' + hostTitle];
  if (quote) lines.push('', quoteLabel, clip(quote, 300).replace(/^/gm, '> '));
  lines.push('', bodyText || '', '', 'Open the comment: ' + link);
  if (note) lines.push('', note);
  const html =
    '<div style="font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:1.5;color:#1f2328">' +
    '<p style="margin:0 0 12px"><strong>' + esc(heading) + '</strong></p>' +
    '<p style="margin:0 0 12px;color:#57606a">' + esc(CONFIG.hostNoun) + ': ' + esc(hostTitle) + '</p>' +
    (quote
      ? '<p style="margin:0 0 4px;color:#57606a;font-size:12px">' + esc(quoteLabel) + '</p>' +
        '<blockquote style="margin:0 0 12px;padding:6px 12px;border-left:3px solid #d0d7de;color:#57606a">' +
        esc(clip(quote, 300)).replace(/\n/g, '<br>') + '</blockquote>'
      : '') +
    '<div style="margin:0 0 16px;padding:10px 14px;background:#f6f8fa;border-radius:6px">' +
    esc(bodyText || '').replace(/\n/g, '<br>') + '</div>' +
    '<p style="margin:0 0 16px"><a href="' + esc(link) + '" style="display:inline-block;padding:8px 14px;background:#1f6feb;color:#ffffff;text-decoration:none;border-radius:6px">Open the comment</a></p>' +
    (note ? '<p style="margin:0 0 12px;color:#57606a;font-size:12px">' + esc(note) + '</p>' : '') +
    '<p style="margin:16px 0 0;color:#8c959f;font-size:12px">' + esc(CONFIG.appName) + '</p>' +
    '</div>';
  return { text: lines.join('\n'), html };
}

/** The comment, the thing it is on, and who is involved. Null when any part is gone. */
async function load(commentId) {
  const f = CONFIG.fields;
  const comment = await readItem(CONFIG.comments, commentId, [
    'id', CONFIG.hostField, f.parent, f.author, f.body, f.photos,
  ]);
  if (!comment) return null;
  const hostId = comment[CONFIG.hostField];
  const host = await readItem(CONFIG.host, hostId, ['id', CONFIG.hostTitleField]);
  if (!host) return null;
  return { comment, hostId: host.id, host, hostTitle: String(host[CONFIG.hostTitleField] || CONFIG.hostNoun) };
}

const bodyOf = (comment, nameOf) => {
  const text = plain(comment[CONFIG.fields.body], nameOf);
  if (text) return text;
  return Array.isArray(comment[CONFIG.fields.photos]) && comment[CONFIG.fields.photos].length ? '(sent a picture)' : '';
};

// ── the two entry points ────────────────────────────────────────────────

return {
  /** Email each person mentioned in this comment. Returns { sent, skipped } (ids), for logs and tests. */
  async notifyMentions(commentId) {
    const result = { sent: [], skipped: [] };
    try {
      const loaded = await load(commentId);
      if (!loaded) return result;
      const { comment, hostId, hostTitle, host } = loaded;
      const f = CONFIG.fields;
      const authorId = comment[f.author] ? String(comment[f.author]).toLowerCase() : null;
      const ids = mentionIds(comment[f.body]).slice(0, CONFIG.maxMentions);
      if (ids.length === 0) return result;
      if (!accessRuleConfigured()) {
        result.skipped.push(...ids);
        return result;
      }

      const parent = comment[f.parent]
        ? await readItem(CONFIG.comments, comment[f.parent], ['id', f.author, f.body])
        : null;
      const people = await readPeople([authorId, parent && parent[f.author]].concat(ids));
      const nameOf = (id) => (people.has(id) ? personName(people.get(id)) : null);
      const author = authorId ? people.get(authorId) : null;
      const authorName = personName(author);

      // Decide everyone first, then send all at once. The service and its hooks run under a time
      // limit (20 s and 25 s), and sending one after another let a slow mail server run out the
      // clock partway down the list: the rest were dropped without a word, and there is no record
      // to retry from.
      const outgoing = [];
      for (const id of ids) {
        const person = people.get(id);
        // Yourself, someone who cannot get mail, someone who may not read the record: no email.
        if (id === authorId || !deliverable(person) || !mayRead(host, id)) {
          result.skipped.push(id);
          continue;
        }
        const parentAuthor = parent && parent[f.author] ? nameOf(String(parent[f.author]).toLowerCase()) : null;
        const mail = compose({
          heading: authorName + ' mentioned you in “' + hostTitle + '”',
          hostTitle,
          quoteLabel: 'Replying to ' + (parentAuthor || 'a comment') + ':',
          quote: parent ? plain(parent[f.body], nameOf) : '',
          bodyText: bodyOf(comment, nameOf),
          link: linkTo(hostId, comment.id),
          note: person.last_access ? '' : CONFIG.firstTimeHint,
        });
        outgoing.push({
          id,
          message: {
            to: person.email,
            subject: authorName + ' mentioned you in “' + hostTitle + '”',
            text: mail.text,
            html: mail.html,
            replyTo: CONFIG.replyToAuthor && author && !undeliverable(author.email) ? author.email : undefined,
          },
        });
      }
      const settled = await Promise.allSettled(outgoing.map((o) => send(o.message)));
      outgoing.forEach((o, i) => {
        const sent = settled[i].status === 'fulfilled' && settled[i].value === 'sent';
        (sent ? result.sent : result.skipped).push(o.id);
      });
    } catch (error) {
      console.error('comment mention mail failed:', String((error && error.message) || error).slice(0, 300));
    }
    return result;
  },

  /** Email the author of the comment this one answers. Returns { sent, skipped } (ids). */
  async notifyReply(commentId) {
    const result = { sent: [], skipped: [] };
    try {
      const loaded = await load(commentId);
      if (!loaded) return result;
      const { comment, hostId, hostTitle, host } = loaded;
      const f = CONFIG.fields;
      if (!comment[f.parent]) return result;
      const parent = await readItem(CONFIG.comments, comment[f.parent], ['id', f.parent, f.author, f.body]);
      if (!parent || !parent[f.author]) return result;

      const authorId = comment[f.author] ? String(comment[f.author]).toLowerCase() : null;
      const recipientId = String(parent[f.author]).toLowerCase();
      // Never the replier themself, and not someone this reply already @mentions (they get that email).
      if (recipientId === authorId || mentionIds(comment[f.body]).indexOf(recipientId) !== -1) return result;
      if (!accessRuleConfigured()) {
        result.skipped.push(recipientId);
        return result;
      }

      const people = await readPeople([authorId, recipientId].concat(mentionIds(comment[f.body])));
      const recipient = people.get(recipientId);
      if (!deliverable(recipient) || !mayRead(host, recipientId)) {
        result.skipped.push(recipientId);
        return result;
      }
      const nameOf = (id) => (people.has(id) ? personName(people.get(id)) : null);
      const author = authorId ? people.get(authorId) : null;
      const authorName = personName(author);
      const noun = parent[f.parent] ? CONFIG.words.reply : CONFIG.words.root;
      const heading = authorName + ' replied to your ' + noun + ' in “' + hostTitle + '”';
      const mail = compose({
        heading,
        hostTitle,
        quoteLabel: 'Your ' + noun + ':',
        quote: plain(parent[f.body], nameOf),
        bodyText: bodyOf(comment, nameOf),
        link: linkTo(hostId, comment.id),
        note: recipient.last_access ? '' : CONFIG.firstTimeHint,
      });
      const status = await send({
        to: recipient.email,
        subject: heading,
        text: mail.text,
        html: mail.html,
        replyTo: CONFIG.replyToAuthor && author && !undeliverable(author.email) ? author.email : undefined,
      });
      (status === 'sent' ? result.sent : result.skipped).push(recipientId);
    } catch (error) {
      console.error('comment reply mail failed:', String((error && error.message) || error).slice(0, 300));
    }
    return result;
  },
};
