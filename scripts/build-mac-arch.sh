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
rm -f resources/audio-capture-helper resources/window_capture_exclude.node

echo "Building Clarifi for macOS ($ARCH)..."
npm run prebuild:mac
npx tsc --noEmit
npx vite build
npx electron-builder --mac --"$ARCH"
