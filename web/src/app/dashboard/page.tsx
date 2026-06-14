import { redirect } from 'next/navigation'
import Link from 'next/link'
import { getAccountAuthProviders, readNameFromUserMetadata } from '@/lib/account-auth'
import { DownloadClarifi } from '@/components/DownloadClarifi'
import { DashboardAccountSection } from '@/components/dashboard/DashboardAccountSection'
import { DesktopConnect } from '@/components/DesktopConnect'
import { getServerUser } from '@/lib/auth-server'
import { PLAN_LIMITS } from '@/lib/plans'
import { getServerLaunchPreviewState } from '@/lib/launch-preview-server'
import { shouldBlockPrelaunchAccess } from '@/lib/prelaunch'
import { getUsageStats } from '@/lib/usage'

export const metadata = {
  title: 'Dashboard — Clarifi',
  robots: { index: false, follow: false },
}

export default async function DashboardPage() {
  const user = await getServerUser()
  if (!user) redirect('/sign-in?next=/dashboard')
  const launchPreview = await getServerLaunchPreviewState()
  if (
    shouldBlockPrelaunchAccess(
      '/dashboard',
      user.id,
      launchPreview.previewLive,
      launchPreview.forceWaitlist,
    )
  ) {
    redirect('/?joined=1')
  }

  const stats = await getUsageStats(user.id)
  const { firstName, lastName, displayName } = readNameFromUserMetadata(
    user.user_metadata as Record<string, unknown>,
    user.email,
  )
  const { hasEmailAuth, hasGoogleAuth } = getAccountAuthProviders(user.identities, user.email)
  const limitLabel = Number.isFinite(stats.limit)
    ? `${stats.used} / ${stats.limit}`
    : `${stats.used} (unlimited)`

  return (
    <main className="min-h-screen bg-black text-white">
      <nav className="flex items-center justify-between px-8 py-6 border-b border-white/10">
        <Link href="/" className="text-xl font-bold hover:text-white/90">
          Clarifi
        </Link>
        <Link href="/pricing" className="text-sm text-white/40 hover:text-white">
          Pricing
        </Link>
      </nav>

      <div className="max-w-4xl mx-auto px-8 py-12">
        <h1 className="text-3xl font-bold mb-2">Welcome, {displayName}</h1>
        <p className="text-white/50 mb-8">Manage your Clarifi account and settings</p>

        <DashboardAccountSection
          displayName={displayName}
          email={user.email}
          firstName={firstName}
          lastName={lastName}
          plan={stats.plan}
          hasEmailAuth={hasEmailAuth}
          hasGoogleAuth={hasGoogleAuth}
        />

        <div className="grid grid-cols-2 gap-6 mb-8 sm:grid-cols-2">
          {[
            { label: 'Sessions today', value: limitLabel },
            { label: 'Plan limits', value: PLAN_LIMITS[stats.plan].label },
          ].map((stat) => (
            <div key={stat.label} className="p-6 border border-white/10 rounded-2xl">
              <div className="text-sm text-white/40 mb-1">{stat.label}</div>
              <div className="text-2xl font-semibold">{stat.value}</div>
            </div>
          ))}
        </div>

        <DesktopConnect />

        <div className="p-6 border border-white/10 rounded-2xl mt-6">
          <h2 className="font-semibold mb-1">Download Clarifi</h2>
          <p className="text-sm text-white/50 mb-4">
            Install for your platform, then use Open Clarifi Desktop above to connect automatically.
            On macOS first launch, right-click Clarifi in Applications → Open to bypass Gatekeeper.
          </p>
          <DownloadClarifi variant="dashboard" />
          <Link
            href="/desktop/connect"
            className="inline-block border border-white/20 px-6 py-2 rounded-lg text-sm hover:bg-white/5 mt-3"
          >
            Connect after install →
          </Link>
        </div>
      </div>
    </main>
  )
}
