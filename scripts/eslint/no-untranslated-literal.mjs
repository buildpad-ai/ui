/**
 * buildpad/no-untranslated-literal
 *
 * Flags user-facing English literals in Buildpad package sources that bypass
 * the shared dictionary (`packages/utils/src/i18n/defaults.ts` is the only
 * place literals belong — see docs/I18N_PLAN.md, B2 "definition of done"):
 *
 *   - JSX text with letters:             <Text>No items</Text>
 *   - string-valued text props:          label="Email"  placeholder="Search…"  aria-label="Close"
 *   - notifications.show titles/messages: notifications.show({ title: 'Saved' })
 *
 * Skips: strings without letters, single non-word tokens (`—`, `•`, `/`),
 * expression containers with template literals that are only punctuation,
 * and anything inside *.stories.tsx / tests (scoped by the config).
 */

const TEXT_PROPS = new Set([
  'label',
  'placeholder',
  'title',
  'description',
  'aria-label',
  'aria-description',
  'tooltip',
  'alt',
  'message',
  'nothingFoundMessage',
  'emptyMessage',
  'loadingText',
  'noItemsText',
  'confirmLabel',
  'cancelLabel',
]);

/** Text that a human would read as words (not a symbol, a key, or a code token). */
function looksLikeCopy(value) {
  const text = value.trim();
  if (!text) return false;
  if (!/[A-Za-z]{2,}/.test(text)) return false; // needs a real word
  if (/^[a-z0-9_.-]+$/.test(text)) return false; // identifier / key / class name
  if (/^[A-Z0-9_]+$/.test(text) && !/\s/.test(text)) return false; // CONSTANT
  if (/^\{.*\}$/.test(text)) return false; // template-only
  return true;
}

export default {
  meta: {
    type: 'suggestion',
    docs: {
      description:
        'Disallow hardcoded user-facing text in Buildpad packages; read it from the shared i18n dictionary instead.',
    },
    schema: [],
    messages: {
      literal:
        'Hardcoded user-facing text "{{text}}". Read it from useBuildpadTranslations() (defaults live in utils/src/i18n/defaults.ts).',
    },
  },
  create(context) {
    const report = (node, text) =>
      context.report({ node, messageId: 'literal', data: { text: text.trim().slice(0, 40) } });

    return {
      JSXText(node) {
        if (looksLikeCopy(node.value)) report(node, node.value);
      },
      JSXAttribute(node) {
        const name = node.name?.name;
        if (typeof name !== 'string' || !TEXT_PROPS.has(name)) return;
        const value = node.value;
        if (!value) return;
        if (value.type === 'Literal' && typeof value.value === 'string' && looksLikeCopy(value.value)) {
          report(value, value.value);
        } else if (
          value.type === 'JSXExpressionContainer' &&
          value.expression.type === 'Literal' &&
          typeof value.expression.value === 'string' &&
          looksLikeCopy(value.expression.value)
        ) {
          report(value.expression, value.expression.value);
        }
      },
      CallExpression(node) {
        const callee = node.callee;
        const isNotificationsShow =
          callee.type === 'MemberExpression' &&
          callee.object.type === 'Identifier' &&
          callee.object.name === 'notifications' &&
          callee.property.type === 'Identifier' &&
          (callee.property.name === 'show' || callee.property.name === 'update');
        if (!isNotificationsShow) return;
        const arg = node.arguments[0];
        if (!arg || arg.type !== 'ObjectExpression') return;
        for (const prop of arg.properties) {
          if (prop.type !== 'Property' || prop.key.type !== 'Identifier') continue;
          if (prop.key.name !== 'title' && prop.key.name !== 'message') continue;
          if (prop.value.type === 'Literal' && typeof prop.value.value === 'string' && looksLikeCopy(prop.value.value)) {
            report(prop.value, prop.value.value);
          }
        }
      },
    };
  },
};
