#!/bin/bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

echo "=== Clarifi Mac code signing setup ==="
echo ""

if security find-identity -v -p codesigning | grep -q "Developer ID Application"; then
  echo "✓ Developer ID Application certificate found."
else
  echo "1. Create a Developer ID Application certificate (one-time):"
  echo "   • Open Xcode → Settings (⌘,) → Accounts"
  echo "   • Select tayowills@icloud.com → Manage Certificates"
  echo "   • Click + → Developer ID Application"
  echo ""
  open -a Xcode 2>/dev/null || true
  open "https://developer.apple.com/help/account/create-developer-id-certificates/" 2>/dev/null || true
  read -r -p "Press Enter after the certificate appears in Manage Certificates..."
  if ! security find-identity -v -p codesigning | grep -q "Developer ID Application"; then
    echo "ERROR: Still no Developer ID Application certificate. Try again."
    exit 1
  fi
  echo "✓ Certificate installed."
fi

echo ""
echo "2. App-specific password for notarization:"
echo "   • https://appleid.apple.com/account/manage → App-Specific Passwords"
open "https://appleid.apple.com/account/manage" 2>/dev/null || true

read -r -p "Apple ID [tayowills@icloud.com]: " APPLE_ID
APPLE_ID="${APPLE_ID:-tayowills@icloud.com}"
read -r -s -p "App-specific password: " APPLE_APP_SPECIFIC_PASSWORD
echo ""

cat > .env.signing.local <<EOF
APPLE_ID=$APPLE_ID
APPLE_APP_SPECIFIC_PASSWORD=$APPLE_APP_SPECIFIC_PASSWORD
APPLE_TEAM_ID=UU8QN2X4GD
EOF
chmod 600 .env.signing.local
echo "✓ Wrote .env.signing.local"

echo ""
echo "3. Building signed + notarized release..."
npm run build:mac:release
