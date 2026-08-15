#!/bin/bash
# Build native dictation_ptt on Windows CI (macOS uses build-mac-arch / build-native.sh).
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

ELECTRON_VERSION="$(node -p "require('electron/package.json').version")"
mkdir -p resources

cd native
npx --yes node-gyp@10 rebuild \
  --target="$ELECTRON_VERSION" \
  --arch=x64 \
  --dist-url=https://electronjs.org/headers

if [[ -f build/Release/dictation_ptt.node ]]; then
  cp build/Release/dictation_ptt.node "$ROOT/resources/dictation_ptt.node"
  echo "Built resources/dictation_ptt.node (Windows)"
fi
