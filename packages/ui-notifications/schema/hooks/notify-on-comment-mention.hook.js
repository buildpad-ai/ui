// Action hook: a bell notification for each person @mentioned in a new comment.
//
// Event:   ticket_comments.items.create   (use your comment collection)
// Type:    action        Timeout: 25000 ms        Status: active
//
// Runs as a function body with (meta, context, services, console, JSON, Date, Math). `meta.payload`
// is only what the browser sent, so the stored comment is read by key. Mentions are the kit's tokens
// @[Name](user:<uuid>). The author never notifies themself (the service drops it). Only mention people
// who may read the record: your comment create hook should already turn other tokens into text.
// It never throws.
const CONFIG = {
  comments: 'ticket_comments',
  hostField: 'ticket',
  host: 'tickets',
  hostTitleField: 'title',
  fields: { author: 'author', body: 'body' },
  hostNoun: 'ticket',
  linkPath: '/tickets/{host}?comment={comment}',
  type: 'mention',
  maxMentions: 10,
  usersCollection: 'daas_users',
};
try {
  const tokenRe = /@\[([^\[\]()\n]{1,100})\]\(user:([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\)/gi;
  const read = async (collection, id, fields) => {
    if (!id) return null;
    try {
      return await (await services.items(collection, { elevated: true })).readOne(id, { fields });
    } catch (e) {
      return null;
    }
  };
  const nameOf = (u) => (u ? [u.first_name, u.last_name].filter(Boolean).join(' ').trim() : '') || 'Someone';
  const notifications = await services.custom('notifications');
  const keys = Array.isArray(meta.keys) && meta.keys.length ? meta.keys : [meta.key];
  for (const key of keys) {
    try {
      if (!key) continue;
      const f = CONFIG.fields;
      const comment = await read(CONFIG.comments, key, ['id', CONFIG.hostField, f.author, f.body]);
      if (!comment) continue;
      const ids = [];
      for (const m of String(comment[f.body] || '').matchAll(tokenRe)) ids.push(m[2]);
      const people = notifications.audience(ids, comment[f.author]).slice(0, CONFIG.maxMentions);
      if (people.length === 0) continue;
      const hostId = comment[CONFIG.hostField];
      const host = await read(CONFIG.host, hostId, ['id', CONFIG.hostTitleField]);
      if (!host) continue;
      const hostTitle = String(host[CONFIG.hostTitleField] || CONFIG.hostNoun);
      const author = await read(CONFIG.usersCollection, comment[f.author], ['id', 'first_name', 'last_name']);
      const actorName = nameOf(author);
      const plain = String(comment[f.body] || '').replace(tokenRe, '@$1').replace(/\s+/g, ' ').trim();
      const link = CONFIG.linkPath.replace('{host}', encodeURIComponent(hostId)).replace('{comment}', encodeURIComponent(comment.id));
      await notifications.notify(
        people.map((id) => ({
          recipient: id,
          type: CONFIG.type,
          title: actorName + ' mentioned you on ' + hostTitle,
          message: plain.slice(0, 300),
          link,
          actor: comment[f.author],
          actor_name: actorName,
          source_collection: CONFIG.host,
          source_id: hostId,
          dedupe_key: 'mention:' + comment.id + ':' + id,
        })),
      );
    } catch (error) {
      console.error('mention notification failed for comment', key, error && error.message);
    }
  }
} catch (error) {
  console.error('mention notification failed:', error && error.message);
}
