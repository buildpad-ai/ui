// Action hook: email the author of the comment that was answered.
//
// Event:   ticket_comments.items.create   (use your comment collection)
// Type:    action        Timeout: 25000 ms        Status: active
//
// Same shape as notify-on-mention. The service skips the replier themself, and anyone this reply
// already @mentions (they get the mention email, not two). It never throws.
try {
  const mailer = await services.custom('comment_mail');
  const keys = Array.isArray(meta.keys) && meta.keys.length ? meta.keys : [meta.key];
  for (const key of keys) {
    if (key) await mailer.notifyReply(key);
  }
} catch (error) {
  console.error('comment reply notification failed:', error && error.message);
}
