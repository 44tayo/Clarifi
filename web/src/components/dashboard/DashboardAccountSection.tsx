import Link from 'next/link'
import { AccountSettingsForm } from '@/components/dashboard/AccountSettingsForm'
import { ManageBillingButton } from '@/components/billing/ManageBillingButton'
import { SignOutButton } from '@/components/auth/SignOutButton'
import { Button, buttonVariants } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { cn } from '@/lib/utils'
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
  const billingStatus = isPaidPlan(plan) ? 'Active subscription' : 'No active subscription'

  return (
    <Card className="mb-6">
      <CardHeader>
        <CardTitle className="text-lg">Account</CardTitle>
        <CardDescription>Your Clarifi profile and subscription</CardDescription>
      </CardHeader>
      <CardContent>
        <dl className="mb-2 grid gap-4 sm:grid-cols-3">
          <div>
            <dt className="mb-1 text-xs uppercase tracking-wide text-muted-foreground">Name</dt>
            <dd className="text-sm font-medium">{displayName}</dd>
          </div>
          <div>
            <dt className="mb-1 text-xs uppercase tracking-wide text-muted-foreground">Email</dt>
            <dd className="break-all text-sm font-medium">{email ?? '—'}</dd>
          </div>
          <div>
            <dt className="mb-1 text-xs uppercase tracking-wide text-muted-foreground">Plan</dt>
            <dd className="text-sm font-medium">
              {planLabel}
              <span className="mt-0.5 block text-xs text-muted-foreground">{billingStatus}</span>
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

        <div className="mt-6 flex flex-wrap items-center gap-3 border-t border-border pt-6">
          <ManageBillingButton className={cn(buttonVariants({ variant: 'default' }))} />
          {!isPaidPlan(plan) ? (
            <Button variant="outline" asChild>
              <Link href="/billing">Upgrade to Pro</Link>
            </Button>
          ) : null}
          <SignOutButton className="px-2 text-sm text-muted-foreground hover:text-foreground" />
        </div>

        <p className="mt-4 text-xs text-muted-foreground">
          Manage billing opens Stripe&apos;s secure portal to update your card, view invoices, or
          cancel anytime.
        </p>
      </CardContent>
    </Card>
  )
}
