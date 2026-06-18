'use client'

import { useCallback, useEffect, useState } from 'react'

type GmailStatus = {
  connected: boolean
  configured: boolean
  emailAddress: string | null
}

type DashboardGmailSectionProps = {
  initialStatus: GmailStatus
  connectUrl: string
  showConnectedBanner?: boolean
  showErrorBanner?: boolean
}

export function DashboardGmailSection({
  initialStatus,
  connectUrl,
  showConnectedBanner = false,
  showErrorBanner = false,
}: DashboardGmailSectionProps) {
  const [status, setStatus] = useState(initialStatus)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<string | null>(
    showConnectedBanner
      ? 'Gmail connected successfully. Ask Clarifi about your emails during calls or in chat.'
      : showErrorBanner
        ? 'Gmail connection failed. Try again.'
        : null,
  )

  const refreshStatus = useCallback(async () => {
    try {
      const res = await fetch('/api/integrations/gmail/status')
      if (!res.ok) return
      const data = (await res.json()) as GmailStatus
      setStatus(data)
    } catch {
      /* ignore */
    }
  }, [])

  useEffect(() => {
    void refreshStatus()
  }, [refreshStatus])

  const disconnect = async () => {
    setSaving(true)
    setMessage(null)
    try {
      const res = await fetch('/api/integrations/gmail/disconnect', { method: 'POST' })
      if (!res.ok) {
        setMessage('Could not disconnect Gmail')
        return
      }
      setStatus({
        connected: false,
        configured: status.configured,
        emailAddress: null,
      })
      setMessage('Gmail disconnected')
    } catch {
      setMessage('Could not disconnect Gmail')
    } finally {
      setSaving(false)
    }
  }

  if (!status.configured) {
    return (
      <section className="p-6 border border-white/10 rounded-2xl mb-6">
        <h2 className="font-semibold mb-1">Gmail</h2>
        <p className="text-sm text-white/50">
          Gmail is not configured on the server yet. Add GOOGLE_GMAIL_CLIENT_ID and
          GOOGLE_GMAIL_CLIENT_SECRET to enable inbox search and summaries.
        </p>
      </section>
    )
  }

  return (
    <section className="p-6 border border-white/10 rounded-2xl mb-6">
      <div className="flex flex-wrap items-start justify-between gap-3 mb-4">
        <div>
          <h2 className="font-semibold mb-1">Gmail</h2>
          <p className="text-sm text-white/50">
            Connect Gmail so Clarifi can find, read, and summarize emails on request.
          </p>
        </div>
        {!status.connected ? (
          <a
            href={connectUrl}
            className="inline-block bg-white text-black px-6 py-2 rounded-lg text-sm font-medium hover:bg-white/90"
          >
            Connect Gmail
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

      {status.connected ? (
        <p className="text-sm text-white/70">
          Connected{status.emailAddress ? ` as ${status.emailAddress}` : ''}. Ask things like
          &quot;Summarize my last email from Sarah&quot; in Clarifi chat.
        </p>
      ) : (
        <p className="text-sm text-white/50">
          Read-only access. Clarifi only loads emails when you ask about them.
        </p>
      )}

      {message ? <p className="text-sm text-white/60 mt-4">{message}</p> : null}
    </section>
  )
}
