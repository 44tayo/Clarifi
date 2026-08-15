'use client'

import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

type SignOutButtonProps = {
  className?: string
}

export function SignOutButton({
  className = 'text-sm text-white/40 hover:text-white',
}: SignOutButtonProps) {
  const router = useRouter()

  async function signOut() {
    const supabase = createClient()
    if (supabase) {
      await supabase.auth.signOut()
    }
    router.push('/')
    router.refresh()
  }

  return (
    <button type="button" className={className} onClick={() => void signOut()}>
      Sign out
    </button>
  )
}
