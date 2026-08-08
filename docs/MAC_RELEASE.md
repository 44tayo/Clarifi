# Mac release (signed + notarized)

Production Mac builds require Apple Developer credentials in GitHub Actions. Unsigned builds are uploaded as CI artifacts only — they must **not** be marked `latest` on GitHub Releases.

## GitHub Actions secrets

| Secret | Description |
|--------|-------------|
| `BUILD_CERTIFICATE_BASE64` | Base64-encoded `.p12` Developer ID Application certificate |
| `P12_PASSWORD` | Password for the `.p12` file |
| `APPLE_ID` | Apple ID email used for notarization |
| `APPLE_APP_SPECIFIC_PASSWORD` | App-specific password from appleid.apple.com |
| `APPLE_TEAM_ID` | Team ID (e.g. `UU8QN2X4GD`) |

Local signing: copy `.env.signing.example` → `.env.signing.local` and run `./scripts/setup-mac-signing.sh`, then `npm run build:mac:release`.

## Version sync checklist

When cutting a release, update **all** of these together:

1. [`package.json`](../package.json) `version`
2. [`web/src/lib/downloads.ts`](../web/src/lib/downloads.ts) — `CLARIFI_VERSION` and DMG/EXE filenames
3. Git tag `v{version}` (CI creates this on publish)
4. [`electron-builder.yml`](../electron-builder.yml) `publish.repo` — must match `GH_UPDATE_REPO` in [`.env.example`](../.env.example) (`Clarifi`)

## Auto-updater

Packaged apps use **electron-updater** against `https://github.com/44tayo/Clarifi/releases`. Override with `GH_UPDATE_OWNER` / `GH_UPDATE_REPO` at build time if needed.

Every **signed** GitHub Release marked `latest` must include:

| Asset | Role |
|--------|------|
| `Clarifi-{version}-arm64.dmg` | Website / first install |
| `Clarifi-{version}-arm64-mac.zip` | Updater install target |
| `Clarifi-{version}-arm64-mac.zip.blockmap` | Differential download |
| `latest-mac.yml` | Feed metadata (`path` must point at the zip) |

CI uploads these from `release/` on signed `publish-release` runs. Never mark unsigned builds as `latest`.

### E2E verify (vN → vN+1)

1. Install signed Clarifi **vN** from DMG into `/Applications`.
2. Bump `package.json` + `web/src/lib/downloads.ts`, tag/publish **vN+1** with zip + `latest-mac.yml`.
3. Launch vN → banner or **Settings → About & updates → Check for updates** → **Update** → **Restart now**.
4. Confirm **About** shows **vN+1**. Also: **Clarifi → Check for Updates…** in the macOS app menu.

## Verify before announcing

```bash
npm run verify:mac:dmg -- release/Clarifi-1.0.0-arm64.dmg
node scripts/verify-download-artifact.mjs \
  "https://github.com/44tayo/Clarifi/releases/download/v1.0.0/Clarifi-1.0.0-arm64.dmg" \
  50000000
node scripts/verify-download-artifact.mjs \
  "https://github.com/44tayo/Clarifi/releases/download/v1.0.0/latest-mac.yml" \
  100
node scripts/verify-download-artifact.mjs \
  "https://github.com/44tayo/Clarifi/releases/download/v1.0.0/Clarifi-1.0.0-arm64-mac.zip" \
  50000000
```

See [RELEASE_CHECKLIST.md](../RELEASE_CHECKLIST.md) for the full stranger test path.
