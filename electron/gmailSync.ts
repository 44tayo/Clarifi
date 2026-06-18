import fetch from 'node-fetch'
import { getClarifiApiUrl } from './keys'
import { getDeviceCredentials } from './deviceAuth'

export type GmailStatus = {
  connected: boolean
  configured: boolean
  emailAddress: string | null
}

export type GmailSearchMessage = {
  id: string
  threadId: string
  subject: string
  from: string
  date: string
  snippet: string
  body: string
  webUrl: string
}

export type GmailSearchResult = {
  query: string
  messages: GmailSearchMessage[]
  context: string
  connected: boolean
}

async function deviceHeaders(): Promise<Record<string, string> | null> {
  const creds = await getDeviceCredentials()
  if (!creds) return null
  return {
    'X-Clarifi-Device-Id': creds.deviceId,
    'X-Clarifi-Device-Secret': creds.deviceSecret,
    'Content-Type': 'application/json',
  }
}

export function getGmailConnectUrl(): string {
  const base = getClarifiApiUrl()
  if (!base) return 'http://localhost:3000/api/integrations/gmail/connect'
  return `${base.replace(/\/$/, '')}/api/integrations/gmail/connect`
}

export async function fetchGmailConnectUrl(): Promise<string | null> {
  const baseUrl = getClarifiApiUrl()
  const headers = await deviceHeaders()
  if (!baseUrl || !headers) return null

  try {
    const response = await fetch(`${baseUrl}/api/integrations/gmail/connect-link`, {
      method: 'POST',
      headers,
    })
    if (!response.ok) return null
    const data = (await response.json()) as { url?: string }
    return data.url?.trim() || null
  } catch {
    return null
  }
}

export async function fetchGmailStatus(): Promise<GmailStatus> {
  const baseUrl = getClarifiApiUrl()
  const headers = await deviceHeaders()
  if (!baseUrl || !headers) {
    return { connected: false, configured: false, emailAddress: null }
  }

  try {
    const response = await fetch(`${baseUrl}/api/integrations/gmail/status`, { headers })
    if (!response.ok) {
      return { connected: false, configured: true, emailAddress: null }
    }
    return (await response.json()) as GmailStatus
  } catch {
    return { connected: false, configured: false, emailAddress: null }
  }
}

export async function disconnectGmailAccount(): Promise<boolean> {
  const baseUrl = getClarifiApiUrl()
  const headers = await deviceHeaders()
  if (!baseUrl || !headers) return false

  try {
    const response = await fetch(`${baseUrl}/api/integrations/gmail/disconnect`, {
      method: 'POST',
      headers,
    })
    return response.ok
  } catch {
    return false
  }
}

export function messageRequestsGmailContext(message: string): boolean {
  const text = message.trim()
  if (!text) return false
  return /\b(email|emails|gmail|inbox|mail|mailbox|message|messages|thread|threads|sent|reply|replied|unread|inbox|outbox|follow[\s-]?up email|find.*email|search.*email|last email|recent email|any email|my email)\b/i.test(
    text,
  )
}

export async function fetchGmailSearch(input: {
  message?: string
  query?: string
  maxResults?: number
}): Promise<GmailSearchResult | null> {
  const baseUrl = getClarifiApiUrl()
  const headers = await deviceHeaders()
  if (!baseUrl || !headers) return null

  try {
    const response = await fetch(`${baseUrl}/api/integrations/gmail/search`, {
      method: 'POST',
      headers,
      body: JSON.stringify(input),
    })
    if (!response.ok) return null
    return (await response.json()) as GmailSearchResult
  } catch {
    return null
  }
}

export async function fetchGmailContextForMessage(message: string): Promise<string | null> {
  const result = await fetchGmailSearch({ message, maxResults: 5 })
  return result?.context ?? null
}

export async function fetchGmailSearchForMessage(
  message: string,
): Promise<GmailSearchResult | null> {
  return fetchGmailSearch({ message, maxResults: 5 })
}
