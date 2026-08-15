import { app } from 'electron'
import * as dotenv from 'dotenv'
import * as fs from 'fs'
import * as path from 'path'
import { getPackagedApiUrl } from './app-config'
import { getKey } from './store'

let envLoaded = false

/** Load API keys from .env.local (dev) or userData/.env (packaged). Never bake keys into the build. */
export function loadRuntimeEnv(): void {
  if (envLoaded) return
  envLoaded = true

  if (!app.isPackaged) {
    const devEnv = path.join(process.cwd(), '.env.local')
    if (fs.existsSync(devEnv)) {
      dotenv.config({ path: devEnv })
    }
    return
  }

  const userEnv = path.join(app.getPath('userData'), '.env')
  if (fs.existsSync(userEnv)) {
    dotenv.config({ path: userEnv })
  }
}

export async function getAnthropicApiKey(): Promise<string | null> {
  loadRuntimeEnv()
  if (process.env.ANTHROPIC_API_KEY?.trim()) {
    return process.env.ANTHROPIC_API_KEY.trim()
  }
  return getKey('anthropic')
}

export async function getGroqApiKey(): Promise<string | null> {
  loadRuntimeEnv()
  if (process.env.GROQ_API_KEY?.trim()) {
    return process.env.GROQ_API_KEY.trim()
  }
  return getKey('groq')
}

export async function getDeepgramApiKey(): Promise<string | null> {
  loadRuntimeEnv()
  if (process.env.DEEPGRAM_API_KEY?.trim()) {
    return process.env.DEEPGRAM_API_KEY.trim()
  }
  return getKey('deepgram')
}

export async function getOpenAiApiKey(): Promise<string | null> {
  loadRuntimeEnv()
  if (process.env.OPENAI_API_KEY?.trim()) {
    return process.env.OPENAI_API_KEY.trim()
  }
  return getKey('openai')
}

export async function getGeminiApiKey(): Promise<string | null> {
  loadRuntimeEnv()
  if (process.env.GEMINI_API_KEY?.trim()) {
    return process.env.GEMINI_API_KEY.trim()
  }
  return getKey('gemini')
}

// Groq's default endpoint processes audio/chat requests in the US. Groq also
// runs an EU endpoint (api.eu.groq.com, Helsinki) for GDPR-sensitive traffic,
// but it must be enabled per-account by Groq sales first — set
// GROQ_API_BASE_URL once that's done. See:
// https://groq.com/blog/groq-launches-european-data-center-footprint-in-helsinki-finland
export function getGroqApiBaseUrl(): string {
  loadRuntimeEnv()
  return process.env.GROQ_API_BASE_URL?.trim() || 'https://api.groq.com'
}

// Deepgram's EU endpoint (api.eu.deepgram.com) is generally available and
// self-serve — no sales contact required, just point at it. It keeps
// diarization/transcription inference inside EU-based AWS regions.
export function getDeepgramApiBaseUrl(): string {
  loadRuntimeEnv()
  return process.env.DEEPGRAM_API_BASE_URL?.trim() || 'https://api.deepgram.com'
}

/** Clarifi cloud API — desktop connects via clarifi:// auth from the website. */
export function getClarifiApiUrl(): string | null {
  loadRuntimeEnv()
  const url = process.env.CLARIFI_API_URL?.trim()
  if (url) return url
  if (app.isPackaged) return getPackagedApiUrl()
  return null
}
