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

CREATE_DMG="$ROOT/scripts/create-dmg"
if [[ ! -x "$CREATE_DMG" ]]; then
  echo "Fetching create-dmg helper..."
  curl -fsSL "https://raw.githubusercontent.com/create-dmg/create-dmg/v1.2.1/create-dmg" -o "$CREATE_DMG"
  chmod +x "$CREATE_DMG"
fi

STAGE="$(mktemp -d "${TMPDIR:-/tmp}/clarifi-dmg.XXXXXX")"
trap 'rm -rf "$STAGE"' EXIT
ditto "$APP_PATH" "$STAGE/$APP_NAME"

rm -f "$DMG"
"$CREATE_DMG" \
  --volname "Clarifi" \
  --background "$DMG_BACKGROUND" \
  --window-pos 200 120 \
  --window-size 540 320 \
  --icon-size 96 \
  --icon "$APP_NAME" 140 160 \
  --app-drop-link 400 160 \
  --no-internet-enable \
  "$DMG" \
  "$STAGE" >/dev/null

if [[ ! -f "$DMG" ]]; then
  echo "ERROR: Expected DMG not found after create-dmg: $DMG" >&2
  exit 1
fi

echo "Signed DMG ready: $DMG ($(du -h "$DMG" | cut -f1))"
