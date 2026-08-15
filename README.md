# Clarifi

Monorepo for Clarifi:

| Folder | What |
|--------|------|
| **Root** (`/`) | Desktop app (Electron) — Granola-style AI meeting notepad |
| **`web/`** | Next.js site + API (deploy to Vercel with **Root Directory = `web`**) |

See [`PRODUCT.md`](./PRODUCT.md) for positioning: Clarifi is the AI notepad for back-to-back meetings — for everyone in Europe (personal email OK).

## Clarifi Desktop

AI meeting notepad for macOS. Jot light notes while Clarifi listens (mic + system audio), then get a structured summary, decisions, and action items. No bot joins the call.

## Development

```bash
npm install
cp .env.example .env.local   # CLARIFI_API_URL + optional BYOK keys
npm run electron:dev
```

In another terminal, run the website:

```bash
cd web && npm run dev
```

## What the app includes

- First-run onboarding (welcome → connect → mic / system-audio permissions)
- Meetings sidebar with history retention for unpaid accounts
- In-call scratchpad + live transcript
- Floating recording widget (timer / stop) while capturing
- Post-meeting AI summary with Summary / Transcript / Scratchpad tabs
- Local encrypted meeting storage
- Device auth via `clarifi://` deep link + cloud API
- Language + microphone settings

## Build installers

```bash
npm run build:mac    # → release/Clarifi-x.x.x.dmg
npm run build:win    # → release/Clarifi Setup x.x.x.exe
```

## Web

See `web/README.md` (if present) or deploy `web/` to Vercel.
