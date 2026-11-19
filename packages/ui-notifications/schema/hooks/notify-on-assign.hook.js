// Action hook: a bell notification for the person a record is assigned to.
//
// Event:   tickets.items.update   (use your collection; add .items.create too if records are created assigned)
// Type:    action        Timeout: 25000 ms        Status: active
//
// Fires only when the update's payload sets one of CONFIG.assigneeFields to someone. Not sent when
// people assign to themselves. One update of many records (meta.keys) notifies once per record.
// It never throws.
//
// Only a CHANGED assignee is notified. An action hook runs after the write, so the previous value is
// gone; and a form that saves every field sends `assignee` on every save. So the hook asks the
// notifications collection instead: when the newest `assigned` row about this record is already for
// this person, they were told and nothing changed, so nothing is sent. Reassigning to someone else
// creates that person's row, so assigning back later notifies again. (A dedupe_key per assignee would
// block that forever.) Not covered: unassigning, or a self-assignment, and then assigning the same
// person back sends nothing, because neither leaves a row; they were told about it already.
const CONFIG = {
  collection: 'tickets',
  assigneeFields: ['assignee'],
  titleField: 'title',
  noun: 'ticket',
  linkPath: '/tickets/{id}',
  type: 'assigned',
  usersCollection: 'daas_users',
  notificationsCollection: 'notifications',
};
try {
  const payload = (meta && meta.payload) || {};
  const assignees = [];
  for (const field of CONFIG.assigneeFields) {
    if (!Object.prototype.hasOwnProperty.call(payload, field)) continue;
    const value = payload[field];
    const id = value && typeof value === 'object' ? value.id : value;
    if (id) assignees.push(String(id).toLowerCase());
  }
  if (assignees.length) {
    const actor = context && context.accountability && context.accountability.user ? context.accountability.user : null;
    const notifications = await services.custom('notifications');
    const read = async (collection, id, fields) => {
      try {
        return await (await services.items(collection, { elevated: true })).readOne(id, { fields });
      } catch (e) {
        return null;
      }
    };
    const user = actor ? await read(CONFIG.usersCollection, actor, ['id', 'first_name', 'last_name']) : null;
    const actorName = (user ? [user.first_name, user.last_name].filter(Boolean).join(' ').trim() : '') || 'Someone';
    const keys = Array.isArray(meta.keys) && meta.keys.length ? meta.keys : [meta.key];
    for (const key of keys) {
      try {
        if (!key) continue;
        const record = await read(CONFIG.collection, key, ['id', CONFIG.titleField]);
        if (!record) continue;
        const title = String(record[CONFIG.titleField] || CONFIG.noun);
        // Who was told last about this record. A failed lookup notifies (a duplicate beats silence).
        let lastTold = null;
        try {
          const own = await services.items(CONFIG.notificationsCollection, { elevated: true });
          const last = await own.readByQuery({
            filter: { _and: [{ type: { _eq: CONFIG.type } }, { source_collection: { _eq: CONFIG.collection } }, { source_id: { _eq: String(key) } }] },
            fields: ['recipient'],
            sort: ['-created_at'],
            limit: 1,
          });
          lastTold = last && last[0] && last[0].recipient ? String(last[0].recipient).toLowerCase() : null;
        } catch (e) {
          lastTold = null;
        }
        await notifications.notify(
          notifications.audience(assignees, actor).filter((id) => id !== lastTold).map((id) => ({
            recipient: id,
            type: CONFIG.type,
            title: actorName + ' assigned you ' + title,
            link: CONFIG.linkPath.replace('{id}', encodeURIComponent(key)),
            actor,
            actor_name: actorName,
            source_collection: CONFIG.collection,
            source_id: String(key),
          })),
        );
      } catch (error) {
        console.error('assign notification failed for', key, error && error.message);
      }
    }
  }
} catch (error) {
  console.error('assign notification failed:', error && error.message);
}
