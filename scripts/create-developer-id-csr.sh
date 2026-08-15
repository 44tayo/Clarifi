#!/bin/bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
OUT="$ROOT/build/developer-id-csr"
mkdir -p "$OUT"

KEY="$OUT/private.key"
CSR="$OUT/request.certSigningRequest"

if [[ -f "$CSR" ]]; then
  echo "CSR already exists: $CSR"
else
  openssl req -new -newkey rsa:2048 -nodes \
    -keyout "$KEY" \
    -out "$CSR" \
    -subj "/emailAddress=tayowilliams23@gmail.com/CN=Developer ID Application: Tayo/O=Tayo/C=US"
  chmod 600 "$KEY"
  echo "Created CSR: $CSR"
fi

echo ""
echo "Next steps (one-time):"
echo "1. Open https://developer.apple.com/account/resources/certificates/add"
echo "2. Choose Developer ID Application → G2 Sub-CA"
echo "3. Upload: $CSR"
echo "4. Download the .cer file, then run:"
echo "   security import ~/Downloads/developerID_application.cer -k ~/Library/Keychains/login.keychain-db -T /usr/bin/codesign"
echo "5. Copy .env.signing.example → .env.signing.local and add your app-specific password"
echo "6. npm run build:mac:release"
echo ""

open "https://developer.apple.com/account/resources/certificates/add" 2>/dev/null || true
open "$OUT" 2>/dev/null || true
