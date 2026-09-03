#!/usr/bin/env bash
# End-to-end check of the locale-prefixed scaffold (docs/I18N_PLAN.md, A7).
#
# Bootstraps a fresh app from the LOCAL CLI build with two locales, runs
# `next build`, starts it, and asserts the middleware contract with curl:
#   /                        → 307 /en            (default locale)
#   / + Accept-Language: id  → 307 /id            (negotiated)
#   /login + NEXT_LOCALE=id  → 307 /id/login      (cookie wins over the header)
#   /xx/login                → ends in 404        (unknown segment is prefixed, then 404s)
#   /en/login                → 200, <html lang="en" dir="ltr">
#   /id/login                → 200, <html lang="id" …>
#   /api/*                   → never redirected
#
# Needs network for `pnpm install` inside the scaffold. Not part of `pnpm test`
# (≈3 minutes); run it before a CLI release:
#
#   bash packages/cli/tests/e2e/bootstrap-i18n.sh [work-dir]
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../../../.." && pwd)"
WORK="${1:-$(mktemp -d)}/i18n-e2e-app"
PORT="${PORT:-3977}"

rm -rf "$WORK" && mkdir -p "$WORK"
echo "▶ building CLI"
(cd "$ROOT" && pnpm --filter @buildpad/cli build >/dev/null)

echo "▶ bootstrap --locales en,id → $WORK"
node "$ROOT/packages/cli/dist/index.js" bootstrap --cwd "$WORK" --locales en,id --default-locale en >"$WORK.bootstrap.log" 2>&1

test ! -e "$WORK/app/layout.tsx"            || { echo "✗ app/layout.tsx must not exist"; exit 1; }
test -f "$WORK/app/[lang]/layout.tsx"        || { echo "✗ app/[lang]/layout.tsx missing"; exit 1; }
test -f "$WORK/app/[lang]/login/page.tsx"    || { echo "✗ login page not under [lang]"; exit 1; }
test -f "$WORK/lib/i18n/dictionaries/id.json" || { echo "✗ id.json not seeded"; exit 1; }
grep -q 'export const locales = \["en", "id"\] as const;' "$WORK/lib/i18n/config.ts" || { echo "✗ locales not applied"; exit 1; }
node -e "JSON.parse(require('fs').readFileSync('$WORK/lib/i18n/dictionaries/en.json','utf8'))" || { echo "✗ en.json is not valid JSON"; exit 1; }
echo "✓ scaffold shape"

echo "▶ next build"
(cd "$WORK" && pnpm exec next build >"$WORK.build.log" 2>&1) || { tail -40 "$WORK.build.log"; exit 1; }
echo "✓ next build"

echo "▶ next start -p $PORT"
(cd "$WORK" && pnpm exec next start -p "$PORT" >"$WORK.start.log" 2>&1 &)
trap 'pkill -f "next start -p $PORT" || true' EXIT
curl -s --retry 30 --retry-connrefused --retry-delay 1 -o /dev/null "http://localhost:$PORT/en/login"

expect_redirect() { # url expected-location [curl args…]
  local url="$1" want="$2"; shift 2
  local got
  got=$(curl -s -o /dev/null -w "%{http_code} %{redirect_url}" "$@" "$url")
  [[ "$got" == "307 http://localhost:$PORT$want" ]] || { echo "✗ $url → $got (want 307 $want)"; exit 1; }
  echo "✓ $url → $want"
}
expect_redirect "http://localhost:$PORT/" "/en"
expect_redirect "http://localhost:$PORT/" "/id" -H "Accept-Language: id-ID,id;q=0.9,en;q=0.5"
expect_redirect "http://localhost:$PORT/login?next=x" "/id/login?next=x" -H "Accept-Language: en" -H "Cookie: NEXT_LOCALE=id"

final=$(curl -s -L -o /dev/null -w "%{http_code}" "http://localhost:$PORT/xx/login")
[[ "$final" == "404" ]] || { echo "✗ /xx/login ended in $final (want 404)"; exit 1; }
echo "✓ /xx/login → 404"

for lang in en id; do
  html=$(curl -s "http://localhost:$PORT/$lang/login")
  grep -q "<html lang=\"$lang\" dir=\"ltr\"" <<<"$html" || { echo "✗ /$lang/login lacks <html lang=\"$lang\" dir=\"ltr\">"; exit 1; }
  echo "✓ /$lang/login renders lang=$lang"
done

api=$(curl -s -o /dev/null -w "%{http_code} %{redirect_url}" "http://localhost:$PORT/api/permissions/me")
[[ "$api" != 307* ]] || { echo "✗ /api/* was redirected: $api"; exit 1; }
echo "✓ /api/* not redirected"

echo "✅ i18n scaffold e2e passed ($WORK)"
