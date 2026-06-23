#!/bin/bash
# Build a DMG window background with the Clarifi logo centered on a dark canvas.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
ICON="$ROOT/build/icon.png"
OUT="$ROOT/build/dmg-background.png"
WIDTH=540
HEIGHT=320

if [[ ! -f "$ICON" ]]; then
  echo "Missing $ICON — run npm run build:icons first" >&2
  exit 1
fi

mkdir -p "$ROOT/build"

if command -v magick &>/dev/null; then
  magick -size "${WIDTH}x${HEIGHT}" "xc:#141820" \
    \( "$ICON" -resize 200x200 \) -gravity center -composite \
    "$OUT"
elif command -v convert &>/dev/null; then
  convert -size "${WIDTH}x${HEIGHT}" "xc:#141820" \
    \( "$ICON" -resize 200x200 \) -gravity center -composite \
    "$OUT"
else
  # Fallback: scaled logo fill (no ImageMagick on runner).
  sips -z "$HEIGHT" "$WIDTH" "$ICON" --out "$OUT" >/dev/null
fi

echo "DMG background written to $OUT"
