---
"@buildpad/cli": minor
"@buildpad/ui-collections": patch
"@buildpad/ui-cron": patch
"@buildpad/ui-form": patch
"@buildpad/ui-forms": patch
"@buildpad/ui-interfaces": patch
"@buildpad/ui-workflows": patch
---

Rebrand the design system to BuildPad "Ink & Ember", aligned with buildpad.ai. Default buttons are now ink pills and badges default to the light variant. The brand orange (`#fd7f15` / `#e86a00`) marks interactive state and focus. Neutrals are cool greys, and headings use Inter Tight. Mantine's built-in `red` / `green` / `yellow` / `blue` / `orange` hues now resolve to the semantic danger / success / warning / info / primary scales. Light, outline and dark-mode filled variants are tuned for WCAG AA. Adds `--ds-cta-*`, `--ds-focus-border`, `--ds-shadow-xs` and `--ds-letter-spacing-*` tokens; `--ds-brand-navy-*` remain as deprecated aliases. Existing apps pick it up with `buildpad upgrade --design`. Components that used blue for "selected" states now use the theme primary.

Theme fixes in the same release:
- Default tabs get a 1px hairline rail and a square-ended ember indicator.
- Every input, not just TextInput / NumberInput / Select, gets the shared field-label style.
- Subtle ActionIcons keep the neutral hover wash, and filled ones keep their own hover colour.
- Unchecked Checkbox / Radio stay visible in dark mode.
- Checked Checkbox.Card / Radio.Card get the ember selected wash.
- Pagination's first / previous / next / last controls have accessible names.
- The sign-in hero no longer mentions Tailwind slate.
