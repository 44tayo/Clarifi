#!/bin/bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

VERSION="$(node -p "require('./package.json').version")"

for ARCH in arm64 x64; do
  echo ""
  echo "=== Building signed unsigned macOS DMG ($ARCH) ==="
  CSC_IDENTITY_AUTO_DISCOVERY=false SKIP_NOTARIZE=1 bash "$ROOT/scripts/build-mac-arch.sh" "$ARCH"

  DMG="$ROOT/release/Clarifi-${VERSION}-${ARCH}.dmg"
  if [[ ! -f "$DMG" ]]; then
    echo "ERROR: Expected DMG not found: $DMG"
    exit 1
  fi

  echo "Verifying DMG before publish..."
  node "$ROOT/scripts/verify-mac-dmg-signed.mjs" "$DMG"
  echo "Built: $DMG ($(du -h "$DMG" | cut -f1))"
done

echo ""
echo "DMGs ready under release/ — upload via GitHub Releases (CI publish-release job)."
