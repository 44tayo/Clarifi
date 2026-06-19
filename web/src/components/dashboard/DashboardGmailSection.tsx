'use client'

import { useCallback, useEffect, useState } from 'react'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

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
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="text-lg">Gmail</CardTitle>
          <CardDescription>
            Gmail is not configured on the server yet. Add GOOGLE_GMAIL_CLIENT_ID and
            GOOGLE_GMAIL_CLIENT_SECRET to enable inbox search and summaries.
          </CardDescription>
        </CardHeader>
      </Card>
    )
  }

  return (
    <Card className="mb-6">
      <CardHeader>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <CardTitle className="text-lg">Gmail</CardTitle>
            <CardDescription>
              Connect Gmail so Clarifi can find, read, and summarize emails on request.
            </CardDescription>
          </div>
          {!status.connected ? (
            <Button asChild>
              <a href={connectUrl}>Connect Gmail</a>
            </Button>
          ) : (
            <Button variant="outline" onClick={() => void disconnect()} disabled={saving}>
              Disconnect
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {status.connected ? (
          <p className="text-sm text-foreground">
            Connected{status.emailAddress ? ` as ${status.emailAddress}` : ''}. Ask things like
            &quot;Summarize my last email from Sarah&quot; in Clarifi chat.
          </p>
        ) : (
          <p className="text-sm text-muted-foreground">
            Read-only access. Clarifi only loads emails when you ask about them.
          </p>
        )}

        {message ? <p className="mt-4 text-sm text-muted-foreground">{message}</p> : null}
      </CardContent>
    </Card>
  )
}
