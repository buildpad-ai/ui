# Notifications: what to set up in the DaaS

`NotificationsProvider`, `NotificationBell` and `NotificationsInbox` are the browser side. This
folder is what the backend needs.

| File | What it is |
|---|---|
| `notifications.schema.json` | The `notifications` collection (and the optional `notification_prefs`): fields, foreign keys, indexes, permissions |
| `services/notifications.js` | A custom service, `notifications`: `notify()`, `audience()`, `markEmailed()`. Everything that writes a notification goes through it |
| `hooks/notify-on-comment-mention.hook.js` | Action hook: a bell notification for each person @mentioned in a new comment |
| `hooks/notify-on-comment-reply.hook.js` | Action hook: a bell notification for the author of the comment that was answered (replies merge) |
| `hooks/notify-on-assign.hook.js` | Action hook: a bell notification for the person a record is assigned to |
| `hooks/notifications-visible.hook.js` | Optional filter hook: hide notifications about records the reader can no longer read |
| `cron/notification-digest.js` | Cron job: one daily email per person with what they have not seen |

These files are **pasted into your DaaS**; `buildpad add notifications` does not copy them. Edit the
`CONFIG` block at the top of each file first.

## The data model

One row in `notifications` per notification:

| Column | Meaning |
|---|---|
| `recipient` | The user notified (FK to `daas_users`, `CASCADE`) |
| `recipient_email` | Lower-case address of a person **without an account**. They get the digest email only and never appear in a bell. An address that belongs to a user is turned into that user's id by the service |
| `type` | `mention`, `reply`, `assigned`, ... your own words. Drives the icon, the tabs and immediate-versus-digest email |
| `title`, `message` | What the bell shows. Plain text |
| `link` | App-relative deep link, e.g. `/tickets/T1?comment=C9`. Anything else (`javascript:`, `https://…`, `//host`, `/\host`) is stored as null by the service, and the UI ignores it too |
| `actor`, `actor_name` | Who caused it (`actor` is `SET NULL` when that user is deleted) |
| `source_collection`, `source_id` | The record it is about (used for merging and by the visibility hook) |
| `dedupe_key` | Unique, hidden. At most one row ever exists per key |
| `read_at` | Set by the bell. The only column people may change |
| `emailed_at` | Set when emailed (immediate or digest), or when the digest decided not to email it |
| `created_at` | Set by the service; bumped when a row is merged, so it moves to the top |

Two indexes: `(recipient, read_at, created_at)` for the bell and `(emailed_at, created_at)` for the
digest.

