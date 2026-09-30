---
"@buildpad/ui-interfaces": minor
"@buildpad/mcp": minor
"@buildpad/cli": minor
---

Dependency security upgrades.

`pnpm audit --prod` reported 125 advisories (3 critical, 58 high); it now reports none apart from one documented exception.

- The CLI installs `@tiptap/*` ^3.31.4 (was ^3.13.0), `axios` ^1.20.0 (was ^1.6.0), `@mapbox/mapbox-gl-draw` ^1.5.2 and `dompurify` ^3.4.16 for the components that use them.
- `@buildpad/mcp` moves to `@modelcontextprotocol/sdk` 1.x (was 0.5).
- `maplibre-gl` stays on 5.x: its critical attribution XSS (GHSA-jrc7-96c5-q579) is fixed only in v6, which needs bundler worker setup in every app. Until then the map interface sanitizes basemap `attribution` with DOMPurify, the only way untrusted HTML reaches maplibre. `buildpad add map-with-real-map` now installs `dompurify`.
