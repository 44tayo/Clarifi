#!/bin/bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

if [[ "$(uname)" != "Darwin" ]]; then
  echo "Skipping native stealth module (macOS only)"
  exit 0
fi

if [[ -z "${MAC_TARGET_ARCH:-}" ]] && { [[ -n "${SKIP_NATIVE_REBUILD:-}" ]] || [[ -f "$ROOT/resources/window_capture_exclude.node" ]]; }; then
  if [[ -f "$ROOT/resources/dictation_ptt.node" ]] || [[ "$(uname)" != "Darwin" && "$(uname)" != "MINGW"* ]]; then
    echo "Using committed native modules"
    exit 0
  fi
fi

ELECTRON_VERSION="$(node -p "require('electron/package.json').version")"
if [[ -n "${MAC_TARGET_ARCH:-}" ]]; then
  NODE_ARCH="$MAC_TARGET_ARCH"
elif [[ "$(uname -m)" == "arm64" ]]; then
  NODE_ARCH="arm64"
else
  NODE_ARCH="x64"
fi

mkdir -p resources

cd native
npx --yes node-gyp@10 rebuild \
  --target="$ELECTRON_VERSION" \
  --arch="$NODE_ARCH" \
  --dist-url=https://electronjs.org/headers

cp build/Release/window_capture_exclude.node "$ROOT/resources/window_capture_exclude.node"
if [[ -f build/Release/dictation_ptt.node ]]; then
  cp build/Release/dictation_ptt.node "$ROOT/resources/dictation_ptt.node"
fi
echo "Built resources/window_capture_exclude.node"
