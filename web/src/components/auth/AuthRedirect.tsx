'use client'

import { useRouter } from 'next/navigation'
import { useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'

type AuthRedirectProps = {
  next?: string
}

function stripAuthParams() {
  const url = new URL(window.location.href)
  url.searchParams.delete('code')
  url.searchParams.delete('token_hash')
  url.searchParams.delete('type')
  const search = url.searchParams.toString()
  window.history.replaceState({}, '', `${url.pathname}${search ? `?${search}` : ''}`)
}

/** Exchanges OAuth codes client-side and redirects once a session exists. */
export function AuthRedirect({ next = '/dashboard' }: AuthRedirectProps) {
  const router = useRouter()

  useEffect(() => {
    const supabase = createClient()
    if (!supabase) return

    let cancelled = false

    void (async () => {
      const params = new URLSearchParams(window.location.search)
      const code = params.get('code')

      if (code) {
        const { error } = await supabase.auth.exchangeCodeForSession(code)
        if (cancelled) return
        if (!error) {
          stripAuthParams()
          router.replace(next)
          return
        }
        console.error('client auth code exchange failed:', error.message)
      }

      const {
        data: { session },
      } = await supabase.auth.getSession()
      if (cancelled) return
      if (session) {
        router.replace(next)
      }
    })()

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session) router.replace(next)
    })

    return () => {
      cancelled = true
      subscription.unsubscribe()
    }
  }, [next, router])

  return null
}
