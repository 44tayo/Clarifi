import { Suspense } from 'react'
import CommunityAcceptClient from './CommunityAcceptClient'

export default function CommunityAcceptPage() {
  return (
    <Suspense
      fallback={
        <main className="min-h-screen bg-black text-white flex items-center justify-center">
          <p className="text-white/70 text-sm">Loading invite…</p>
        </main>
      }
    >
      <CommunityAcceptClient />
    </Suspense>
  )
}
