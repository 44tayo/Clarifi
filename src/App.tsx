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
import { useAudioPreferences } from './hooks/useAudioPreferences'
import { useAuth } from './hooks/useAuth'
import { speakerHintsFromEvent, useCalendar } from './hooks/useCalendar'
import { useFolders } from './hooks/useFolders'
import { useMeetings } from './hooks/useMeetings'
import { useRecording } from './hooks/useRecording'
import { useSidebarWidth } from './hooks/useSidebarWidth'
import { formatMicCaptureError, isMicPermissionError } from './lib/microphones'
import { applyTheme } from './lib/theme'
import type { CalendarEvent } from '../shared/calendar'
import type { Meeting } from './types/meeting'
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
  const { meetings, createMeeting, updateMeeting, deleteMeeting, enhanceMeeting, getMeeting, refresh } =
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
  const captureMeetingIdRef = useRef<string | null>(null)
  const demoOpenedRef = useRef(false)

  const recording = useRecording(captureMeetingId)

  useEffect(() => {
    captureMeetingIdRef.current = captureMeetingId
  }, [captureMeetingId])

  useEffect(() => {
    if (demoOpenedRef.current) return
    demoOpenedRef.current = true
    void (async () => {
      const result = (await window.electronAPI.invoke('meetings:seed-demo-artifact')) as {
        meeting?: Meeting
      }
      await refresh()
      if (!result?.meeting) return
      setSelectedId(result.meeting.id)
      setActiveMeeting(result.meeting)
    })()
  }, [refresh])

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

      const meeting = await createMeeting({
        title: event.title,
        calendarEventId: event.id,
        calendarProvider: event.provider,
        scheduledStart: new Date(event.startAt).getTime(),
        attendeeEmails: event.attendees.map((person) => person.email),
        speakerLabels: speakerHintsFromEvent(event),
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
      actionItems?: string[]
      completedActionItems?: string[]
    }) => {
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

  const handleSelectView = useCallback((selection: SidebarSelection) => {
    setNav(selection)
    setSelectedId(null)
    setActiveMeeting(null)
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
        <div className="app-titlebar-drag" aria-hidden="true" />
        <OfflineBanner />
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
        />

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

        <main className="workspace">
          {activeMeeting ? (
            <MeetingWorkspace
              meeting={activeMeeting}
              connected={connection.paired}
              plan={connection.plan}
              captureMeetingId={captureMeetingId}
              recording={recording}
              folders={folders}
              onStartCapture={handleStartCapture}
              onUpdate={(patch) => void handleUpdate(patch)}
              onDelete={() => void handleDelete()}
              onEnhance={() => void handleEnhance()}
              onConnect={() => void openConnect()}
              onOpenDashboard={() => void openDashboard()}
              onBackToMeetings={() => handleSelectView({ view: 'meetings' })}
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
  )
}

export default App
