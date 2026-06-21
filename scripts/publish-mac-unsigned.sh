#!/bin/bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

VERSION="$(node -p "require('./package.json').version")"
DOWNLOADS_DIR="$ROOT/web/public/downloads"
mkdir -p "$DOWNLOADS_DIR"

for ARCH in arm64 x64; do
  echo ""
  echo "=== Building unsigned macOS DMG ($ARCH) ==="
  CSC_IDENTITY_AUTO_DISCOVERY=false SKIP_NOTARIZE=1 bash "$ROOT/scripts/build-mac-arch.sh" "$ARCH"

  DMG="$ROOT/release/Clarifi-${VERSION}-${ARCH}.dmg"
  if [[ ! -f "$DMG" ]]; then
    echo "ERROR: Expected DMG not found: $DMG"
    exit 1
  fi

  APP_BUNDLE=""
  for CANDIDATE in "${ROOT}/release/mac-${ARCH}/Clarifi.app" "${ROOT}/release/mac/Clarifi.app"; do
    if [[ -d "$CANDIDATE" ]]; then
      APP_BUNDLE="$CANDIDATE"
      break
    fi
  done
  WEB_DMG="$DOWNLOADS_DIR/Clarifi-${VERSION}-${ARCH}.dmg"
  cp "$DMG" "$WEB_DMG"

  if [[ -n "$APP_BUNDLE" ]]; then
    bash "$ROOT/scripts/adhoc-sign-mac-app.sh" "$APP_BUNDLE"
  fi
  echo "Published: $WEB_DMG ($(du -h "$WEB_DMG" | cut -f1))"
done

echo ""
echo "Published Apple Silicon + Intel Mac DMGs to $DOWNLOADS_DIR"
echo "Users must drag to Applications, then right-click Clarifi → Open (first launch)."
