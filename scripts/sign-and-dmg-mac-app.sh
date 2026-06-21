#!/bin/bash
# Ad-hoc sign a packed Clarifi.app and rebuild the DMG from the signed bundle.
set -euo pipefail

APP_PATH="${1:-}"
ARCH="${2:-arm64}"
if [[ -z "$APP_PATH" || ! -d "$APP_PATH" ]]; then
  echo "Usage: $0 /path/to/Clarifi.app [arm64|x64]"
  exit 1
fi

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
VERSION="$(node -p "require('$ROOT/package.json').version")"
SIGN_SCRIPT="$ROOT/scripts/adhoc-sign-mac-app.sh"

echo "Ad-hoc signing $APP_PATH..."
bash "$SIGN_SCRIPT" "$APP_PATH"

echo "Verifying signature..."
if ! codesign --verify --deep "$APP_PATH" 2>/dev/null; then
  echo "ERROR: codesign verify failed for $APP_PATH" >&2
  codesign --verify --deep --verbose=4 "$APP_PATH" 2>&1 || true
  exit 1
fi

echo "Creating DMG from signed app..."
export CSC_IDENTITY_AUTO_DISCOVERY=false
export SKIP_NOTARIZE=1
cd "$ROOT"
npx electron-builder --prepackaged="$(dirname "$APP_PATH")" --mac dmg --"$ARCH"

DMG="$ROOT/release/Clarifi-${VERSION}-${ARCH}.dmg"
if [[ ! -f "$DMG" ]]; then
  echo "ERROR: Expected DMG not found after rebuild: $DMG" >&2
  exit 1
fi

echo "Signed DMG ready: $DMG ($(du -h "$DMG" | cut -f1))"
