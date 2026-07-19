# Clarifi

Monorepo for Clarifi:

| Folder | What |
|--------|------|
| **Root** (`/`) | Desktop app (Electron) — Granola-style rebuild in progress |
| **`web/`** | Next.js site + API (deploy to Vercel with **Root Directory = `web`**) |

## Clarifi Desktop

AI meeting notetaker for macOS. The desktop app was reset to a minimal shell (auth + audio capture + transcription). The previous Cluely-style overlay lives on branch `archive/cluely-desktop`.

## Development

```bash
npm install
cp .env.example .env.local   # CLARIFI_API_URL + optional BYOK keys
npm run electron:dev
```

## What the minimal shell includes

- Granola-style UI: sidebar meeting list, in-call notepad, live transcript, enhanced notes
- Local meeting storage (`~/Library/Application Support/Clarifi/meetings.json`)
- Post-meeting AI enhancement via cloud API (requires connected account + paid plan)
- Device auth via `clarifi://` deep link + cloud API
- Mic + macOS system audio capture (Swift helper)
- Live transcription pipeline (Groq / cloud proxy)
- Auto-update + Mac signing scripts

## Build installers

```bash
npm run build:mac    # → release/Clarifi-x.x.x.dmg
npm run build:win    # → release/Clarifi Setup x.x.x.exe
```

## Web

See `web/README.md` (if present) or deploy `web/` to Vercel.
