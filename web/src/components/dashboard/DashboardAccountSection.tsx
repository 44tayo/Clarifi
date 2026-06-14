import Link from 'next/link'
import { AccountSettingsForm } from '@/components/dashboard/AccountSettingsForm'
import { ManageBillingButton } from '@/components/billing/ManageBillingButton'
import { SignOutButton } from '@/components/auth/SignOutButton'
import { PLAN_LIMITS, isPaidPlan, type Plan } from '@/lib/plans'

type DashboardAccountSectionProps = {
  displayName: string
  email: string | undefined
  firstName: string
  lastName: string
  plan: Plan
  hasEmailAuth: boolean
  hasGoogleAuth: boolean
}

export function DashboardAccountSection({
  displayName,
  email,
  firstName,
  lastName,
  plan,
  hasEmailAuth,
  hasGoogleAuth,
}: DashboardAccountSectionProps) {
  const planLabel = PLAN_LIMITS[plan].label
  const billingStatus = plan === 'free' ? 'Free tier' : 'Active subscription'

  return (
    <section className="p-6 border border-white/10 rounded-2xl mb-6">
      <h2 className="font-semibold mb-1">Account</h2>
      <p className="text-sm text-white/50 mb-5">Your Clarifi profile and subscription</p>

      <dl className="grid gap-4 sm:grid-cols-3 mb-2">
        <div>
          <dt className="text-xs uppercase tracking-wide text-white/40 mb-1">Name</dt>
          <dd className="text-sm font-medium">{displayName}</dd>
        </div>
        <div>
          <dt className="text-xs uppercase tracking-wide text-white/40 mb-1">Email</dt>
          <dd className="text-sm font-medium break-all">{email ?? '—'}</dd>
        </div>
        <div>
          <dt className="text-xs uppercase tracking-wide text-white/40 mb-1">Plan</dt>
          <dd className="text-sm font-medium">
            {planLabel}
            <span className="block text-white/40 text-xs mt-0.5">{billingStatus}</span>
          </dd>
        </div>
      </dl>

      <AccountSettingsForm
        firstName={firstName}
        lastName={lastName}
        email={email}
        hasEmailAuth={hasEmailAuth}
        hasGoogleAuth={hasGoogleAuth}
      />

      <div className="flex flex-wrap items-center gap-3 border-t border-white/10 pt-6 mt-6">
        <ManageBillingButton className="inline-block bg-white text-black px-6 py-2 rounded-lg text-sm font-medium hover:bg-white/90 disabled:opacity-60" />
        {!isPaidPlan(plan) ? (
          <Link
            href="/billing"
            className="inline-block border border-white/20 px-6 py-2 rounded-lg text-sm hover:bg-white/5"
          >
            Upgrade to Pro
          </Link>
        ) : null}
        <SignOutButton className="text-sm text-white/50 hover:text-white px-2" />
      </div>

      <p className="text-xs text-white/40 mt-4">
        Manage billing opens Stripe&apos;s secure portal to update your card, view invoices, or
        cancel anytime.
      </p>
    </section>
  )
}
