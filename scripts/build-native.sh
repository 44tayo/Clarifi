#!/bin/bash
# Native stealth/PTT modules were removed in the Granola rebuild.
# macOS system audio uses swift/AudioCapture instead.
set -euo pipefail

echo "Skipping legacy native modules (removed — audio uses Swift helper)"
