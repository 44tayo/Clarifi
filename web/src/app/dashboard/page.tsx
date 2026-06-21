import { redirect } from 'next/navigation'
import Link from 'next/link'
import { getAccountAuthProviders, readNameFromUserMetadata } from '@/lib/account-auth'
import { DashboardDownloadSection } from '@/components/dashboard/DashboardDownloadSection'
import { DashboardAccountSection } from '@/components/dashboard/DashboardAccountSection'
import { DashboardGmailSection } from '@/components/dashboard/DashboardGmailSection'
import { DashboardPricingSection } from '@/components/dashboard/DashboardPricingSection'
import { DesktopConnect } from '@/components/DesktopConnect'
import { getServerUser } from '@/lib/auth-server'
import { getGmailConnection, isGmailConfigured, toPublicGmailStatus } from '@/lib/gmail'
import { PLAN_LIMITS } from '@/lib/plans'
import { getServerLaunchPreviewState } from '@/lib/launch-preview-server'
import { shouldBlockPrelaunchAccess } from '@/lib/prelaunch'
import { getUsageStats } from '@/lib/usage'

export const metadata = {
  title: 'Dashboard — Clarifi',
  robots: { index: false, follow: false },
}

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ gmail?: string }>
}) {
  const user = await getServerUser()
  if (!user) redirect('/sign-in?next=/dashboard')
  const params = await searchParams
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
  const gmailConnection = await getGmailConnection(user.id)
  const gmailStatus = toPublicGmailStatus(gmailConnection)
  const gmailConfigured = isGmailConfigured()

  return (
    <main className="min-h-screen bg-background text-foreground">
      <nav className="flex items-center justify-between border-b border-border px-8 py-6">
        <Link href="/" className="text-xl font-bold hover:text-primary">
          Clarifi
        </Link>
        <Link href="/pricing" className="text-sm text-muted-foreground hover:text-foreground">
          Pricing
        </Link>
      </nav>

      <div className="mx-auto max-w-4xl px-8 py-12">
        <h1 className="mb-2 text-3xl font-bold tracking-tight">Welcome, {displayName}</h1>
        <p className="mb-8 text-muted-foreground">Manage your Clarifi account and settings</p>

        <DashboardAccountSection
          displayName={displayName}
          email={user.email}
          firstName={firstName}
          lastName={lastName}
          plan={stats.plan}
          hasEmailAuth={hasEmailAuth}
          hasGoogleAuth={hasGoogleAuth}
        />

        <div className="mb-8 grid grid-cols-2 gap-6 sm:grid-cols-2">
          {[
            { label: 'Sessions today', value: limitLabel },
            { label: 'Plan limits', value: PLAN_LIMITS[stats.plan].label },
          ].map((stat) => (
            <div
              key={stat.label}
              className="rounded-xl border border-border bg-card p-6 shadow-sm shadow-black/5"
            >
              <div className="mb-1 text-sm text-muted-foreground">{stat.label}</div>
              <div className="text-2xl font-semibold">{stat.value}</div>
            </div>
          ))}
        </div>

        <DesktopConnect />

        {gmailConfigured ? (
          <DashboardGmailSection
            initialStatus={gmailStatus}
            connectUrl="/api/integrations/gmail/connect"
            showConnectedBanner={params.gmail === 'connected'}
            showErrorBanner={params.gmail === 'error'}
          />
        ) : null}

        <div className="mt-6 rounded-xl border border-border bg-card p-6 shadow-sm shadow-black/5">
          <h2 className="mb-1 font-semibold">Download Clarifi</h2>
          <p className="mb-4 text-sm text-muted-foreground">
            Install for your platform (macOS or Windows), then use Open Clarifi Desktop above to connect automatically.
            On macOS first launch, drag Clarifi to Applications, then right-click Clarifi → Open to bypass Gatekeeper.
          </p>
          <DashboardDownloadSection />
          <Link
            href="/desktop/connect"
            className="mt-3 inline-block rounded-lg border border-input px-6 py-2 text-sm shadow-sm shadow-black/5 hover:bg-accent"
          >
            Connect after install →
          </Link>
        </div>

        <DashboardPricingSection />
      </div>
    </main>
  )
}
