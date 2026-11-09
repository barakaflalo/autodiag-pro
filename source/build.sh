#!/usr/bin/env bash
# Build AutoDiag Pro for Cloudflare Pages / GitHub.
# Output: dist/ (upload its contents to the root of the repo).
set -euo pipefail
cd "$(dirname "$0")"

V_APP=$(grep -oP 'const APP_VERSION = "\K[^"]+' src/App.jsx)
V_PKG=$(node -p "require('./package.json').version")
V_MAN=$(node -p "require('./public/manifest.json').version")
if [ "$V_APP" != "$V_PKG" ] || [ "$V_APP" != "$V_MAN" ]; then
  echo "Version mismatch: App=$V_APP package=$V_PKG manifest=$V_MAN"; exit 1
fi

npx vite build

ASSETS=$(cd dist && find assets -type f | sort | sed 's#^#"./#; s#$#"#' | paste -sd, -)
PRECACHE="[\"./\",\"./manifest.json\",\"./icon.svg\",\"./icon-192.png\",\"./icon-512.png\",${ASSETS}]"
sed -e "s#__VERSION__#${V_APP}#" -e "s#__PRECACHE__#${PRECACHE}#" sw.template.js > dist/sw.js
touch dist/.nojekyll
echo "Built v${V_APP}: $(ls dist/assets)"
