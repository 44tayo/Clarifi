import { useCallback, useEffect, useMemo, useState } from 'react'

import { FREE_HISTORY_RETENTION_DAYS } from '../shared/entitlements'
import { ErrorBoundary } from './components/ErrorBoundary'
import { MeetingWorkspace } from './components/MeetingWorkspace'
import { OfflineBanner } from './components/OfflineBanner'
import { OnboardingFlow } from './components/OnboardingFlow'
import { SettingsPanel } from './components/SettingsPanel'
import { Sidebar } from './components/Sidebar'
import { useAuth } from './hooks/useAuth'
import { useMeetings } from './hooks/useMeetings'
import type { Meeting } from './types/meeting'

const FREE_HISTORY_RETENTION_MS = FREE_HISTORY_RETENTION_DAYS * 24 * 60 * 60 * 1000

function isMeetingLocked(meeting: Meeting, plan?: string): boolean {
  if (plan === 'pro' || plan === 'pro_plus') return false
  const at = meeting.startedAt ?? meeting.createdAt
  return Date.now() - at > FREE_HISTORY_RETENTION_MS
}

function App() {
  const { connection, openConnect, openSignIn, openDashboard } = useAuth()
  const { meetings, createMeeting, updateMeeting, deleteMeeting, enhanceMeeting, getMeeting } =
    useMeetings()
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [activeMeeting, setActiveMeeting] = useState<Meeting | null>(null)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [onboardingDone, setOnboardingDone] = useState<boolean | null>(null)

  useEffect(() => {
    void window.electronAPI.invoke('onboarding:get').then((state) => {
      const data = state as { completed?: boolean }
      setOnboardingDone(Boolean(data.completed))
    })
  }, [])

  const selectedFromList = useMemo(
    () => meetings.find((meeting) => meeting.id === selectedId) ?? null,
    [meetings, selectedId],
  )

  useEffect(() => {
    if (selectedFromList) {
      if (isMeetingLocked(selectedFromList, connection.plan)) {
        setSelectedId(null)
        setActiveMeeting(null)
        return
      }
      setActiveMeeting(selectedFromList)
    }
  }, [selectedFromList, connection.plan])

  const handleNewMeeting = useCallback(async () => {
    const meeting = await createMeeting()
    setSelectedId(meeting.id)
    setActiveMeeting(meeting)
  }, [createMeeting])

  const handleUpdate = useCallback(
    async (patch: { title?: string; userNotes?: string }) => {
      if (!activeMeeting) return
      const updated = await updateMeeting(activeMeeting.id, patch)
      if (updated) setActiveMeeting(updated)
    },
    [activeMeeting, updateMeeting],
  )

  const handleDelete = useCallback(async () => {
    if (!activeMeeting) return
    await deleteMeeting(activeMeeting.id)
    setSelectedId(null)
    setActiveMeeting(null)
  }, [activeMeeting, deleteMeeting])

  const handleEnhance = useCallback(async () => {
    if (!activeMeeting) return
    const updated = await enhanceMeeting(activeMeeting.id)
    if (updated) setActiveMeeting(updated)
  }, [activeMeeting, enhanceMeeting])

  const handleSelect = useCallback(
    async (id: string) => {
      const meeting = await getMeeting(id)
      if (!meeting) return
      if (isMeetingLocked(meeting, connection.plan)) {
        void openDashboard()
        return
      }
      setSelectedId(id)
      setActiveMeeting(meeting)
    },
    [getMeeting, connection.plan, openDashboard],
  )

  if (onboardingDone === null) {
    return <div className="app-shell" />
  }

  if (!onboardingDone) {
    return (
      <OnboardingFlow
        paired={connection.paired}
        onSignIn={(provider) => void openSignIn(provider)}
        onComplete={() => setOnboardingDone(true)}
      />
    )
  }

  return (
    <ErrorBoundary>
      <div className="app-shell">
        <OfflineBanner />
        <Sidebar
          meetings={meetings}
          selectedId={selectedId}
          connection={connection}
          onSelect={(id) => void handleSelect(id)}
          onNewMeeting={() => void handleNewMeeting()}
          onConnect={() => void openConnect()}
          onOpenDashboard={() => void openDashboard()}
          onOpenSettings={() => setSettingsOpen(true)}
        />

        {settingsOpen ? <SettingsPanel onClose={() => setSettingsOpen(false)} /> : null}

        <main className="workspace">
          {!activeMeeting ? (
            <div className="workspace-empty">
              <div className="empty-card">
                <h2>Your AI meeting notepad</h2>
                <p>
                  Take light notes during calls. Clarifi captures audio in the background and turns
                  everything into a clean summary, decisions, and action items when you&apos;re done —
                  no bot ever joins.
                </p>
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={() => void handleNewMeeting()}
                >
                  Start a meeting note
                </button>
              </div>
            </div>
          ) : (
            <MeetingWorkspace
              meeting={activeMeeting}
              connected={connection.paired}
              onUpdate={(patch) => void handleUpdate(patch)}
              onDelete={() => void handleDelete()}
              onEnhance={() => void handleEnhance()}
              onConnect={() => void openConnect()}
            />
          )}
        </main>
      </div>
    </ErrorBoundary>
  )
}

export default App
