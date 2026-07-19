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
  title: 'Sign up — Clarifi',
  robots: { index: false, follow: false },
}

export default async function SignUpPage({ searchParams }: PageProps) {
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
      mode="sign-up"
      next={redirectNext}
      error={error === 'auth' ? 'Sign-up failed. Please try again.' : null}
      title="Create your Clarifi account"
      subtitle="Sign up with email or Google to use Clarifi on desktop and manage your plan."
      alternateHref={`/sign-in${redirectNext !== '/dashboard' ? `?next=${encodeURIComponent(redirectNext)}` : ''}`}
      alternateLabel="Already have an account? Sign in"
    />
    </>
  )
}
