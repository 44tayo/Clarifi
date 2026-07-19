#!/bin/bash
set -euo pipefail

ARCH="${1:-arm64}"
if [[ "$ARCH" != "arm64" && "$ARCH" != "x64" ]]; then
  echo "Usage: build-mac-arch.sh [arm64|x64]"
  exit 1
fi

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

export MAC_TARGET_ARCH="$ARCH"
export CSC_IDENTITY_AUTO_DISCOVERY=false
export SKIP_NOTARIZE=1
export SKIP_AFTERPACK_SIGN=1
rm -f resources/audio-capture-helper

echo "Building Clarifi for macOS ($ARCH)..."
npm run prebuild:mac
npx tsc --noEmit
npx vite build

echo "Packaging app bundle (dir target)..."
npx electron-builder --mac --"$ARCH" --dir

APP_BUNDLE=""
for CANDIDATE in "${ROOT}/release/mac-${ARCH}/Clarifi.app" "${ROOT}/release/mac/Clarifi.app"; do
  if [[ -d "$CANDIDATE" ]]; then
    APP_BUNDLE="$CANDIDATE"
    break
  fi
done

if [[ -z "$APP_BUNDLE" ]]; then
  echo "ERROR: Clarifi.app not found under release/ after dir build" >&2
  exit 1
fi

bash "$ROOT/scripts/sign-and-dmg-mac-app.sh" "$APP_BUNDLE" "$ARCH"
