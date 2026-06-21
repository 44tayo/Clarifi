#!/bin/bash
# Ad-hoc sign a Clarifi.app bundle so macOS Launch Services can open unsigned builds.
set -euo pipefail

APP_PATH="${1:-}"
if [[ -z "$APP_PATH" || ! -d "$APP_PATH" ]]; then
  echo "Usage: $0 /path/to/Clarifi.app"
  exit 1
fi

# macOS re-applies com.apple.provenance on Desktop/Downloads paths and breaks codesign.
# Stage to $TMPDIR, sign there, then copy the signed bundle back.
if [[ "${CLARIFI_SIGN_IN_TMP:-}" != "1" ]]; then
  STAGE="$(mktemp -d "${TMPDIR:-/tmp}/clarifi-sign.XXXXXX")"
  STAGE_APP="$STAGE/$(basename "$APP_PATH")"
  ditto "$APP_PATH" "$STAGE_APP"
  CLARIFI_SIGN_IN_TMP=1 bash "$0" "$STAGE_APP"
  EC=$?
  if [[ $EC -eq 0 ]]; then
    rm -rf "$APP_PATH"
    ditto "$STAGE_APP" "$APP_PATH"
  fi
  rm -rf "$STAGE"
  exit $EC
fi

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
ENTITLEMENTS="$ROOT/build/entitlements.mac.plist"
ENT_ARGS=()
if [[ -f "$ENTITLEMENTS" ]]; then
  ENT_ARGS=(--entitlements "$ENTITLEMENTS")
fi

strip_detritus() {
  local target="$1"
  [[ -e "$target" ]] || return 0

  if [[ -f "$target" ]]; then
    local tmp
    tmp="$(mktemp)"
    COPYFILE_DISABLE=1 ditto --norsrc --noextattr "$target" "$tmp" 2>/dev/null || \
      COPYFILE_DISABLE=1 cp -X "$target" "$tmp" 2>/dev/null || \
      cat "$target" > "$tmp"
    chmod "$(stat -f %Lp "$target")" "$tmp"
    mv "$tmp" "$target"
  fi

  xattr -cr "$target" 2>/dev/null || true
  local attr
  while IFS= read -r attr; do
    [[ -n "$attr" ]] || continue
    xattr -d "$attr" "$target" 2>/dev/null || true
  done < <(xattr "$target" 2>/dev/null || true)
}

echo "Stripping extended attributes and resource forks in $APP_PATH..."
dot_clean -m "$APP_PATH" 2>/dev/null || true
xattr -cr "$APP_PATH" 2>/dev/null || true

while IFS= read -r -d '' file; do
  strip_detritus "$file"
done < <(
  find "$APP_PATH" -type f \( -perm -111 -o -name "*.dylib" -o -name "*.node" \) -print0 2>/dev/null
)

sign_target() {
  local target="$1"
  [[ -e "$target" ]] || return 0
  strip_detritus "$target"
  codesign --remove-signature "$target" 2>/dev/null || true
  if ! codesign --force --sign - "${ENT_ARGS[@]}" "$target" 2>/dev/null; then
    if ! codesign --force --sign - "$target"; then
      echo "ERROR: codesign failed for $target" >&2
      exit 1
    fi
  fi
}

# Inside-out: binaries and helpers before frameworks, then the top-level app.
if [[ -d "$APP_PATH/Contents/Frameworks" ]]; then
  while IFS= read -r -d '' bin; do
    sign_target "$bin"
  done < <(find "$APP_PATH/Contents/Frameworks" -depth -type f \( -perm -111 -o -name "*.dylib" -o -name "*.node" \) -print0 2>/dev/null)
  while IFS= read -r -d '' framework; do
    sign_target "$framework"
  done < <(find "$APP_PATH/Contents/Frameworks" -depth \( -name "*.framework" -o -name "*.app" \) -print0 2>/dev/null)
fi

if [[ -d "$APP_PATH/Contents/Resources" ]]; then
  while IFS= read -r -d '' helper; do
    sign_target "$helper"
  done < <(find "$APP_PATH/Contents/Resources" -maxdepth 2 -type f \( -name "*.node" -o -perm -111 \) -print0 2>/dev/null)
  if [[ -d "$APP_PATH/Contents/Resources/audio-capture-helper" ]]; then
    sign_target "$APP_PATH/Contents/Resources/audio-capture-helper"
  fi
fi

MAIN_BIN="$APP_PATH/Contents/MacOS/Clarifi"
if [[ -f "$MAIN_BIN" ]]; then
  sign_target "$MAIN_BIN"
fi

sign_target "$APP_PATH"

if ! codesign --verify --deep "$APP_PATH" 2>/dev/null; then
  echo "WARNING: codesign verify reported issues for $APP_PATH" >&2
  exit 1
fi

echo "Ad-hoc signed: $APP_PATH"
