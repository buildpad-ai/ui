---
"@buildpad/ui-interfaces": minor
"@buildpad/cli": minor
---

Fix three interface bugs the revived test suites caught.

- **Tags**: pressing Enter split the typed tag on the letters E, n, t, e and r ("lowercase tag" became `low`, `cas`, `ag`). Mantine builds a regex character class from `splitChars`, and `'Enter'` was listed there as if it were a key name. Only `,` splits now; Enter still commits the tag.
- **Color**: a color could not be typed into the hex field of a controlled form. The field was bound to `value`, which only changes on a complete, valid hex, so every keystroke was discarded. The field now keeps its own draft, re-syncs when `value` changes, and drops an unfinished draft on blur.
- **Toggle**: with `showStateLabels`, the description and error text rendered twice.
