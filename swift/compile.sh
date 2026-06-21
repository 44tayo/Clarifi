#!/bin/bash
set -e

if [[ "$(uname)" != "Darwin" ]]; then
  echo "Skipping Swift audio helper (macOS only)"
  exit 0
fi

if [[ -n "${MAC_TARGET_ARCH:-}" ]]; then
  if [[ "$MAC_TARGET_ARCH" == "x64" ]]; then
    TARGET="x86_64-apple-macosx13.0"
  else
    TARGET="arm64-apple-macosx13.0"
  fi
else
  ARCH=$(uname -m)
  if [ "$ARCH" = "arm64" ]; then
    TARGET="arm64-apple-macosx13.0"
  else
    TARGET="x86_64-apple-macosx13.0"
  fi
fi

mkdir -p resources

swiftc swift/AudioCapture.swift \
  -framework ScreenCaptureKit \
  -framework CoreMedia \
  -framework AVFoundation \
  -framework Foundation \
  -o resources/audio-capture-helper \
  -target "$TARGET"

echo "Compiled successfully"
