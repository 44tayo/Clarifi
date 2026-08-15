#!/bin/bash
# CI-only macOS build: one arch, no website publish step.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

ARCH="${MAC_CI_ARCH:-arm64}"
echo "=== CI macOS build ($ARCH) ==="

CSC_IDENTITY_AUTO_DISCOVERY=false SKIP_NOTARIZE=1 bash "$ROOT/scripts/build-mac-arch.sh" "$ARCH"

VERSION="$(node -p "require('./package.json').version")"
DMG="$ROOT/release/Clarifi-${VERSION}-${ARCH}.dmg"
if [[ ! -f "$DMG" ]]; then
  echo "ERROR: Expected DMG not found: $DMG" >&2
  exit 1
fi

node "$ROOT/scripts/verify-mac-dmg-signed.mjs" "$DMG"
echo "CI macOS build verified: $DMG"
