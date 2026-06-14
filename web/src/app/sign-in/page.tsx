import { redirect } from 'next/navigation'
import { AuthForm } from '@/components/auth/AuthForm'
import { AuthRedirect } from '@/components/auth/AuthRedirect'
import { getServerUser } from '@/lib/auth-server'
import { getServerLaunchPreviewState } from '@/lib/launch-preview-server'
import { canAccessAuthDuringPrelaunch, resolvePostAuthRedirect } from '@/lib/prelaunch'
import { isLaunchLive } from '@/lib/waitlist-config'
import '@/components/auth/auth.css'

export const dynamic = 'force-dynamic'

type PageProps = {
  searchParams: Promise<{ next?: string; error?: string; preview?: string }>
}

export const metadata = {
  title: 'Sign in — Clarifi',
  robots: { index: false, follow: false },
}

export default async function SignInPage({ searchParams }: PageProps) {
  const params = await searchParams
  const { next, error } = params
  const launchPreview = await getServerLaunchPreviewState(params.preview)
  const redirectNext = next?.startsWith('/') ? next : '/dashboard'
  if (
    !canAccessAuthDuringPrelaunch(
      redirectNext,
      launchPreview.previewLive,
      launchPreview.forceWaitlist,
    )
  ) {
    redirect('/')
  }

  const user = await getServerUser()
  if (user) {
    redirect(
      isLaunchLive(undefined, launchPreview.previewLive, launchPreview.forceWaitlist)
        ? redirectNext
        : resolvePostAuthRedirect(
            redirectNext,
            launchPreview.previewLive,
            launchPreview.forceWaitlist,
          ),
    )
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
