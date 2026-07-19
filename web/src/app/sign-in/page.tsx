import { redirect } from 'next/navigation'
import { AuthForm } from '@/components/auth/AuthForm'
import { AuthRedirect } from '@/components/auth/AuthRedirect'
import { getServerUser } from '@/lib/auth-server'
import '@/components/auth/auth.css'

export const dynamic = 'force-dynamic'

type PageProps = {
  searchParams: Promise<{ next?: string; error?: string }>
}

export const metadata = {
  title: 'Sign in — Clarifi',
  robots: { index: false, follow: false },
}

export default async function SignInPage({ searchParams }: PageProps) {
  const params = await searchParams
  const { next, error } = params
  const redirectNext = next?.startsWith('/') ? next : '/dashboard'

  const user = await getServerUser()
  if (user) {
    redirect(redirectNext)
  }

  return (
    <>
      <AuthRedirect next={redirectNext} />
      <AuthForm
      mode="sign-in"
      next={redirectNext}
      error={error === 'auth' ? 'Sign-in failed. Please try again.' : null}
      title="Sign in to Clarifi"
      subtitle="Use your email or Google account to access your dashboard and connect the desktop app."
      alternateHref={`/sign-up${redirectNext !== '/dashboard' ? `?next=${encodeURIComponent(redirectNext)}` : ''}`}
      alternateLabel="Don't have an account? Sign up"
    />
    </>
  )
}
