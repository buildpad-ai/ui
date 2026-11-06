# Comments: what to set up in the DaaS

`CommentsKit` is the browser side. This folder is what the backend needs.

| File | What it is |
|---|---|
| `comments.schema.json` | The two collections (comments, reactions): fields, foreign keys, permissions, the unique index |
| `services/comment_mail.js` | A custom service that sends the mention and reply emails |
| `hooks/notify-on-mention.hook.js` | Action hook: email the people @mentioned in a new comment |
| `hooks/notify-on-reply.hook.js` | Action hook: email the author of the comment that was answered |

The create hooks that stamp the author, the thread root and the access (and turn the token of
someone who may not read the record into plain text) are step 3 of the `add-comments` skill
(`buildpad-ai/skills`). They are app-specific, because they apply your own access rule, so they are
not copied here.

## Emails

**What is sent**

- **A mention** emails each person mentioned in a new comment: "Ana mentioned you in “Title”", with
  the comment, what it replies to, and an **Open the comment** button.
- **A reply** emails the author of the comment that was answered: "Ana replied to your post in
  “Title”".
- Never the author themself. Never the same person twice for one comment: a person this reply
  already mentions gets the mention email only.
- At most 10 people per comment.
- Not to people who are not `active`, who have no email, or whose address cannot receive mail
  (`.test`, `.invalid`, `.localhost`, `.example`, `example.com/.org/.net`, `daas.internal`,
  `servicerole@…`). Those are skipped, not failed.
- A first-time hint is added for someone who has never signed in (`last_access` empty).
- Every value in the HTML card is escaped. The text part is plain text.

**When it is sent.** The hooks listen to the comment collection's **create** event, once. Editing a
comment never emails anyone, and the same create is never emailed twice. There is no log of what was
sent (no notice table): failures go to the DaaS log (`/logs`), and a failed email is not retried.

**It never affects the comment.** The hooks are action hooks (after the write, non-blocking), and the
service and the hooks catch every error. A mail server that is down loses the email, not the comment.

### Install, in this order

1. **The two collections** from `comments.schema.json`, with every foreign key made by a relation
   call. Then the create hooks from the `add-comments` skill (step 3).
2. **Edit `CONFIG`** at the top of `services/comment_mail.js`: your comment collection and the column
   that points at the thing commented on, the thing's collection and title column, the app name and
   noun, and `linkPath` (where *Open the comment* goes; `{host}` and `{comment}` are replaced by the
   ids). If your comment columns are not the skill's defaults, set `fields` too. Then set **who may
   be emailed** (next section): until you do, the service sends nothing.
3. **Expose the app's URL** to services: `RUNTIME_ENV_WHITELIST_CUSTOM_SERVICE=APP_URL` on the DaaS,
   with `APP_URL=https://your-app.example.com`. Without it the `appUrl` fallback in `CONFIG` is used.
4. **Create the service** (the `services` tool, `create`): name `comment_mail`, `status: active`,
   `timeout_ms: 20000`, and the file's contents as `code`. The hooks call it by name; if you choose
   another name, change it in both hooks.
5. **Create the two hooks** (the `extensions` tool, `create`): `type: action`, `status: active`,
   `timeout_ms: 25000`, `event: <your comment collection>.items.create`, and each file's contents as
   `code`.
6. **SMTP** must be configured on the DaaS (`services.mail` sends through it).

### Say who may be emailed

The service **fails closed**: as shipped it sends no mention or reply email, and every attempt writes
`comment mail: nothing sent, because no access rule is configured` to the DaaS log. A mention token is
just text, so without a rule anyone who may comment could have the record's title and the comment
mailed to any active user. Set one of these in `CONFIG`:

- `mentionsCheckedByCreateHook: true` when your create hook (the `add-comments` skill, step 3) already
  turns the token of anyone who may not read the record into plain text. Every id that reaches the
  service is then a reader.
- `canRead(host, userId)` with your own access rule, returning `true` only for people who may read
  `host` (the record, as read from `CONFIG.host`). When set, it decides, whatever the flag says. A rule
  that returns nothing refuses.

### How this was checked

`tests/daas-mail.test.ts` runs these exact files in a sandbox built like the DaaS's own
(`lib/utils/code-sandbox.ts`: `process`, `require`, timers and `fetch` blocked, the builtins frozen,
strict-mode function bodies, the same parameter lists) against fake in-memory services. 40 tests,
and nine deliberate bugs in the service and a hook (no escaping, no self-skip, reads not elevated, no
dedupe, no cap, test addresses mailed, a mail failure counted as sent, a hook that does not swallow
errors) are each caught.

**Not checked:** a real DaaS and a real mail server. Send a test comment with a mention and a reply
between two real accounts before relying on it, and look at `/logs` for `comment mail` errors.
