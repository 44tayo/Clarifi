import { useCallback, useEffect, useMemo, useState } from 'react'

import { MeetingWorkspace } from './components/MeetingWorkspace'
import { Sidebar } from './components/Sidebar'
import { SettingsPanel } from './components/SettingsPanel'
import { useAuth } from './hooks/useAuth'
import { useMeetings } from './hooks/useMeetings'
import type { Meeting } from './types/meeting'

function App() {
  const { connection, openConnect, openDashboard } = useAuth()
  const { meetings, createMeeting, updateMeeting, deleteMeeting, enhanceMeeting, getMeeting } =
    useMeetings()
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [activeMeeting, setActiveMeeting] = useState<Meeting | null>(null)
  const [settingsOpen, setSettingsOpen] = useState(false)

  const selectedFromList = useMemo(
    () => meetings.find((meeting) => meeting.id === selectedId) ?? null,
    [meetings, selectedId],
  )

  useEffect(() => {
    if (selectedFromList) {
      setActiveMeeting(selectedFromList)
    }
  }, [selectedFromList])

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
      setSelectedId(id)
      const meeting = await getMeeting(id)
      if (meeting) setActiveMeeting(meeting)
    },
    [getMeeting],
  )

  return (
    <div className="app-shell">
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
                Take light notes during calls. Clarifi captures audio, transcribes in the
                background, and turns everything into polished notes when you&apos;re done.
              </p>
              <button type="button" className="btn btn-primary" onClick={() => void handleNewMeeting()}>
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
  )
}

export default App
