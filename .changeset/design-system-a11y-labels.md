---
"@buildpad/cli": patch
---

Accessibility fixes in the shipped theme and root layout (WCAG 2.2 AA):
- Coloured text (`<Text c="green">` and the other theme colours) uses the AA text stop in light mode, as it already did in dark mode. It was the fill stop (~3.2–3.8:1).
- Calendar days from the previous / next month are no longer faded to 50% opacity (~2.3:1); they use the placeholder colour (5.2:1 light).
- Date-picker header controls, TimePicker segments and the ColorInput eyedropper button get accessible names by default.
- The root layout no longer sets `user-scalable=no`, so pages can be pinch-zoomed.
