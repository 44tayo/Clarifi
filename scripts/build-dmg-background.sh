#!/bin/bash
# Build a full-bleed DMG window background (540×320) from the landscape source image.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
SOURCE="$ROOT/build/dmg-background-source.jpg"
OUT="$ROOT/build/dmg-background.png"
WIDTH=540
HEIGHT=320

if [[ ! -f "$SOURCE" ]]; then
  echo "Missing $SOURCE — add the DMG background source image" >&2
  exit 1
fi

mkdir -p "$ROOT/build"

if command -v magick &>/dev/null; then
  magick "$SOURCE" -resize "${WIDTH}x${HEIGHT}^" -gravity center -extent "${WIDTH}x${HEIGHT}" "$OUT"
elif command -v convert &>/dev/null; then
  convert "$SOURCE" -resize "${WIDTH}x${HEIGHT}^" -gravity center -extent "${WIDTH}x${HEIGHT}" "$OUT"
else
  # Fallback: sips center-crop via pad (no ImageMagick on runner).
  TMP="$(mktemp -t clarifi-dmg-src.XXXXXX).png"
  sips -s format png "$SOURCE" --out "$TMP" >/dev/null
  sips -z "$HEIGHT" "$WIDTH" "$TMP" --out "$OUT" >/dev/null 2>&1 || cp "$TMP" "$OUT"
  rm -f "$TMP"
fi

echo "DMG background written to $OUT"
