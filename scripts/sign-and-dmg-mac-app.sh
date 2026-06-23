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

echo "Creating branded DMG from signed app..."
bash "$ROOT/scripts/build-dmg-background.sh"

DMG_BACKGROUND="$ROOT/build/dmg-background.png"
if [[ ! -f "$DMG_BACKGROUND" ]]; then
  echo "ERROR: DMG background image missing: $DMG_BACKGROUND" >&2
  exit 1
fi

STAGE="$(mktemp -d "${TMPDIR:-/tmp}/clarifi-dmg.XXXXXX")"
RW_DMG="$(mktemp -t clarifi-rw.XXXXXX).dmg"
trap 'rm -rf "$STAGE" "$RW_DMG"' EXIT
ditto "$APP_PATH" "$STAGE/$APP_NAME"
ln -s /Applications "$STAGE/Applications"
mkdir -p "$STAGE/.background"
cp "$DMG_BACKGROUND" "$STAGE/.background/background.png"

rm -f "$DMG" "$RW_DMG"
hdiutil create -size 600m -fs HFS+ -volname "Clarifi" -ov "$RW_DMG" >/dev/null

MOUNT_POINT="$(mktemp -d "${TMPDIR:-/tmp}/clarifi-dmg-mount.XXXXXX")"
if hdiutil attach -readwrite -nobrowse -quiet -mountpoint "$MOUNT_POINT" "$RW_DMG"; then
  ditto "$STAGE/$APP_NAME" "$MOUNT_POINT/$APP_NAME"
  ln -s /Applications "$MOUNT_POINT/Applications"
  mkdir -p "$MOUNT_POINT/.background"
  cp "$DMG_BACKGROUND" "$MOUNT_POINT/.background/background.png"

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
    set background picture of theViewOptions to file ".background:background.png"
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

hdiutil convert "$RW_DMG" -format UDZO -imagekey zlib-level=9 -o "$DMG" >/dev/null

if [[ ! -f "$DMG" ]]; then
  echo "ERROR: Expected DMG not found after hdiutil convert: $DMG" >&2
  exit 1
fi

echo "Signed DMG ready: $DMG ($(du -h "$DMG" | cut -f1))"
