#!/bin/bash
# Build all Storybooks into a combined output directory for static hosting (e.g., AWS Amplify)
#
# Output structure:
#   storybook-dist/
#   ├── index.html          ← Landing page with links to all 6
#   ├── interfaces/         ← ui-interfaces Storybook
#   ├── form/               ← ui-form Storybook
#   ├── forms/              ← ui-forms Storybook (form builder)
#   ├── table/              ← ui-table Storybook
#   ├── collections/        ← ui-collections Storybook
#   └── files/              ← ui-files Storybook

set -euo pipefail

# Increase Node.js memory for CI environments (Amplify Standard has 8 GiB)
export NODE_OPTIONS="--max-old-space-size=4096"

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
OUTPUT_DIR="${ROOT_DIR}/apps/storybook-host/public/storybook"

echo "🏗️  Building all Storybooks..."
echo "   Output: ${OUTPUT_DIR}"
echo ""

# Clean output directory
rm -rf "${OUTPUT_DIR}"
mkdir -p "${OUTPUT_DIR}"

# Build ui-interfaces Storybook
echo "📦 [1/6] Building ui-interfaces Storybook..."
cd "${ROOT_DIR}/packages/ui-interfaces"
npx storybook build -o "${OUTPUT_DIR}/interfaces" 2>&1 || {
  echo "❌ ui-interfaces Storybook build failed"
  exit 1
}
echo "   ✅ ui-interfaces done"

# Build ui-form Storybook
echo "📦 [2/6] Building ui-form Storybook..."
cd "${ROOT_DIR}/packages/ui-form"
npx storybook build -o "${OUTPUT_DIR}/form" 2>&1 || {
  echo "❌ ui-form Storybook build failed"
  exit 1
}
echo "   ✅ ui-form done"

# Build ui-forms Storybook (form builder)
echo "📦 [3/6] Building ui-forms Storybook..."
cd "${ROOT_DIR}/packages/ui-forms"
npx storybook build -o "${OUTPUT_DIR}/forms" 2>&1 || {
  echo "❌ ui-forms Storybook build failed"
  exit 1
}
echo "   ✅ ui-forms done"

# Build ui-table Storybook
echo "📦 [4/6] Building ui-table Storybook..."
cd "${ROOT_DIR}/packages/ui-table"
npx storybook build -o "${OUTPUT_DIR}/table" 2>&1 || {
  echo "❌ ui-table Storybook build failed"
  exit 1
}
echo "   ✅ ui-table done"

# Build ui-collections Storybook
echo "📦 [5/6] Building ui-collections Storybook..."
cd "${ROOT_DIR}/packages/ui-collections"
npx storybook build -o "${OUTPUT_DIR}/collections" 2>&1 || {
  echo "❌ ui-collections Storybook build failed"
  exit 1
}
echo "   ✅ ui-collections done"

# Build ui-files Storybook
echo "📦 [6/6] Building ui-files Storybook..."
cd "${ROOT_DIR}/packages/ui-files"
npx storybook build -o "${OUTPUT_DIR}/files" 2>&1 || {
  echo "❌ ui-files Storybook build failed"
  exit 1
}
echo "   ✅ ui-files done"

# No landing page needed — the Next.js host app serves as the landing page

echo ""
echo "🎉 All Storybooks built successfully!"
echo "   📁 ${OUTPUT_DIR}/"
echo "   ├── interfaces/      (40+ field components)"
echo "   ├── form/            (VForm dynamic form)"
echo "   ├── forms/           (form builder)"
echo "   ├── table/           (VTable dynamic table)"
echo "   ├── collections/     (CollectionForm & CollectionList)"
echo "   └── files/           (file manager components)"
echo ""
echo "   Served by the Next.js host app at /storybook/*"
echo "   To preview: pnpm build:host && pnpm start:host"
