import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

import { FREE_HISTORY_RETENTION_DAYS } from '../shared/entitlements'
import { ChatView } from './components/ChatView'
import { CommandPalette } from './components/CommandPalette'
import { ErrorBoundary } from './components/ErrorBoundary'
import { HomeView } from './components/HomeView'
import { MeetingWorkspace } from './components/MeetingWorkspace'
import { MeetingsListView } from './components/MeetingsListView'
import { MicPickerModal } from './components/MicPickerModal'
import { OfflineBanner } from './components/OfflineBanner'
import { OnboardingFlow } from './components/OnboardingFlow'
import { SettingsPanel } from './components/SettingsPanel'
import { SharedWithMeView } from './components/SharedWithMeView'
import { Sidebar } from './components/Sidebar'
import { ToastProvider } from './components/ui/Toast'
import { useAudioPreferences } from './hooks/useAudioPreferences'
import { useAuth } from './hooks/useAuth'
import { useCalendar } from './hooks/useCalendar'
import { useFolders } from './hooks/useFolders'
import { useMeetings } from './hooks/useMeetings'
import { useRecording } from './hooks/useRecording'
import { useSidebarWidth } from './hooks/useSidebarWidth'
import { formatMicCaptureError, isMicPermissionError } from './lib/microphones'
import { applyTheme } from './lib/theme'
import { meetingAttendeesFromCalendar } from '../shared/speakers'
import type { CalendarEvent } from '../shared/calendar'
import type { Meeting, SpeakerIdentities } from './types/meeting'
import type { SidebarSelection } from './types/navigation'

const FREE_HISTORY_RETENTION_MS = FREE_HISTORY_RETENTION_DAYS * 24 * 60 * 60 * 1000

function isMeetingLocked(meeting: Meeting, plan?: string): boolean {
  if (plan === 'pro' || plan === 'pro_plus') return false
  const at = meeting.startedAt ?? meeting.createdAt
  return Date.now() - at > FREE_HISTORY_RETENTION_MS
}

