import { Agent } from 'https'
import fetch from 'node-fetch'

/**
 * Shared keep-alive agent for Groq calls (transcription + dictation polish).
 * Reusing the TCP/TLS connection across requests removes a fresh handshake
 * (~100–200 ms) from every dictation round-trip.
 */
export const groqKeepAliveAgent = new Agent({
  keepAlive: true,
  keepAliveMsecs: 15_000,
  maxSockets: 4,
})

const GROQ_HOST = 'https://api.groq.com'
const WARM_THROTTLE_MS = 2_500
let lastWarmAt = 0

/**
 * Pre-open the TLS connection to Groq so it's already established (and pooled in
 * the keep-alive agent) by the time the recorded audio is ready to upload.
 * Fire-and-forget; failures are ignored. Called on push-to-talk key-down.
 */
export function warmGroqConnection(): void {
  const now = Date.now()
  if (now - lastWarmAt < WARM_THROTTLE_MS) return
  lastWarmAt = now

  // A bare request to the host is enough to complete the TCP+TLS handshake; the
  // response status is irrelevant since the warmed socket gets reused.
  fetch(GROQ_HOST, { method: 'HEAD', agent: groqKeepAliveAgent }).catch(() => {
    // Best-effort warmup — ignore network errors.
  })
}
