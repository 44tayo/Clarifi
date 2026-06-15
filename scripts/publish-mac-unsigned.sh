#!/bin/bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

echo "Building unsigned macOS DMG..."
CSC_IDENTITY_AUTO_DISCOVERY=false SKIP_NOTARIZE=1 npm run build:mac

DMG="$(ls -t release/*.dmg 2>/dev/null | head -1)"
if [[ -z "$DMG" ]]; then
  echo "ERROR: No DMG found in release/"
  exit 1
fi

APP_BUNDLE="$(ls -d release/mac-arm64/Clarifi.app 2>/dev/null | head -1)"
if [[ -n "$APP_BUNDLE" ]]; then
  bash "$ROOT/scripts/adhoc-sign-mac-app.sh" "$APP_BUNDLE"
fi

WEB_DMG="$ROOT/web/public/downloads/Clarifi-0.1.0-arm64.dmg"
mkdir -p "$(dirname "$WEB_DMG")"
cp "$DMG" "$WEB_DMG"

echo "Published unsigned DMG:"
echo "  $WEB_DMG"
echo ""
echo "Apple Silicon (arm64) only. Users must drag to Applications, then:"
echo "  Right-click Clarifi → Open → Open (first launch only)"
