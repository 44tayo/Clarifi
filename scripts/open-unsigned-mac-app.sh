#!/bin/bash
set -euo pipefail

# Opens an unsigned / pre-notarization Clarifi build on macOS.
# Clears quarantine and ad-hoc signs so Launch Services can start the app.

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
APP_PATH="${1:-}"

if [[ -z "$APP_PATH" ]]; then
  if [[ -d "$ROOT/release/mac-arm64/Clarifi.app" ]]; then
    APP_PATH="$ROOT/release/mac-arm64/Clarifi.app"
  elif [[ -d "/Applications/Clarifi.app" ]]; then
    APP_PATH="/Applications/Clarifi.app"
  elif [[ -d "$HOME/Applications/Clarifi.app" ]]; then
    APP_PATH="$HOME/Applications/Clarifi.app"
  else
    echo "Usage: $0 [/path/to/Clarifi.app]"
    echo ""
    echo "Could not find Clarifi.app automatically."
    echo "Drag Clarifi from the DMG into Applications, then run:"
    echo "  $0 /Applications/Clarifi.app"
    exit 1
  fi
fi

if [[ ! -d "$APP_PATH" ]]; then
  echo "ERROR: Not found: $APP_PATH"
  exit 1
fi

echo "Stopping stuck Clarifi processes..."
pkill -f "Clarifi.app/Contents/MacOS/Clarifi" 2>/dev/null || true
sleep 1

echo "Clearing quarantine and ad-hoc signing: $APP_PATH"
xattr -dr com.apple.quarantine "$APP_PATH" 2>/dev/null || true
bash "$ROOT/scripts/adhoc-sign-mac-app.sh" "$APP_PATH"

echo "Opening Clarifi..."
echo "If nothing appears: Finder → right-click Clarifi.app → Open → Open."
open "$APP_PATH" 2>/dev/null || true
