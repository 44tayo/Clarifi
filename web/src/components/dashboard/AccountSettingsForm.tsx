'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { createClient } from '@/lib/supabase/client'

type AccountSettingsFormProps = {
  firstName: string
  lastName: string
  email: string | undefined
  hasEmailAuth: boolean
  hasGoogleAuth: boolean
}

export function AccountSettingsForm({
  firstName: initialFirst,
  lastName: initialLast,
  email,
  hasEmailAuth,
  hasGoogleAuth,
}: AccountSettingsFormProps) {
  const router = useRouter()
  const [firstName, setFirstName] = useState(initialFirst)
  const [lastName, setLastName] = useState(initialLast)
  const [newEmail, setNewEmail] = useState(email ?? '')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [nameStatus, setNameStatus] = useState<string | null>(null)
  const [emailStatus, setEmailStatus] = useState<string | null>(null)
  const [passwordStatus, setPasswordStatus] = useState<string | null>(null)
  const [nameLoading, setNameLoading] = useState(false)
  const [emailLoading, setEmailLoading] = useState(false)
  const [passwordLoading, setPasswordLoading] = useState(false)

  const saveName = async (e: React.FormEvent) => {
    e.preventDefault()
    setNameLoading(true)
    setNameStatus(null)

    try {
      const res = await fetch('/api/account/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ firstName, lastName }),
      })
      const data = (await res.json()) as { error?: string }

      if (!res.ok) {
        setNameStatus(data.error ?? 'Could not update name')
        return
      }

      setNameStatus('Name updated')
      router.refresh()
    } catch {
      setNameStatus('Network error — try again')
    } finally {
      setNameLoading(false)
    }
  }

  const saveEmail = async (e: React.FormEvent) => {
    e.preventDefault()
    const trimmed = newEmail.trim()
    if (!trimmed) return

    setEmailLoading(true)
    setEmailStatus(null)

    const supabase = createClient()
    if (!supabase) {
      setEmailStatus('Sign-in unavailable')
      setEmailLoading(false)
      return
    }

    const { error } = await supabase.auth.updateUser({ email: trimmed })
    setEmailLoading(false)

    if (error) {
      setEmailStatus(error.message)
      return
    }

    setEmailStatus('Check your inbox to confirm the new email address')
  }

  const savePassword = async (e: React.FormEvent) => {
    e.preventDefault()
    if (password.length < 8) {
      setPasswordStatus('Password must be at least 8 characters')
      return
    }
    if (password !== confirmPassword) {
      setPasswordStatus('Passwords do not match')
      return
    }

    setPasswordLoading(true)
    setPasswordStatus(null)

    const supabase = createClient()
    if (!supabase) {
      setPasswordStatus('Sign-in unavailable')
      setPasswordLoading(false)
      return
    }

    const { error } = await supabase.auth.updateUser({ password })
    setPasswordLoading(false)

    if (error) {
      setPasswordStatus(error.message)
      return
    }

    setPassword('')
    setConfirmPassword('')
    setPasswordStatus('Password updated')
  }

  return (
    <div className="mt-6 space-y-6 border-t border-border pt-6">
      <div>
        <h3 className="mb-1 text-sm font-semibold">Profile</h3>
        <p className="mb-4 text-xs text-muted-foreground">Update how your name appears in Clarifi</p>
        <form className="grid gap-3 sm:grid-cols-2" onSubmit={(e) => void saveName(e)}>
          <Input
            type="text"
            placeholder="First name"
            value={firstName}
            onChange={(e) => setFirstName(e.target.value)}
            autoComplete="given-name"
          />
          <Input
            type="text"
            placeholder="Last name"
            value={lastName}
            onChange={(e) => setLastName(e.target.value)}
            autoComplete="family-name"
          />
          <div className="flex items-center gap-3 sm:col-span-2">
            <Button type="submit" variant="outline" size="sm" disabled={nameLoading}>
              {nameLoading ? 'Saving…' : 'Save name'}
            </Button>
            {nameStatus ? (
              <p
                className={`text-xs ${nameStatus === 'Name updated' ? 'text-green-600' : 'text-destructive'}`}
              >
                {nameStatus}
              </p>
            ) : null}
          </div>
        </form>
      </div>

      {hasEmailAuth ? (
        <>
          <div>
            <h3 className="mb-1 text-sm font-semibold">Email</h3>
            <p className="mb-4 text-xs text-muted-foreground">
              We&apos;ll send a confirmation link to your new address
            </p>
            <form className="space-y-3" onSubmit={(e) => void saveEmail(e)}>
              <Input
                type="email"
                placeholder="you@company.com"
                value={newEmail}
                onChange={(e) => setNewEmail(e.target.value)}
                autoComplete="email"
                required
              />
              <div className="flex items-center gap-3">
                <Button type="submit" variant="outline" size="sm" disabled={emailLoading}>
                  {emailLoading ? 'Saving…' : 'Update email'}
                </Button>
                {emailStatus ? (
                  <p
                    className={`text-xs ${emailStatus.includes('inbox') ? 'text-green-600' : 'text-destructive'}`}
                  >
                    {emailStatus}
                  </p>
                ) : null}
              </div>
            </form>
          </div>

          <div>
            <h3 className="mb-1 text-sm font-semibold">Password</h3>
            <p className="mb-4 text-xs text-muted-foreground">
              Set a password to sign in with email instead of magic links
            </p>
            <form className="space-y-3" onSubmit={(e) => void savePassword(e)}>
              <Input
                type="password"
                placeholder="New password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="new-password"
                minLength={8}
              />
              <Input
                type="password"
                placeholder="Confirm password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                autoComplete="new-password"
                minLength={8}
              />
              <div className="flex items-center gap-3">
                <Button type="submit" variant="outline" size="sm" disabled={passwordLoading}>
                  {passwordLoading ? 'Saving…' : 'Set password'}
                </Button>
                {passwordStatus ? (
                  <p
                    className={`text-xs ${passwordStatus === 'Password updated' ? 'text-green-600' : 'text-destructive'}`}
                  >
                    {passwordStatus}
                  </p>
                ) : null}
              </div>
            </form>
          </div>
        </>
      ) : null}

      {hasGoogleAuth && !hasEmailAuth ? (
        <p className="text-xs text-muted-foreground">
          You sign in with Google. Email and password are managed in your Google account.
        </p>
      ) : null}
    </div>
  )
}