**Permissions** (for your app's signed-in role):

- **read** where `recipient = $CURRENT_USER`, without `recipient_email`, `dedupe_key` and `emailed_at`.
  The UI asks for exactly these fields (`READABLE_NOTIFICATION_FIELDS`); a test keeps the two equal,
  because asking for a column the permission leaves out makes the DaaS answer 403.
- **update** where `recipient = $CURRENT_USER`, field `read_at` only (mark read, mark unread, mark all).
- **no create, no delete.** People never write notifications; the service does, elevated.

`notification_prefs` is optional: one row per person who changed the default email mode
(`immediate`, `digest` or `off`; no row means `immediate`). See [Known limits](#known-limits) for how
its create permission must be handled.

## What `notify()` does

```js
const notifications = await services.custom('notifications');
const result = await notifications.notify([
  { recipient, type: 'assigned', title: 'Ana assigned you “Fix login”', link: '/tickets/T1',
    actor, actor_name: 'Ana', source_collection: 'tickets', source_id: 'T1' },
]);
// result: { created, merged, skipped, ids }
```

- **Self-exclusion.** A row whose `recipient` is its `actor` is dropped: nobody is notified of their
  own action. `audience(ids, actorId)` gives you the unique, lower-case ids without the actor.
- **Skipped, not failed:** rows without a recipient or a type, inactive or unknown users, an
  email-only row whose address cannot receive mail (`.test`, `.invalid`, `.localhost`, `.example`,
  `example.com/.org/.net`, `daas.internal`, `servicerole@…`), duplicates within one call (one row per
  person, type and source), and everyone past `CONFIG.maxRecipients` (50).
- **Idempotent with `dedupe_key`.** A row with a key that already exists is skipped, so a retried
  hook or a re-run does not create a second row. The key is checked first, before merging, so a
  retried merging row does not bump the count either. A concurrent insert that hits the unique index
  (Postgres 23505) is skipped too.
- **Merge into an unread row.** For types in `CONFIG.mergeTypes` (default `reply`), or a row passing
  `merge: true` / `merge: 'replies'`, a new row folds into the recipient's unread, un-emailed row of
  the same type and source instead: the title becomes a count (“3 new replies on Fix login”), the
  message, link and actor are the latest, and `created_at` moves it to the top.
- **Already emailed (`emailed: true`).** A caller that has emailed the person itself (the comment mail
  service does) passes `emailed: true`: the row is stored with `emailed_at` set, so the digest leaves
  it out, no immediate email is sent for it, and it merges only into rows that were emailed too.
- **App-relative links only.** `link` must start with one `/` (not `//` or `/\`); anything else is
  stored as null.
- **Immediate or digest.** Types in `CONFIG.immediateTypes` are emailed at once, one email per row,
  unless the person chose `digest` or `off`; the row is then marked `emailed_at`. Every other type
  waits for the daily digest. As shipped, `immediateTypes` is empty: everything goes to the digest.
- **It never throws.** A notification problem must not undo the change that caused it. Each row is
  written on its own, so one failure does not stop the others.
- **Logs ids only.** Failures go to the DaaS log (`/logs`) with ids and types, never titles,
  messages or addresses.

## Install, in this order

1. **The collection(s)** from `notifications.schema.json`: `notifications`, and `notification_prefs`
   if you want per-person email modes. Create **every foreign key with a relation call**
   (`recipient` and `actor` → `daas_users`, `notification_prefs.user` → `daas_users`): a field with a
   relation block does not create the constraint. Make `dedupe_key` unique, add the two indexes, and
   set the permissions above.
2. **Edit `CONFIG`** at the top of `services/notifications.js`: `appName`, `appUrl` (the fallback),
   `immediateTypes`, `mergeTypes` / `mergeNouns`, and `prefsCollection: null` if you did not create
   `notification_prefs`. Keep `immediateTypes` in step with the same setting in the digest.
3. **Expose the app's URL**, as for comments: `RUNTIME_ENV_WHITELIST_CUSTOM_SERVICE=APP_URL` on the
   DaaS (and the same for cron jobs, for the digest), with `APP_URL=https://your-app.example.com`.
   Without it the `appUrl` in `CONFIG` is used. Links in emails are `APP_URL + link`.
4. **Create the service** (the `services` tool, `create`): name `notifications`, `status: active`,
   `timeout_ms: 20000`, the file's contents as `code`. The hooks, the digest and `comment_mail` call
   it by that name.
5. **Create the hooks** you want (the `extensions` tool, `create`, `status: active`), each with its
   `CONFIG` edited (collections, title column, noun, `linkPath`):

   | Hook | Type | Event | Timeout |
   |---|---|---|---|
   | `notify-on-comment-mention` | `action` | `<your comment collection>.items.create` | 25000 ms |
   | `notify-on-comment-reply` | `action` | `<your comment collection>.items.create` | 25000 ms |
   | `notify-on-assign` | `action` | `<collection>.items.update` (add `.items.create` too if records are created assigned) | 25000 ms |

   Read [Comments: choose one path](#comments-choose-one-path) before creating the two comment hooks.
6. **Create the cron job** `notification-digest` from `cron/notification-digest.js`: schedule
   `0 9 * * *`, timeout 120000 ms. The schedule runs in the DaaS's timezone (often UTC, where 09:00 is
   16:00 in Jakarta), so pick the hour for your users. Create it **inactive**, put your own address
   in `ONLY_RECIPIENTS` and `run_now` it as a dry run (only those addresses are touched), then empty
   `ONLY_RECIPIENTS` and activate it. Schedule **one** run a day (see [Known limits](#known-limits)).
7. **Optional: the visibility filter.** `hooks/notifications-visible.hook.js` as a `filter` hook on
   `notifications.items.read`, timeout 5000 ms. It drops rows whose source record the reader may no
   longer read (with their own rights); the row stays stored and comes back if access returns.
   Admins pass without a lookup, one read is made per source collection, and it fails closed. Limit
   it to some sources with `CONFIG.checkedCollections`. **Also turn on `CONFIG.checkAccess` in the
   digest**: the cron job runs as the system, so this hook does not filter what it reads. A cron job
   cannot read as another user, so with `checkAccess: true` the digest checks each person's rows
   against `CONFIG.accessFilters`, one filter per source collection with `'$CURRENT_USER'` standing for
   the person (mirror your read permission). Rows they cannot read are marked handled and never
   mailed. It fails closed: a source collection with no filter drops its rows. The check is the same
   code as the hook's (`visibleRows`, copied into both files; a test keeps the copies identical).
   People without an account (`recipient_email` rows) are not checked.
8. **SMTP** must be configured on the DaaS (`services.mail` sends through it) for immediate emails and
   the digest. The bell works without it.

## Calling `notify()` from your own code

**From a hook or a cron job**, get the service by name. Pass a `dedupe_key` when the same event can
be seen twice:

```js
// Action hook on orders.items.update: tell the owner when an order is approved.
try {
  if (meta.payload && meta.payload.status === 'approved') {
    const notifications = await services.custom('notifications');
    const orders = await services.items('orders', { elevated: true });
    const actor = context.accountability && context.accountability.user;
    for (const key of meta.keys || [meta.key]) {
      const order = await orders.readOne(key, { fields: ['id', 'title', 'owner'] });
      if (!order || !order.owner) continue;
      await notifications.notify({
        recipient: order.owner,
        type: 'status',
        title: 'Your order “' + order.title + '” was approved',
        link: '/orders/' + order.id,
        actor,
        source_collection: 'orders',
        source_id: String(order.id),
        dedupe_key: 'order-approved:' + order.id,
      });
    }
  }
} catch (error) {
  console.error('order notification failed:', String((error && error.message) || error).slice(0, 200));
}
```

**From an agent or a back-end job**, use a service token: a DaaS user with a static token and a
policy that may run the `notifications` service. Call the service through your DaaS's custom-service
endpoint with that token, or let the agent write the record and leave the notification to a hook as
above. Never give that token to a browser: whoever holds it can notify anyone. Set `actor` to the
agent's own user id so it is named and never notified itself.

## Comments: choose one path

There are two ways to get bell notifications for comment mentions and replies. **Use exactly one.**

- **Path A:** set `CONFIG.inAppNotifications: true` in `@buildpad/ui-comments`'
  `schema/services/comment_mail.js`. The comment mail service then also calls `notify()` for the same
  people it decides to email, under the same access rule (`mentionsCheckedByCreateHook` /
  `canRead`), including people whose address cannot receive mail. Best when you already run the
  comment emails.
- **Path B:** this package's `notify-on-comment-mention` and `notify-on-comment-reply` hooks. Best when
  you want bell notifications without the comment emails.

**Never both: you get double notifications.** Mentions happen to share a `dedupe_key`, but replies
do not: with both paths on, one reply becomes “2 new replies” (or two rows), and every comment is
processed twice.

## Known limits

- **The digest claim is not strictly atomic.** The digest claims a person's rows
  (`emailed_at` set where it is still null) before sending, but the DaaS's `updateByQuery` reads the
  matching ids and then updates them. Two overlapping runs could, rarely, both claim and send the same
  rows. Schedule one run a day and do not `run_now` while it runs. A failed send releases the claim
  for the next run.
- **Unique violations are recognised by shape.** A concurrent insert with the same `dedupe_key` is
  detected by an error `code` of `23505`, a message containing `23505`, `unique` or `duplicate`, or
  `extensions.code` `RECORD_NOT_UNIQUE`. Verify what your DaaS returns; if it is none of these, the
  row is logged as a write failure (there is still only one row).
- **Polling, not realtime.** The provider refreshes the unread count and the latest rows every 30 s
  (`pollMs`) while the tab is visible, and at once when it becomes visible or focused again. Wake
  events within 500 ms (focus and visibilitychange fire together) make one refetch, overlapping
  refetches share one request, and the inbox skips its poll fetch while the last one is still out.
- **Mark all read is one filtered PATCH** (`recipient = me` and `read_at` is null, set `read_at`). The
  update permission must accept a filtered update.
- **Paging.** The inbox pages by `created_at` only (DaaS cannot sort by a second field) with 10 rows of
  overlap. A short page does not end paging (the visibility hook may have dropped rows from it): only
  a page with nothing new does, so the end costs one extra, empty request. If more than about 40 rows
  share an identical `created_at`, a page brings nothing new and paging stops there rather than
  looping.
- **Assignments notify on a change only.** `notify-on-assign` skips a save whose assignee is the
  person the newest `assigned` row about that record is already for (forms often send every field on
  every save). Reassigning to someone else and back notifies again. Unassigning (or self-assigning)
  and then assigning the same person back does not, since neither leaves a row.
- **`notification_prefs` create.** The schema grants create on `email_mode` only, so a create needs a
  create hook that stamps `user` = the caller (and refuses a second row). Without that hook, grant no
  create to people and write prefs from your app's server side. The package ships neither the hook
  nor a preferences screen.
- **Tested in a sandbox, not on a real DaaS.** `tests/schema-*.test.ts` run these exact files in a
  sandbox built like the DaaS's, against fake services. Send yourself a test notification, open the
  bell, and dry-run the digest before relying on it.

## Migrating from an existing bell

Copy the old rows once with an elevated script, then switch the writers to `notify()`. Set
`emailed_at` to now on copied rows so the digest does not email history, and give each a
`dedupe_key` such as `migrated:<old id>` so the script can be re-run.

| From | Old field | `notifications` field |
|---|---|---|
| Chisel `feedback_notifications` | recipient email | `recipient` (the user with that email); `recipient_email` when there is no account |
| | kind | `type` |
| | subject, text | `title`, `message` |
| | feedback id | `source_collection: 'feedback'`, `source_id`, `link` |
| | read time | `read_at` |
| | created time | `created_at` |
| XCRM `crm_notifications` | user | `recipient` |
| | `text` | `title` (and `message` when long) |
| | `data` JSON: type, record, link, actor | `type`, `source_collection` / `source_id`, `link`, `actor` / `actor_name` |
| | read, created | `read_at`, `created_at` |
