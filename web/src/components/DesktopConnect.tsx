'use client'

import { useState } from 'react'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

export function DesktopConnect() {
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [opened, setOpened] = useState(false)

  async function openClarifiDesktop() {
    setLoading(true)
    setError(null)
    setOpened(false)

    try {
      const res = await fetch('/api/desktop/authorize', { method: 'POST' })
      const data = await res.json()
      if (!res.ok || !data.deepLink) {
        setError(data.error || 'Could not authorize desktop')
        return
      }

      window.location.href = data.deepLink
      setOpened(true)
    } catch {
      setError('Network error — try again')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Card className="mb-6">
      <CardHeader>
        <CardTitle className="text-lg">Connect Clarifi Desktop</CardTitle>
        <CardDescription>
          Download and open Clarifi, then click below while signed in here. The desktop app will
          connect automatically — no codes or API keys needed.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Button type="button" onClick={openClarifiDesktop} disabled={loading}>
          {loading ? 'Opening…' : 'Open Clarifi Desktop'}
        </Button>

        {error ? <p className="mt-4 text-sm text-destructive">{error}</p> : null}
        {opened ? (
          <p className="mt-4 text-sm text-green-600">
            Launching Clarifi… If nothing opens, install the desktop app first, then try again.
          </p>
        ) : null}
      </CardContent>
    </Card>
  )
}
