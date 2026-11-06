// Action hook: email the people @mentioned in a new comment.
//
// Event:   ticket_comments.items.create   (use your comment collection)
// Type:    action        Timeout: 25000 ms        Status: active
//
// The DaaS runs this as a function body with the parameters (meta, context, services, console,
// JSON, Date, Math). On a create, `meta` is { payload, key, collection }: `payload` is only what
// the browser sent (no author, no thread root), so the service reads the stored row by `key`.
//
// It never throws: a mail problem must not affect the comment.
try {
  const mailer = await services.custom('comment_mail');
  const keys = Array.isArray(meta.keys) && meta.keys.length ? meta.keys : [meta.key];
  for (const key of keys) {
    if (key) await mailer.notifyMentions(key);
  }
} catch (error) {
  console.error('comment mention notification failed:', error && error.message);
}
