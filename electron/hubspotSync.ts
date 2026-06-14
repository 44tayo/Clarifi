import fetch from 'node-fetch'
import { getClarifiApiUrl } from './keys'
import { getDeviceCredentials } from './deviceAuth'

export type HubSpotStatus = {
  connected: boolean
  configured: boolean
  autoSyncEnabled: boolean
  defaultContactEmail: string | null
  defaultDealId: string | null
  hubId: number | null
}

export type HubSpotSyncPayload = {
  sessionId: string
  title?: string
  endedAt?: number
  summary?: string
  dealSummary?: string
  internalCrmNote?: string
  actionItems?: string[]
  mutualActionPlan?: string[]
  painPointsUncovered?: string[]
  objectionsRaised?: Array<{ type?: string; summary?: string; handled?: string }>
  openQuestions?: string[]
  decisions?: string[]
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

export function getHubSpotConnectUrl(): string {
  const base = getClarifiApiUrl()
  if (!base) return 'http://localhost:3000/api/integrations/hubspot/connect'
  return `${base.replace(/\/$/, '')}/api/integrations/hubspot/connect`
}

export async function fetchHubSpotStatus(): Promise<HubSpotStatus> {
  const baseUrl = getClarifiApiUrl()
  const headers = await deviceHeaders()
  if (!baseUrl || !headers) {
    return {
      connected: false,
      configured: false,
      autoSyncEnabled: false,
      defaultContactEmail: null,
      defaultDealId: null,
      hubId: null,
    }
  }

  try {
    const response = await fetch(`${baseUrl}/api/integrations/hubspot/status`, { headers })
    if (!response.ok) {
      return {
        connected: false,
        configured: true,
        autoSyncEnabled: false,
        defaultContactEmail: null,
        defaultDealId: null,
        hubId: null,
      }
    }
    return (await response.json()) as HubSpotStatus
  } catch {
    return {
      connected: false,
      configured: false,
      autoSyncEnabled: false,
      defaultContactEmail: null,
      defaultDealId: null,
      hubId: null,
    }
  }
}

export async function updateHubSpotSettings(input: {
  autoSyncEnabled?: boolean
  defaultContactEmail?: string | null
  defaultDealId?: string | null
}): Promise<HubSpotStatus> {
  const baseUrl = getClarifiApiUrl()
  const headers = await deviceHeaders()
  if (!baseUrl || !headers) return fetchHubSpotStatus()

  try {
    const response = await fetch(`${baseUrl}/api/integrations/hubspot/settings`, {
      method: 'PATCH',
      headers,
      body: JSON.stringify(input),
    })
    if (!response.ok) return fetchHubSpotStatus()
    return (await response.json()) as HubSpotStatus
  } catch {
    return fetchHubSpotStatus()
  }
}

export async function disconnectHubSpot(): Promise<boolean> {
  const baseUrl = getClarifiApiUrl()
  const headers = await deviceHeaders()
  if (!baseUrl || !headers) return false

  try {
    const response = await fetch(`${baseUrl}/api/integrations/hubspot/disconnect`, {
      method: 'POST',
      headers,
    })
    return response.ok
  } catch {
    return false
  }
}

export async function syncSessionToHubSpot(
  payload: HubSpotSyncPayload,
): Promise<{ ok: boolean; error?: string; taskCount?: number }> {
  const baseUrl = getClarifiApiUrl()
  const headers = await deviceHeaders()
  if (!baseUrl || !headers) return { ok: false, error: 'not_paired' }

  try {
    const response = await fetch(`${baseUrl}/api/integrations/hubspot/sync`, {
      method: 'POST',
      headers,
      body: JSON.stringify(payload),
    })
    const data = (await response.json()) as {
      ok?: boolean
      error?: string
      taskIds?: string[]
    }

    if (!response.ok) {
      return { ok: false, error: data.error ?? 'sync_failed' }
    }

    return { ok: true, taskCount: data.taskIds?.length ?? 0 }
  } catch {
    return { ok: false, error: 'network_error' }
  }
}

type SessionRecapLike = {
  summary?: string
  dealSummary?: string
  internalCrmNote?: string
  actionItems?: string[]
  mutualActionPlan?: string[]
  painPointsUncovered?: string[]
  objectionsRaised?: Array<{ type?: string; summary?: string; handled?: string }>
  openQuestions?: string[]
  decisions?: string[]
}

export async function maybeAutoSyncSession(session: {
  id: string
  title: string
  endedAt: number
  recap: SessionRecapLike | null
}): Promise<{ ok: boolean; synced: boolean; error?: string; taskCount?: number }> {
  const status = await fetchHubSpotStatus()
  if (!status.connected) return { ok: true, synced: false, error: 'not_connected' }
  if (!status.autoSyncEnabled) return { ok: true, synced: false, error: 'auto_sync_disabled' }
  if (!status.defaultContactEmail?.trim()) {
    return { ok: true, synced: false, error: 'contact_email_required' }
  }
  if (!session.recap) return { ok: true, synced: false, error: 'no_recap' }

  const recap = session.recap
  const result = await syncSessionToHubSpot({
    sessionId: session.id,
    title: session.title,
    endedAt: session.endedAt,
    summary: recap.summary,
    dealSummary: recap.dealSummary,
    internalCrmNote: recap.internalCrmNote,
    actionItems: recap.actionItems,
    mutualActionPlan: recap.mutualActionPlan,
    painPointsUncovered: recap.painPointsUncovered,
    objectionsRaised: recap.objectionsRaised,
    openQuestions: recap.openQuestions,
    decisions: recap.decisions,
  })

  if (!result.ok) {
    return { ok: false, synced: false, error: result.error }
  }

  return { ok: true, synced: true, taskCount: result.taskCount }
}
