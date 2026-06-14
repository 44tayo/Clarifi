'use client'

import { useCallback, useEffect, useState } from 'react'

type HubSpotStatus = {
  connected: boolean
  configured: boolean
  autoSyncEnabled: boolean
  defaultContactEmail: string | null
  defaultDealId: string | null
  hubId: number | null
}

type DashboardHubSpotSectionProps = {
  initialStatus: HubSpotStatus
  connectUrl: string
  showConnectedBanner?: boolean
  showErrorBanner?: boolean
}

export function DashboardHubSpotSection({
  initialStatus,
  connectUrl,
  showConnectedBanner = false,
  showErrorBanner = false,
}: DashboardHubSpotSectionProps) {
  const [status, setStatus] = useState(initialStatus)
  const [contactEmail, setContactEmail] = useState(initialStatus.defaultContactEmail ?? '')
  const [autoSync, setAutoSync] = useState(initialStatus.autoSyncEnabled)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<string | null>(
    showConnectedBanner
      ? 'HubSpot connected successfully. Return to Clarifi desktop to finish setup.'
      : showErrorBanner
        ? 'HubSpot connection failed. Try again.'
        : null,
  )

  const refreshStatus = useCallback(async () => {
    try {
      const res = await fetch('/api/integrations/hubspot/status')
      if (!res.ok) return
      const data = (await res.json()) as HubSpotStatus
      setStatus(data)
      setContactEmail(data.defaultContactEmail ?? '')
      setAutoSync(data.autoSyncEnabled)
    } catch {
      /* ignore */
    }
  }, [])

  useEffect(() => {
    void refreshStatus()
  }, [refreshStatus])

  const saveSettings = async () => {
    setSaving(true)
    setMessage(null)
    try {
      const res = await fetch('/api/integrations/hubspot/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          autoSyncEnabled: autoSync,
          defaultContactEmail: contactEmail.trim() || null,
        }),
      })
      const data = (await res.json()) as HubSpotStatus & { error?: string }
      if (!res.ok) {
        setMessage('Could not save HubSpot settings')
        return
      }
      setStatus(data)
      setMessage('HubSpot settings saved')
    } catch {
      setMessage('Could not save HubSpot settings')
    } finally {
      setSaving(false)
    }
  }

  const disconnect = async () => {
    setSaving(true)
    setMessage(null)
    try {
      const res = await fetch('/api/integrations/hubspot/disconnect', { method: 'POST' })
      if (!res.ok) {
        setMessage('Could not disconnect HubSpot')
        return
      }
      setStatus({
        connected: false,
        configured: status.configured,
        autoSyncEnabled: true,
        defaultContactEmail: null,
        defaultDealId: null,
        hubId: null,
      })
      setContactEmail('')
      setAutoSync(true)
      setMessage('HubSpot disconnected')
    } catch {
      setMessage('Could not disconnect HubSpot')
    } finally {
      setSaving(false)
    }
  }

  if (!status.configured) {
    return (
      <section className="p-6 border border-white/10 rounded-2xl mb-6">
        <h2 className="font-semibold mb-1">HubSpot</h2>
        <p className="text-sm text-white/50">
          HubSpot is not configured on the server yet. Add HUBSPOT_CLIENT_ID and
          HUBSPOT_CLIENT_SECRET to enable CRM sync.
        </p>
      </section>
    )
  }

  return (
    <section className="p-6 border border-white/10 rounded-2xl mb-6">
      <div className="flex flex-wrap items-start justify-between gap-3 mb-4">
        <div>
          <h2 className="font-semibold mb-1">HubSpot</h2>
          <p className="text-sm text-white/50">
            Connect once, then Clarifi auto-logs call notes and tasks after each sales call.
          </p>
        </div>
        {!status.connected ? (
          <a
            href={connectUrl}
            className="inline-block bg-white text-black px-6 py-2 rounded-lg text-sm font-medium hover:bg-white/90"
          >
            Connect HubSpot
          </a>
        ) : (
          <button
            type="button"
            onClick={() => void disconnect()}
            disabled={saving}
            className="inline-block border border-white/20 px-6 py-2 rounded-lg text-sm hover:bg-white/5 disabled:opacity-60"
          >
            Disconnect
          </button>
        )}
      </div>

      <p className="text-xs text-white/40 mb-4">
        Status: {status.connected ? 'Connected' : 'Not connected'}
        {status.hubId ? ` · Portal ${status.hubId}` : ''}
      </p>

      {status.connected ? (
        <div className="space-y-3 border-t border-white/10 pt-4">
          <div>
            <label className="block text-xs text-white/50 mb-1" htmlFor="dashboard-hubspot-email">
              Prospect contact email (must exist in HubSpot)
            </label>
            <input
              id="dashboard-hubspot-email"
              type="email"
              className="w-full rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-sm"
              placeholder="prospect@company.com"
              value={contactEmail}
              onChange={(e) => setContactEmail(e.target.value)}
            />
          </div>
          <label className="flex items-center gap-2 text-sm text-white/80">
            <input
              type="checkbox"
              checked={autoSync}
              onChange={(e) => setAutoSync(e.target.checked)}
            />
            Auto-sync notes and tasks after each call
          </label>
          <button
            type="button"
            onClick={() => void saveSettings()}
            disabled={saving}
            className="rounded-lg border border-white/20 px-4 py-2 text-sm hover:bg-white/5 disabled:opacity-60"
          >
            {saving ? 'Saving…' : 'Save HubSpot settings'}
          </button>
        </div>
      ) : null}

      {message ? (
        <p
          className={`text-sm mt-4 ${message.includes('failed') || message.includes('Could not') ? 'text-red-400' : 'text-emerald-400'}`}
        >
          {message}
        </p>
      ) : null}
    </section>
  )
}
