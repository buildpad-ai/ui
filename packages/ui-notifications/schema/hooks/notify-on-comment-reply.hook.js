// Action hook: a bell notification for the author of the comment that was answered.
//
// Event:   ticket_comments.items.create   (use your comment collection)
// Type:    action        Timeout: 25000 ms        Status: active
//
// Replies merge: while the earlier one is unread and not yet emailed, a new reply on the same record
// turns it into "3 new replies on <title>" instead of adding a row. Not sent to the replier themself,
// nor to someone this reply @mentions (they get the mention), unless the mention hook leaves them out
// because they are past its maxMentions cap: then the reply notification is still sent. It never throws.
const CONFIG = {
  comments: 'ticket_comments',
  hostField: 'ticket',
  host: 'tickets',
  hostTitleField: 'title',
  fields: { parent: 'parent', author: 'author', body: 'body' },
  hostNoun: 'ticket',
  linkPath: '/tickets/{host}?comment={comment}',
  type: 'reply',
  usersCollection: 'daas_users',
  // Keep in step with maxMentions in notify-on-comment-mention.hook.js.
  maxMentions: 10,
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
      const comment = await read(CONFIG.comments, key, ['id', CONFIG.hostField, f.parent, f.author, f.body]);
      if (!comment || !comment[f.parent]) continue;
      const parent = await read(CONFIG.comments, comment[f.parent], ['id', f.author]);
      if (!parent || !parent[f.author]) continue;
      const recipient = String(parent[f.author]).toLowerCase();
      const ids = [];
      for (const m of String(comment[f.body] || '').matchAll(tokenRe)) ids.push(m[2]);
      // The same people the mention hook notifies (without the author, capped): they get the mention.
      const mentioned = notifications.audience(ids, comment[f.author]).slice(0, CONFIG.maxMentions);
      if (mentioned.indexOf(recipient) !== -1) continue;
      const hostId = comment[CONFIG.hostField];
      const host = await read(CONFIG.host, hostId, ['id', CONFIG.hostTitleField]);
      if (!host) continue;
      const hostTitle = String(host[CONFIG.hostTitleField] || CONFIG.hostNoun);
      const author = await read(CONFIG.usersCollection, comment[f.author], ['id', 'first_name', 'last_name']);
      const actorName = nameOf(author);
      const plain = String(comment[f.body] || '').replace(tokenRe, '@$1').replace(/\s+/g, ' ').trim();
      await notifications.notify([
        {
          recipient,
          type: CONFIG.type,
          title: actorName + ' replied on ' + hostTitle,
          message: plain.slice(0, 300),
          link: CONFIG.linkPath.replace('{host}', encodeURIComponent(hostId)).replace('{comment}', encodeURIComponent(comment.id)),
          actor: comment[f.author],
          actor_name: actorName,
          source_collection: CONFIG.host,
          source_id: hostId,
          merge: 'replies',
          subject: hostTitle,
        },
      ]);
    } catch (error) {
      console.error('reply notification failed for comment', key, error && error.message);
    }
  }
} catch (error) {
  console.error('reply notification failed:', error && error.message);
}
