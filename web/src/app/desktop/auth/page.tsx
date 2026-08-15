import { Suspense } from 'react'

import { DesktopAuthClient } from './DesktopAuthClient'
import '@/components/auth/auth.css'

export const metadata = {
  title: 'Desktop sign in — Clarifi',
  robots: { index: false, follow: false },
}

export default function DesktopAuthPage() {
  return (
    <Suspense
      fallback={
        <main className="auth-page">
          <div className="auth-card">
            <p className="auth-subtitle">Loading…</p>
          </div>
        </main>
      }
    >
      <DesktopAuthClient />
    </Suspense>
  )
}
