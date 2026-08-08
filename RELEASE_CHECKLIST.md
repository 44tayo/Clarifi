# Clarifi Mac v1 — release checklist

Run this on a **clean Mac** that has never cloned the repo. Treat every failure as a ship blocker.

## Download and install

- [ ] Download DMG from clarifiapp.com (or GitHub Releases URL from downloads page)
- [ ] Install to Applications (not from mounted DMG)
- [ ] First open: right-click → Open if Gatekeeper prompts (signed builds should pass after one approval)
- [ ] App launches without developer terminal commands

## Onboarding and pairing

- [ ] Welcome → Connect step shows Google + Microsoft + email
- [ ] Google sign-in completes in browser (fix OAuth if `deleted_client` — see [docs/OAUTH_SETUP.md](docs/OAUTH_SETUP.md))
- [ ] Microsoft sign-in returns email (fix Entra claims if missing)
- [ ] Browser `/desktop/connect` shows success; desktop continues automatically
- [ ] Skip path copy says recording works locally; connect needed for AI summary
- [ ] Mic permission granted; system audio permission granted (macOS Screen Recording)

## Core loop

- [ ] New meeting → Start recording
- [ ] Floating widget visible during capture
- [ ] Scratchpad notes persist during call
- [ ] Stop recording → processing → summary within ~60s
- [ ] Summary | Transcript | Scratchpad tabs all work
- [ ] Quit and reopen — meeting still present

## Edge cases

- [ ] Skip onboarding → record → stop → connect prompt → pair → summary generates
- [ ] Offline during enhance → error message → reconnect → retry succeeds
- [ ] Free tier: meeting older than 30 days shows upgrade path, not content

## Web / trust

- [ ] `/trust` and `/privacy` load without sign-in
- [ ] `/desktop/auth` loads without sign-in (OAuth kickoff)
- [ ] Download help page shows install + pair steps (no broken images)
- [ ] FAQ/pricing do not claim unshipped features (dictation, templates, iOS). Calendar, Ask AI, and sharing may be claimed when live.

## Updates

- [ ] Latest GitHub Release includes `latest-mac.yml`, `Clarifi-*-arm64-mac.zip`, zip `.blockmap`, and DMG
- [ ] Installed vN shows in-app banner or Settings **About & updates** for vN+1
- [ ] **Update** → download → **Restart now** lands on vN+1
- [ ] macOS menu **Clarifi → Check for Updates…** triggers the same check

## Observability

- [ ] `SENTRY_DSN` set in production build env (optional but recommended)
- [ ] Renderer crash shows ErrorBoundary reload UI

---

**Sign-off:** _______________ **Date:** _______________ **Version:** _______________
