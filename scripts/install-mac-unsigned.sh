#!/bin/bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
APP_NAME="Clarifi.app"
TARGET_DIR="${HOME}/Applications"
TARGET_APP="${TARGET_DIR}/${APP_NAME}"
SOURCE_APP=""

if [[ -d "${ROOT}/release/mac-arm64/${APP_NAME}" ]]; then
  SOURCE_APP="${ROOT}/release/mac-arm64/${APP_NAME}"
elif [[ -d "/Applications/${APP_NAME}" ]]; then
  SOURCE_APP="/Applications/${APP_NAME}"
else
  DMG="$(ls -t "${ROOT}/release/"*.dmg 2>/dev/null | head -1)"
  if [[ -n "$DMG" ]]; then
    MOUNT="/tmp/clarifi-install-$$"
    mkdir -p "$MOUNT"
    hdiutil attach -nobrowse -quiet "$DMG" -mountpoint "$MOUNT"
    SOURCE_APP="${MOUNT}/${APP_NAME}"
    cp -R "$SOURCE_APP" "/tmp/${APP_NAME}"
    hdiutil detach "$MOUNT" -quiet 2>/dev/null || true
    SOURCE_APP="/tmp/${APP_NAME}"
  fi
fi

if [[ -z "$SOURCE_APP" || ! -d "$SOURCE_APP" ]]; then
  echo "ERROR: Could not find Clarifi.app. Run: npm run publish:mac:unsigned"
  exit 1
fi

echo "Stopping any running Clarifi processes..."
pkill -f "Clarifi.app/Contents/MacOS/Clarifi" 2>/dev/null || true
sleep 1

mkdir -p "$TARGET_DIR"
rm -rf "$TARGET_APP"
cp -R "$SOURCE_APP" "$TARGET_APP"
bash "$ROOT/scripts/adhoc-sign-mac-app.sh" "$TARGET_APP"

echo ""
echo "Installed to: $TARGET_APP"
echo ""
echo "IMPORTANT — first launch on macOS:"
echo "  1. Open Finder → Applications"
echo "  2. RIGHT-CLICK Clarifi → Open"
echo "  3. Click Open in the security dialog"
echo ""
echo "Requires macOS 13+. Pick Apple Silicon or Intel build to match your Mac."
