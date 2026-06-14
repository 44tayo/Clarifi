'use client'

import { useState } from 'react'

type ManageBillingButtonProps = {
  className?: string
  label?: string
}

export function ManageBillingButton({
  className = 'inline-block border border-white/20 px-6 py-2 rounded-lg text-sm hover:bg-white/5',
  label = 'Manage billing',
}: ManageBillingButtonProps) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const openPortal = async () => {
    setLoading(true)
    setError(null)

    try {
      const res = await fetch('/api/stripe/portal', { method: 'POST' })
      const data = (await res.json()) as { url?: string; error?: string }

      if (res.status === 401) {
        window.location.href = '/sign-in?next=/dashboard'
        return
      }

      if (!res.ok || !data.url) {
        setError(
          data.error === 'no_stripe_customer'
            ? 'No billing account found. Subscribe first or contact support.'
            : 'Billing portal unavailable — try again later.',
        )
        return
      }

      window.location.href = data.url
    } catch {
      setError('Network error — try again')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div>
      <button
        type="button"
        className={className}
        onClick={() => void openPortal()}
        disabled={loading}
      >
        {loading ? 'Opening…' : label}
      </button>
      {error ? <p className="text-sm text-red-400 mt-2">{error}</p> : null}
    </div>
  )
}