function App() {
  const { connection, openConnect, openSignIn, openDashboard } = useAuth()
  const { prefs, update: updatePrefs } = useAudioPreferences()
  const {
    status: calendarStatus,
    events: calendarEvents,
    loading: calendarLoading,
    openConnect: openCalendarConnect,
    refresh: refreshCalendar,
  } = useCalendar(connection.paired)
  const { meetings, createMeeting, updateMeeting, deleteMeeting, enhanceMeeting, getMeeting } =
    useMeetings()
  const {
    folders,
    createFolder,
    renameFolder,
    deleteFolder,
    setMeetingFolders,
  } = useFolders()
  const { dragging: sidebarResizing, onResizePointerDown, resetWidth: resetSidebarWidth } =
    useSidebarWidth()
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [activeMeeting, setActiveMeeting] = useState<Meeting | null>(null)
  const [nav, setNav] = useState<SidebarSelection>({ view: 'home' })
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [commandOpen, setCommandOpen] = useState(false)
  const [onboardingDone, setOnboardingDone] = useState<boolean | null>(null)
  const [captureMeetingId, setCaptureMeetingId] = useState<string | null>(null)
  const [micPickerOpen, setMicPickerOpen] = useState(false)
  const [micPickerError, setMicPickerError] = useState<string | null>(null)
  const [micPermissionDenied, setMicPermissionDenied] = useState(false)
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false)
  const [deletingMeeting, setDeletingMeeting] = useState(false)
  const [meetingFocusMode, setMeetingFocusMode] = useState(false)
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const captureMeetingIdRef = useRef<string | null>(null)

  useEffect(() => {
    if (!activeMeeting) setMeetingFocusMode(false)
  }, [activeMeeting])

  const recording = useRecording(captureMeetingId)

  useEffect(() => {
    captureMeetingIdRef.current = captureMeetingId
  }, [captureMeetingId])

  useEffect(() => {
    if (!selectedId) return
    const off = window.electronAPI.on('meetings:changed', () => {
      void getMeeting(selectedId).then((meeting) => {
        if (meeting) setActiveMeeting(meeting)
      })
    })
    return off
  }, [selectedId, getMeeting])

  useEffect(() => {
    if (!prefs?.theme) return
    applyTheme(prefs.theme)
    if (prefs.theme !== 'system') return
    const mq = window.matchMedia('(prefers-color-scheme: dark)')
    const onChange = () => applyTheme('system')
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [prefs?.theme])

  useEffect(() => {
    void window.electronAPI.invoke('onboarding:get').then((state) => {
      const data = state as { completed?: boolean }
      setOnboardingDone(Boolean(data.completed))
    })
  }, [])

  useEffect(() => {
    const off = window.electronAPI.on('audio:stopped', () => {
      const id = captureMeetingIdRef.current
      if (!id) return
      void getMeeting(id).then((meeting) => {
        if (meeting) {
          setSelectedId(id)
          setActiveMeeting(meeting)
        }
      })
      setCaptureMeetingId(null)
    })
    return off
  }, [getMeeting])

  useEffect(() => {
    const off = window.electronAPI.on('widget:navigate-meeting', (payload) => {
      const data = payload as { meetingId?: string }
      if (!data.meetingId) return
      void getMeeting(data.meetingId).then((meeting) => {
        if (meeting) {
          setSelectedId(data.meetingId!)
          setActiveMeeting(meeting)
        }
      })
    })
    return off
  }, [getMeeting])

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const meta = event.metaKey || event.ctrlKey
      if (!meta || event.key.toLowerCase() !== 'k') return
      const target = event.target as HTMLElement | null
      const tag = target?.tagName?.toLowerCase()
      if (tag === 'input' || tag === 'textarea' || target?.isContentEditable) {
        // Still allow ⌘K from fields — command palette is the search affordance
      }
      event.preventDefault()
      setCommandOpen((open) => !open)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
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

  const beginCapture = useCallback(
    async (meetingId: string) => {
      setMicPickerError(null)
      setMicPermissionDenied(false)

      const status = (await window.electronAPI.invoke('audio:status')) as {
        isRecording?: boolean
        meetingId?: string | null
      }
      if (status.isRecording) {
        const activeId = status.meetingId ?? meetingId
        setCaptureMeetingId(activeId)
        setSelectedId(activeId)
        setMicPickerOpen(false)
        return
      }

      setCaptureMeetingId(meetingId)
      if (prefs?.skipMicPicker) {
        try {
          await recording.start(meetingId)
          setMicPickerOpen(false)
          setSelectedId(meetingId)
        } catch (error) {
          console.error('[capture]', error)
          setMicPickerError(formatMicCaptureError(error))
          setMicPermissionDenied(isMicPermissionError(error))
          setMicPickerOpen(true)
        }
        return
      }
      setMicPickerOpen(true)
    },
    [prefs?.skipMicPicker, recording],
  )

  const handleNewMeeting = useCallback(async () => {
    const meeting = await createMeeting()
    await beginCapture(meeting.id)
  }, [beginCapture, createMeeting])

  const handleStartCalendarEvent = useCallback(
    async (event: CalendarEvent) => {
      const existing = meetings.find(
        (meeting) =>
          meeting.calendarEventId === event.id && meeting.calendarProvider === event.provider,
      )

      if (existing) {
        setSelectedId(existing.id)
        setActiveMeeting(existing)
        await beginCapture(existing.id)
        return
      }

      const attendees = meetingAttendeesFromCalendar(event.attendees)
      const meeting = await createMeeting({
        title: event.title,
        calendarEventId: event.id,
        calendarProvider: event.provider,
        scheduledStart: new Date(event.startAt).getTime(),
        attendees,
        attendeeEmails: attendees.map((person) => person.email),
        speakerLabels: {},
        speakerIdentities: {},
      })
      setSelectedId(meeting.id)
      setActiveMeeting(meeting)
      await beginCapture(meeting.id)
    },
    [beginCapture, createMeeting, meetings],
  )

  useEffect(() => {
    if (!settingsOpen || !connection.paired) return
    void refreshCalendar()
  }, [settingsOpen, connection.paired, refreshCalendar])

  useEffect(() => {
    if (nav.view !== 'home' || !connection.paired) return
    void refreshCalendar()
  }, [nav.view, connection.paired, refreshCalendar])

  useEffect(() => {
    const off = window.electronAPI.on('calendar:reminder-start', (payload) => {
      const event = payload as CalendarEvent
      if (!event?.id || !event.provider) return
      void handleStartCalendarEvent(event)
    })
    return off
  }, [handleStartCalendarEvent])

  const handleStartCapture = useCallback(
    (meetingId: string) => {
      void beginCapture(meetingId)
    },
    [beginCapture],
  )

  const handleMicPickerClose = useCallback(() => {
    setMicPickerOpen(false)
    setMicPickerError(null)
    setMicPermissionDenied(false)
    setCaptureMeetingId(null)
  }, [])

  const handleMicPickerStart = useCallback(
    async (deviceId: string, label: string, skipNextTime: boolean) => {
      const meetingId = captureMeetingIdRef.current
      if (!meetingId) return

      setMicPickerError(null)
      setMicPermissionDenied(false)
      await updatePrefs({
        preferredMicrophoneId: deviceId,
        preferredMicrophoneLabel: label,
      })

      try {
        await recording.start(meetingId)
        setMicPickerOpen(false)
        setMicPickerError(null)
        setSelectedId(meetingId)
        if (skipNextTime) {
          await updatePrefs({ skipMicPicker: true })
        }
      } catch (error) {
        console.error('[mic capture]', error)
        setMicPickerError(formatMicCaptureError(error))
        setMicPermissionDenied(isMicPermissionError(error))
      }
    },
    [recording, updatePrefs],
  )

  const handleUpdate = useCallback(
    async (patch: {
      title?: string
      userNotes?: string
      speakerLabels?: Record<string, string>
      speakerIdentities?: SpeakerIdentities
      actionItems?: string[]
      completedActionItems?: string[]
    }) => {
      if (!activeMeeting) return
      const updated = await updateMeeting(activeMeeting.id, patch)
      if (updated) setActiveMeeting(updated)
    },
    [activeMeeting, updateMeeting],
  )

  const requestDelete = useCallback(() => {
    if (!activeMeeting) return
    setDeleteConfirmOpen(true)
  }, [activeMeeting])

  const confirmDelete = useCallback(async () => {
    if (!activeMeeting || deletingMeeting) return
    setDeletingMeeting(true)
    try {
      await deleteMeeting(activeMeeting.id)
      setDeleteConfirmOpen(false)
      setSelectedId(null)
      setActiveMeeting(null)
    } finally {
      setDeletingMeeting(false)
    }
  }, [activeMeeting, deleteMeeting, deletingMeeting])

  useEffect(() => {
    if (!deleteConfirmOpen) return
    document.body.classList.add('has-modal-open')
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setDeleteConfirmOpen(false)
    }
    window.addEventListener('keydown', onKey)
    return () => {
      document.body.classList.remove('has-modal-open')
      window.removeEventListener('keydown', onKey)
    }
  }, [deleteConfirmOpen])

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

  const handleSelectView = useCallback((selection: SidebarSelection) => {
    setNav(selection)
    setSelectedId(null)
    setActiveMeeting(null)
    setMeetingFocusMode(false)
  }, [])

  const handleCommandNavigate = useCallback(
    (actionId: string) => {
      switch (actionId) {
        case 'nav-home':
          handleSelectView({ view: 'home' })
          break
        case 'nav-meetings':
          handleSelectView({ view: 'meetings' })
          break
        case 'nav-chat':
          handleSelectView({ view: 'chat' })
          break
        case 'nav-shared':
          handleSelectView({ view: 'shared' })
          break
        case 'nav-settings':
          setSettingsOpen(true)
          break
        case 'nav-new':
          void handleNewMeeting()
          break
        default:
          break
      }
    },
    [handleNewMeeting, handleSelectView],
  )

  const filteredMeetings = useMemo(() => {
    if (nav.view === 'folder' && nav.folderId) {
      return meetings.filter((meeting) => (meeting.folderIds ?? []).includes(nav.folderId!))
    }
    return meetings
  }, [meetings, nav])

  const folderTitle =
    nav.view === 'folder'
      ? folders.find((folder) => folder.id === nav.folderId)?.name ?? 'Folder'
      : 'Meetings'

  if (onboardingDone === null) {
    return <div className="app-shell" />
  }

  if (!onboardingDone) {
    return (
      <ToastProvider>
        <OnboardingFlow
          paired={connection.paired}
          onSignIn={(provider) => void openSignIn(provider)}
          onComplete={() => setOnboardingDone(true)}
        />
      </ToastProvider>
    )
  }

  return (
    <ToastProvider>
    <ErrorBoundary>
      <div
        className={`app-shell${meetingFocusMode && activeMeeting ? ' is-meeting-focus' : ''}${
          sidebarCollapsed && !(meetingFocusMode && activeMeeting) ? ' is-sidebar-collapsed' : ''
        }`}
      >
        <div className="app-titlebar-drag" aria-hidden="true" />
        <OfflineBanner />
        {!meetingFocusMode || !activeMeeting ? (
          sidebarCollapsed ? (
            <button
              type="button"
              className="sidebar-expand-btn no-drag"
              aria-label="Expand sidebar"
              title="Expand sidebar"
              onClick={() => setSidebarCollapsed(false)}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <rect x="3.5" y="4.5" width="17" height="15" rx="2" />
                <path d="M9.5 4.5v15" />
              </svg>
            </button>
          ) : (
            <Sidebar
              selection={nav}
              onSelectView={handleSelectView}
              meetings={meetings}
              onSelectMeeting={(id) => void handleSelect(id)}
              folders={folders}
              onCreateFolder={(name) => void createFolder(name)}
              onRenameFolder={(id, name) => void renameFolder(id, name)}
              onDeleteFolder={(id) => void deleteFolder(id)}
              connection={connection}
              onNewMeeting={() => void handleNewMeeting()}
              onConnect={() => void openConnect()}
              onOpenDashboard={() => void openDashboard()}
              onOpenSettings={() => setSettingsOpen(true)}
              resizing={sidebarResizing}
              onResizePointerDown={onResizePointerDown}
              onResizeDoubleClick={resetSidebarWidth}
              onCollapse={() => setSidebarCollapsed(true)}
            />
          )
        ) : null}

        {settingsOpen ? (
          <SettingsPanel onClose={() => setSettingsOpen(false)} calendarEnabled={connection.paired} />
        ) : null}

        <CommandPalette
          open={commandOpen}
          meetings={meetings}
          onClose={() => setCommandOpen(false)}
          onNavigate={handleCommandNavigate}
          onOpenMeeting={(id) => void handleSelect(id)}
        />

        <MicPickerModal
          open={micPickerOpen}
          error={micPickerError}
          permissionDenied={micPermissionDenied}
          onClose={handleMicPickerClose}
          onStart={(deviceId, label, skipNextTime) =>
            handleMicPickerStart(deviceId, label, skipNextTime)
          }
        />

        {deleteConfirmOpen && activeMeeting ? (
          <div
            className="confirm-delete-backdrop"
            role="presentation"
            onMouseDown={(event) => {
              if (event.target === event.currentTarget) setDeleteConfirmOpen(false)
            }}
          >
            <div
              className="confirm-delete-dialog"
              role="dialog"
              aria-modal="true"
              aria-labelledby="confirm-delete-title"
            >
              <h2 id="confirm-delete-title">
                Delete “{activeMeeting.title?.trim() || 'Untitled'}”?
              </h2>
              <p>This can’t be undone.</p>
              <div className="confirm-delete-actions">
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setDeleteConfirmOpen(false)}
                  disabled={deletingMeeting}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className="btn btn-danger confirm-delete-confirm"
                  onClick={() => void confirmDelete()}
                  disabled={deletingMeeting}
                >
                  {deletingMeeting ? 'Deleting…' : 'Delete'}
                </button>
              </div>
            </div>
          </div>
        ) : null}

        <main className="workspace">
          {activeMeeting ? (
            <MeetingWorkspace
              meeting={activeMeeting}
              connected={connection.paired}
              plan={connection.plan}
              captureMeetingId={captureMeetingId}
              recording={recording}
              folders={folders}
              isMaximized={meetingFocusMode}
              onToggleMaximize={() => setMeetingFocusMode((v) => !v)}
              onStartCapture={handleStartCapture}
              onUpdate={(patch) => void handleUpdate(patch)}
              onDelete={requestDelete}
              onEnhance={() => void handleEnhance()}
              onConnect={() => void openConnect()}
              onOpenDashboard={() => void openDashboard()}
              onBackHome={() => handleSelectView({ view: 'home' })}
              onSetFolders={(folderIds) => {
                void setMeetingFolders(activeMeeting.id, folderIds).then(async () => {
                  const refreshed = await getMeeting(activeMeeting.id)
                  if (refreshed) setActiveMeeting(refreshed)
                })
              }}
              onCreateFolder={async (name) => {
                const folder = await createFolder(name)
                if (folder) {
                  const next = [...(activeMeeting.folderIds ?? []), folder.id]
                  await setMeetingFolders(activeMeeting.id, next)
                  const refreshed = await getMeeting(activeMeeting.id)
                  if (refreshed) setActiveMeeting(refreshed)
                }
                return folder
              }}
            />
          ) : nav.view === 'home' ? (
            <HomeView
              connection={connection}
              calendarConnected={calendarStatus.connected}
              calendarStatus={calendarStatus}
              calendarLoading={calendarLoading}
              calendarEvents={calendarEvents}
              meetings={meetings}
              selectedId={selectedId}
              onSelectMeeting={(id) => void handleSelect(id)}
              onStartCalendarEvent={(event) => void handleStartCalendarEvent(event)}
              onConnectCalendar={(provider) => void openCalendarConnect(provider)}
              onConnectAccount={() => void openConnect()}
              onOpenDashboard={() => void openDashboard()}
              onOpenChat={() => handleSelectView({ view: 'chat' })}
              onOpenSettings={() => setSettingsOpen(true)}
              isMeetingLocked={(meeting) => isMeetingLocked(meeting, connection.plan)}
            />
          ) : nav.view === 'chat' ? (
            <ChatView
              meetings={meetings}
              paired={connection.paired}
              onConnect={() => void openConnect()}
              onOpenMeeting={(id) => void handleSelect(id)}
            />
          ) : nav.view === 'shared' ? (
            <SharedWithMeView
              paired={connection.paired}
              onConnect={() => void openConnect()}
              onOpenDashboard={() => void openDashboard()}
            />
          ) : (
            <MeetingsListView
              title={folderTitle}
              subtitle={
                nav.view === 'folder'
                  ? 'Meetings in this folder'
                  : 'All of your meeting notes'
              }
              meetings={filteredMeetings}
              selectedId={selectedId}
              connection={connection}
              onSelectMeeting={(id) => void handleSelect(id)}
              onOpenDashboard={() => void openDashboard()}
              onNewMeeting={() => void handleNewMeeting()}
              isMeetingLocked={(meeting) => isMeetingLocked(meeting, connection.plan)}
            />
          )}
        </main>
      </div>
    </ErrorBoundary>
    </ToastProvider>
  )
}

export default App
