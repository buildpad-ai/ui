// Filter hook (optional): hide notifications about records the reader can no longer read.
//
// Event:   notifications.items.read      Type: filter      Timeout: 5000 ms      Status: active
//
// Runs as a function body with (payload, meta, context, services, console, JSON, Date, Math) and
// returns the rows to keep. The read permission already limits rows to recipient = $CURRENT_USER;
// this also drops a row whose source record the reader may not read (with their own rights). The row
// stays stored and comes back if access returns.
//
// - Admins and the system pass without any lookup.
// - Memoised: one read per source collection, however many rows.
// - Fails closed: if a source cannot be checked, its rows are dropped and the ids are logged.
// - Rows with no source pass. Rows read without the source columns (fields: ['id']) are looked up.
// - Aggregates (rows without id) pass unchanged.
const CONFIG = {
  collection: 'notifications',
  // Only these source collections are checked; others pass. Empty: check every source.
  checkedCollections: [],
};
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

const accountability = (context && context.accountability) || null;
if (!Array.isArray(payload) || payload.length === 0) return payload;
if (!accountability || accountability.admin === true || !accountability.user) return payload;
try {
  const rows = payload;
  // Fill in the source of rows read without it.
  const missing = rows.filter((r) => r && r.id != null && !('source_collection' in r && 'source_id' in r)).map((r) => r.id);
  const sourceOf = new Map();
  if (missing.length) {
    const own = await services.items(CONFIG.collection, { elevated: true });
    const found = await own.readByQuery({ filter: { id: { _in: missing } }, fields: ['id', 'source_collection', 'source_id'], limit: -1 });
    for (const f of found || []) sourceOf.set(String(f.id), f);
  }
  const missingSet = new Set(missing.map(String));
  const src = (r) => (missingSet.has(String(r.id)) ? sourceOf.get(String(r.id)) || null : r);
  // A row whose source could not be resolved is dropped (fail closed); the rest are checked.
  const views = [];
  for (const r of rows) {
    if (!r || r.id == null) {
      views.push({ id: null, row: r });
      continue;
    }
    const s = src(r);
    if (s) views.push({ id: r.id, source_collection: s.source_collection, source_id: s.source_id, row: r });
  }
  const readIds = async (collection, ids) => {
    const items = await services.items(collection);
    const got = await items.readByQuery({ filter: { id: { _in: ids } }, fields: ['id'], limit: -1 });
    return new Set((got || []).map((g) => String(g.id)));
  };
  return (await visibleRows(views, CONFIG.checkedCollections, readIds)).map((v) => v.row);
} catch (error) {
  console.error('notifications-visible: failed, hiding the rows:', error && error.message);
  return payload.filter((r) => !r || r.id == null);
}
