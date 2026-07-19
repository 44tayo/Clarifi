import { AuthForm } from '@/components/auth/AuthForm'
import '@/components/auth/auth.css'

export const metadata = {
  title: 'Desktop sign up — Clarifi',
  robots: { index: false, follow: false },
}

export default function DesktopSignUpPage() {
  return (
    <AuthForm
      mode="sign-up"
      next="/desktop/connect"
      subtitle="Create an account to pair Clarifi Desktop and unlock AI summaries."
      alternateHref="/desktop/sign-in"
      alternateLabel="Already have an account? Sign in"
    />
  )
}
