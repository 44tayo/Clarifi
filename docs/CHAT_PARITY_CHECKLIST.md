# Chat Parity Checklist (Granola+ / no pricing)

## Shipped in Granola+ plan

- Live session transcript preferred in `chat:send` when meeting is active
- Token streaming (Anthropic → SSE → Electron → progressive bubbles) with JSON fallback
- Local hybrid RAG (`shared/meetingRetrieval.ts` + on-disk index)
- Citation jump-to-transcript (`entryId` / `audioStartMs` / quote highlight)
- Insert rewrite into notes/scratchpad + undo
- Calendar/history pre-meeting brief assembler
- Person/company memory pages + scoped chat
- PDF/text attachments (images remain on vision path)
- Chat metrics logs + CI mock-LLM eval smoke
- Retention purge + local chat audit (Settings → Chat privacy)

## Composer language

Use **Ask Clarifi** (or meeting-scoped “Ask this meeting”) consistently across Home Ask, Chat, and Meeting Ask.

## Dead / unused suggest path

`web/src/app/api/llm/suggest/route.ts` + `generateSuggestions` remain available for during-meeting tip chips, but the desktop UI does **not** currently wire a live suggestions strip. Treat as unused product surface until explicitly productized — do not remove the API (landing/marketing may reference the capability).

## Validation

Run:

```bash
cd my-app && npm test && npx tsc --noEmit && npx tsc -p tsconfig.node.json --noEmit && cd web && npx tsc --noEmit
```
