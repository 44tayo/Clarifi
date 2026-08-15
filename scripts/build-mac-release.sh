#!/bin/bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

SIGNING_ENV="$ROOT/.env.signing.local"
if [[ -f "$SIGNING_ENV" ]]; then
  set -a
  # shellcheck disable=SC1090
  source "$SIGNING_ENV"
  set +a
fi

if ! security find-identity -v -p codesigning | grep -q "Developer ID Application"; then
  echo "ERROR: No 'Developer ID Application' certificate in your keychain."
  echo ""
  echo "Create one in Xcode (one-time):"
  echo "  Xcode → Settings (⌘,) → Accounts → tayowills@icloud.com"
  echo "  → Manage Certificates → + → Developer ID Application"
  echo ""
  echo "Then re-run: npm run build:mac:release"
  exit 1
fi

if [[ -z "${APPLE_ID:-}" || -z "${APPLE_APP_SPECIFIC_PASSWORD:-}" || -z "${APPLE_TEAM_ID:-}" ]]; then
  if [[ -z "${APPLE_API_KEY:-}" || -z "${APPLE_API_KEY_ID:-}" || -z "${APPLE_API_ISSUER:-}" ]]; then
    echo "ERROR: Notarization credentials missing."
    echo "Add APPLE_ID, APPLE_APP_SPECIFIC_PASSWORD, and APPLE_TEAM_ID to .env.signing.local"
    echo "See .env.signing.example"
    exit 1
  fi
fi

DEV_ID="$(security find-identity -v -p codesigning | grep 'Developer ID Application' | head -1 | sed -E 's/.*\"([^\"]+)\"/\1/')"
export CSC_NAME="$DEV_ID"
export CSC_IDENTITY_AUTO_DISCOVERY=false

echo "Signing with: $CSC_NAME"
echo "Building signed + notarized Clarifi for macOS..."
npm run build:mac

DMG="$(ls -t release/*.dmg 2>/dev/null | head -1)"
if [[ -z "$DMG" ]]; then
  echo "ERROR: No DMG found in release/"
  exit 1
fi

echo "Verifying signature..."
codesign -dv --verbose=2 "$DMG" 2>&1 | head -5 || true

MOUNT="/tmp/clarifi-verify-$$"
hdiutil attach -nobrowse -quiet "$DMG" -mountpoint "$MOUNT"
spctl -a -vv -t install "$MOUNT/Clarifi.app" || true
hdiutil detach "$MOUNT" -quiet 2>/dev/null || true

echo "Verifying distributable DMG..."
DEBUG_RUN_ID="${DEBUG_RUN_ID:-release}" node scripts/verify-mac-dmg.mjs "$DMG"

WEB_DMG="$ROOT/web/public/downloads/Clarifi-0.1.0-arm64.dmg"
REPO_WEB_DMG="$(cd "$ROOT/.." && pwd)/web/public/downloads/Clarifi-0.1.0-arm64.dmg"
mkdir -p "$(dirname "$WEB_DMG")" "$(dirname "$REPO_WEB_DMG")"
cp "$DMG" "$WEB_DMG"
cp "$DMG" "$REPO_WEB_DMG"
echo "Published to $WEB_DMG ($(du -h "$WEB_DMG" | cut -f1))"
echo "Published to $REPO_WEB_DMG ($(du -h "$REPO_WEB_DMG" | cut -f1))"
