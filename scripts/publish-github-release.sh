#!/bin/bash
# Upload local release/ DMGs and Windows installer to GitHub Releases (v0.1.0).
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

VERSION="$(node -p "require('./package.json').version")"
TAG="v${VERSION}"
RELEASE_DIR="$ROOT/release"

if ! command -v gh >/dev/null 2>&1; then
  echo "ERROR: gh CLI required. Run: gh auth login" >&2
  exit 1
fi

if ! gh auth status >/dev/null 2>&1; then
  echo "ERROR: gh not authenticated. Run: gh auth login" >&2
  exit 1
fi

ASSETS=()
for FILE in \
  "$RELEASE_DIR/Clarifi-${VERSION}-arm64.dmg" \
  "$RELEASE_DIR/Clarifi-${VERSION}-x64.dmg" \
  "$RELEASE_DIR/Clarifi Setup ${VERSION}.exe"; do
  if [[ -f "$FILE" ]]; then
    ASSETS+=("$FILE")
    echo "Including: $FILE ($(du -h "$FILE" | cut -f1))"
  fi
done

if [[ ${#ASSETS[@]} -eq 0 ]]; then
  echo "ERROR: No release assets found under $RELEASE_DIR" >&2
  exit 1
fi

echo "Creating/updating GitHub release $TAG..."
gh release upload "$TAG" "${ASSETS[@]}" --clobber 2>/dev/null || \
  gh release create "$TAG" "${ASSETS[@]}" \
    --title "Clarifi ${VERSION}" \
    --notes "Clarifi ${VERSION} desktop installers"

ARM_URL="https://github.com/44tayo/Clarifi/releases/download/${TAG}/Clarifi-${VERSION}-arm64.dmg"
echo ""
echo "Verifying arm64 DMG URL..."
node "$ROOT/scripts/verify-download-artifact.mjs" "$ARM_URL" 50000000 || true

echo ""
echo "Release published: https://github.com/44tayo/Clarifi/releases/tag/${TAG}"
