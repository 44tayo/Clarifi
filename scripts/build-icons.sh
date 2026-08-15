#!/bin/bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
BUILD="$ROOT/build"
SOURCE="${1:-$BUILD/icon-source.png}"

if [[ ! -f "$SOURCE" ]]; then
  echo "Missing icon source: $SOURCE"
  exit 1
fi

mkdir -p "$BUILD/icon.iconset"
cp "$SOURCE" "$BUILD/icon-source.png"
sips -z 1024 1024 "$SOURCE" --out "$BUILD/icon.png" >/dev/null

sizes=(
  "16:icon_16x16.png"
  "32:icon_16x16@2x.png"
  "32:icon_32x32.png"
  "64:icon_32x32@2x.png"
  "128:icon_128x128.png"
  "256:icon_128x128@2x.png"
  "256:icon_256x256.png"
  "512:icon_256x256@2x.png"
  "512:icon_512x512.png"
  "1024:icon_512x512@2x.png"
)

for entry in "${sizes[@]}"; do
  size="${entry%%:*}"
  name="${entry##*:}"
  sips -z "$size" "$size" "$BUILD/icon.png" --out "$BUILD/icon.iconset/$name" >/dev/null
done

xattr -cr "$BUILD/icon.iconset" 2>/dev/null || true
iconutil -c icns "$BUILD/icon.iconset" -o "$BUILD/icon.icns"
npx --yes png-to-ico "$BUILD/icon.png" > "$BUILD/icon.ico"

echo "Icons written to $BUILD/icon.icns and $BUILD/icon.ico"
