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
DMG="$ROOT/release/Clarifi-${VERSION}-${ARCH}.dmg"
APP_NAME="$(basename "$APP_PATH")"

echo "Ad-hoc signing $APP_PATH..."
bash "$SIGN_SCRIPT" "$APP_PATH"

echo "Verifying signature..."
if ! codesign --verify --deep "$APP_PATH" 2>/dev/null; then
  echo "ERROR: codesign verify failed for $APP_PATH" >&2
  codesign --verify --deep --verbose=4 "$APP_PATH" 2>&1 || true
  exit 1
fi

echo "Creating DMG from signed app..."
STAGE="$(mktemp -d "${TMPDIR:-/tmp}/clarifi-dmg.XXXXXX")"
trap 'rm -rf "$STAGE"' EXIT
ditto "$APP_PATH" "$STAGE/$APP_NAME"
ln -s /Applications "$STAGE/Applications"
rm -f "$DMG"
hdiutil create \
  -volname "Clarifi" \
  -srcfolder "$STAGE" \
  -ov \
  -format UDZO \
  "$DMG" >/dev/null

if [[ ! -f "$DMG" ]]; then
  echo "ERROR: Expected DMG not found after hdiutil create: $DMG" >&2
  exit 1
fi

# Standard drag-to-Applications window layout (best-effort).
MOUNT_POINT="$(mktemp -d "${TMPDIR:-/tmp}/clarifi-dmg-mount.XXXXXX")"
if hdiutil attach -nobrowse -quiet -mountpoint "$MOUNT_POINT" "$DMG"; then
  osascript <<EOF || true
tell application "Finder"
  set dmgFolder to POSIX file "$MOUNT_POINT" as alias
  tell folder dmgFolder
    open
    set w to container window
    set current view of w to icon view
    set toolbar visible of w to false
    set statusbar visible of w to false
    set bounds of w to {200, 120, 740, 440}
    set theViewOptions to icon view options of w
    set arrangement of theViewOptions to not arranged
    set icon size of theViewOptions to 96
    set position of item "$APP_NAME" to {140, 160}
    set position of item "Applications" to {400, 160}
    close
    open
    update without registering applications
    delay 1
  end tell
end tell
EOF
  hdiutil detach "$MOUNT_POINT" -quiet || hdiutil detach "$MOUNT_POINT" -force -quiet || true
fi
rm -rf "$MOUNT_POINT"

echo "Signed DMG ready: $DMG ($(du -h "$DMG" | cut -f1))"
