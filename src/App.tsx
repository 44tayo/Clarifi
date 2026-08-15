import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

import { FREE_HISTORY_RETENTION_DAYS } from '../shared/entitlements'
import { ChatView } from './components/ChatView'
import { CommandPalette } from './components/CommandPalette'
import { CreateFolderModal } from './components/CreateFolderModal'
import { EntityMemoryView } from './components/EntityMemoryView'
import { ErrorBoundary } from './components/ErrorBoundary'
import { HomeView } from './components/HomeView'
import { MeetingWorkspace } from './components/MeetingWorkspace'
import { MeetingsListView } from './components/MeetingsListView'
import { MicPickerModal } from './components/MicPickerModal'
import { OfflineBanner } from './components/OfflineBanner'
import { UpdateBanner } from './components/UpdateBanner'
import { OnboardingFlow } from './components/OnboardingFlow'
import { SettingsPanel } from './components/SettingsPanel'
import { SharedWithMeView } from './components/SharedWithMeView'
import { Sidebar } from './components/Sidebar'
import { SidebarToggle } from './components/SidebarToggle'
import { ToastProvider } from './components/ui/Toast'
import { useAudioPreferences } from './hooks/useAudioPreferences'
import { useAuth } from './hooks/useAuth'
import { useCalendar } from './hooks/useCalendar'
import { useFolders } from './hooks/useFolders'
import { useMeetings } from './hooks/useMeetings'
import { useTags } from './hooks/useTags'
import { useRecording } from './hooks/useRecording'
import { useSidebarWidth } from './hooks/useSidebarWidth'
import { formatMicCaptureError, isMicPermissionError } from './lib/microphones'
import { takeDiscardMeetingOnMicCancel } from './lib/micPickerCancel'
import { applyTheme } from './lib/theme'
import { meetingAttendeesFromCalendar } from '../shared/speakers'
import type { CalendarEvent } from '../shared/calendar'
import type { DetectedMeetingPayload } from '../shared/meetingDetection'
import type { CitationFocus } from '../shared/citationNav'
import type { MeetingTemplateId } from '../shared/meetingTemplates'
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
  const {
    meetings,
    createMeeting,
    updateMeeting,
    deleteMeeting,
    enhanceMeeting,
    getMeeting,
    setMeetingTemplate,
  } = useMeetings()
  const {
    folders,
    createFolder,
    renameFolder,
    updateFolder,
    reorderFolders,
    deleteFolder,
    setMeetingFolders,
  } = useFolders()
  const { tags: allTags, setMeetingTags } = useTags()
  const { dragging: sidebarResizing, onResizePointerDown, resetWidth: resetSidebarWidth } =
    useSidebarWidth()
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [activeMeeting, setActiveMeeting] = useState<Meeting | null>(null)
  const [transcriptFocus, setTranscriptFocus] = useState<CitationFocus | null>(null)
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
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const [folderModal, setFolderModal] = useState<
    | null
    | {
        mode: 'create' | 'edit'
        parentId?: string | null
        folderId?: string
        assignToMeetingId?: string | null
      }
  >(null)
  const captureMeetingIdRef = useRef<string | null>(null)
  /** Meeting created for this capture attempt — discard on mic-picker cancel. */
  const discardMeetingOnMicCancelRef = useRef<string | null>(null)

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
          setCaptureMeetingId(data.meetingId!)
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

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const meta = event.metaKey || event.ctrlKey
      if (!meta || event.key.toLowerCase() !== 's') return
      const target = event.target as HTMLElement | null
      const tag = target?.tagName?.toLowerCase()
      if (tag === 'input' || tag === 'textarea' || target?.isContentEditable) return
      event.preventDefault()
      setSidebarCollapsed((collapsed) => !collapsed)
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
    async (meetingId: string, options?: { discardOnMicCancel?: boolean }) => {
      setMicPickerError(null)
      setMicPermissionDenied(false)
      discardMeetingOnMicCancelRef.current = options?.discardOnMicCancel ? meetingId : null

      const status = (await window.electronAPI.invoke('audio:status')) as {
        isRecording?: boolean
        meetingId?: string | null
      }
      if (status.isRecording) {
        const activeId = status.meetingId ?? meetingId
        discardMeetingOnMicCancelRef.current = null
        setCaptureMeetingId(activeId)
        setSelectedId(activeId)
        setMicPickerOpen(false)
        return
      }

      setCaptureMeetingId(meetingId)
      setSelectedId(meetingId)
      if (prefs?.skipMicPicker) {
        try {
          await recording.start(meetingId)
          discardMeetingOnMicCancelRef.current = null
          setMicPickerOpen(false)
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
    const status = (await window.electronAPI.invoke('audio:status')) as {
      isRecording?: boolean
      meetingId?: string | null
    }
    if (status.isRecording) {
      const activeId = status.meetingId
      if (activeId) {
        setCaptureMeetingId(activeId)
        setSelectedId(activeId)
      }
      setMicPickerOpen(false)
      return
    }

    const meeting = await createMeeting()
    setSelectedId(meeting.id)
    setActiveMeeting(meeting)
    await beginCapture(meeting.id, { discardOnMicCancel: true })
  }, [beginCapture, createMeeting])

  const handleTrayNewNote = useCallback(async () => {
    const meeting = await createMeeting()
    setSelectedId(meeting.id)
    setActiveMeeting(meeting)
    setNav({ view: 'home' })
    setSettingsOpen(false)
  }, [createMeeting])

  const handleTrayOpenMeeting = useCallback(
    (meetingId: string) => {
      const meeting = meetings.find((item) => item.id === meetingId)
      if (!meeting || isMeetingLocked(meeting, connection.plan)) return
      setSelectedId(meetingId)
      setActiveMeeting(meeting)
      setNav({ view: 'home' })
      setSettingsOpen(false)
    },
    [connection.plan, meetings],
  )

  useEffect(() => {
    const offs = [
      window.electronAPI.on('tray:new-note', () => {
        void handleTrayNewNote()
      }),
      window.electronAPI.on('tray:start-recording', () => {
        void handleNewMeeting()
      }),
      window.electronAPI.on('tray:open-meeting', (payload) => {
        const meetingId =
          payload && typeof payload === 'object' && 'meetingId' in payload
            ? String((payload as { meetingId?: unknown }).meetingId ?? '')
            : ''
        if (meetingId) handleTrayOpenMeeting(meetingId)
      }),
      window.electronAPI.on('tray:open-settings', () => {
        setSettingsOpen(true)
      }),
      window.electronAPI.on('tray:open-permissions', () => {
        setSettingsOpen(true)
        void window.electronAPI.invoke('permissions:request-microphone')
      }),
    ]
    return () => {
      for (const off of offs) off()
    }
  }, [handleNewMeeting, handleTrayNewNote, handleTrayOpenMeeting])

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
      await beginCapture(meeting.id, { discardOnMicCancel: true })
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

  const handleDetectedMeeting = useCallback(
    async (payload: DetectedMeetingPayload) => {
      if (payload.calendarEvent?.id && payload.calendarEvent.provider) {
        if (payload.calendarEvent.meetingUrl) {
          void window.electronAPI.invoke(
            'calendar:open-meeting-url',
            payload.calendarEvent.meetingUrl,
          )
        }
        await handleStartCalendarEvent(payload.calendarEvent)
        return
      }

      const meeting = await createMeeting({
        title: payload.suggestedTitle || `${payload.appName} call`,
      })
      setSelectedId(meeting.id)
      setActiveMeeting(meeting)
      await beginCapture(meeting.id, { discardOnMicCancel: true })
    },
    [beginCapture, createMeeting, handleStartCalendarEvent, setActiveMeeting],
  )

  useEffect(() => {
    const off = window.electronAPI.on('meeting:detection-start', (raw) => {
      const payload = raw as DetectedMeetingPayload
      if (!payload?.title) return
      void handleDetectedMeeting(payload)
    })
    return off
  }, [handleDetectedMeeting])

  const handleStartCapture = useCallback(
    (meetingId: string) => {
      void beginCapture(meetingId)
    },
    [beginCapture],
  )

  const handleMicPickerClose = useCallback(() => {
    const { deleteId: discardId } = takeDiscardMeetingOnMicCancel(
      discardMeetingOnMicCancelRef.current,
    )
    discardMeetingOnMicCancelRef.current = null
    setMicPickerOpen(false)
    setMicPickerError(null)
    setMicPermissionDenied(false)
    setCaptureMeetingId(null)
    if (!discardId) return
    if (selectedId === discardId) setSelectedId(null)
    if (activeMeeting?.id === discardId) setActiveMeeting(null)
    void deleteMeeting(discardId)
  }, [activeMeeting?.id, deleteMeeting, selectedId])

  const handleMicPickerStart = useCallback(
    async (
      deviceId: string,
      label: string,
      skipNextTime: boolean,
      templateId: MeetingTemplateId,
    ) => {
      const meetingId = captureMeetingIdRef.current
      if (!meetingId) return

      setMicPickerError(null)
      setMicPermissionDenied(false)
      await updatePrefs({
        preferredMicrophoneId: deviceId,
        preferredMicrophoneLabel: label,
      })
      if (templateId !== 'general') {
        await setMeetingTemplate(meetingId, templateId)
      }

      try {
        await recording.start(meetingId)
        discardMeetingOnMicCancelRef.current = null
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
    [recording, setMeetingTemplate, updatePrefs],
  )

  const handleUpdate = useCallback(
    async (patch: {
      title?: string
      userNotes?: string
      speakerLabels?: Record<string, string>
      speakerIdentities?: SpeakerIdentities
      actionItems?: string[]
      completedActionItems?: string[]
      enhancedNotes?: string
      evidenceCache?: Record<string, string>
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

  const handleOpenCitation = useCallback(
    (citation: CitationFocus) => {
      setTranscriptFocus(citation)
      void handleSelect(citation.meetingId)
    },
    [handleSelect],
  )

  const handleSelectView = useCallback((selection: SidebarSelection) => {
    setNav(selection)
    setSelectedId(null)
    setActiveMeeting(null)
  }, [])

  const liveMeetingPin = useMemo(() => {
    if (!captureMeetingId) return null
    if (recording.state !== 'recording' && recording.state !== 'paused') return null
    const meeting =
      meetings.find((item) => item.id === captureMeetingId) ??
      (activeMeeting?.id === captureMeetingId ? activeMeeting : null)
    if (!meeting) return null
    return {
      id: meeting.id,
      title: meeting.title?.trim() || 'Untitled meeting',
      startedAt: meeting.startedAt ?? Date.now(),
      paused: recording.state === 'paused',
    }
  }, [captureMeetingId, recording.state, meetings, activeMeeting])

  const handleOpenLiveMeeting = useCallback(() => {
    if (!liveMeetingPin) return
    void window.electronAPI.invoke('widget:focus-main')
    void getMeeting(liveMeetingPin.id).then((meeting) => {
      if (!meeting) return
      setSelectedId(meeting.id)
      setActiveMeeting(meeting)
      setCaptureMeetingId(meeting.id)
      setNav({ view: 'meetings' })
    })
  }, [getMeeting, liveMeetingPin])

  const handleStopLiveMeeting = useCallback(() => {
    void recording.stop()
  }, [recording])

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
    if (nav.view === 'tag' && nav.tagName) {
      const wanted = nav.tagName.toLowerCase()
      return meetings.filter((meeting) =>
        (meeting.tags ?? []).some((tag) => tag.toLowerCase() === wanted),
      )
    }
    return meetings
  }, [meetings, nav])

  const folderTitle =
    nav.view === 'folder'
      ? folders.find((folder) => folder.id === nav.folderId)?.name ?? 'Folder'
      : nav.view === 'tag'
        ? `#${nav.tagName ?? ''}`
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
        className={`app-shell${
          sidebarCollapsed ? ' is-sidebar-collapsed' : ''
        }`}
      >
        <div className="app-titlebar-drag" aria-hidden="true" />
        <OfflineBanner />
        <UpdateBanner />
        <SidebarToggle
          expanded={!sidebarCollapsed}
          onToggle={() => setSidebarCollapsed((collapsed) => !collapsed)}
          className="sidebar-toggle-chrome"
        />
        <Sidebar
          selection={nav}
          onSelectView={handleSelectView}
          meetings={meetings}
          onSelectMeeting={(id) => void handleSelect(id)}
          folders={folders}
          onCreateFolder={(parentId) =>
            setFolderModal({ mode: 'create', parentId: parentId ?? null })
          }
          onEditFolder={(id) => setFolderModal({ mode: 'edit', folderId: id })}
          onRenameFolder={(id, name) => void renameFolder(id, name)}
          onUpdateFolder={(id, patch) => void updateFolder(id, patch)}
          onReorderFolders={(orderedIds, parentId) => void reorderFolders(orderedIds, parentId)}
          onDeleteFolder={(id) => void deleteFolder(id)}
          onDropMeetingOnFolder={(meetingId, folderId) => {
            const meeting = meetings.find((m) => m.id === meetingId)
            if (!meeting) return
            const next = Array.from(new Set([...(meeting.folderIds ?? []), folderId]))
            void setMeetingFolders(meetingId, next)
          }}
          allTags={allTags}
          connection={connection}
          calendarConnected={calendarStatus.connected}
          onNewMeeting={() => void handleNewMeeting()}
          onConnect={() => void openConnect()}
          onOpenDashboard={() => void openDashboard()}
          onOpenSettings={() => setSettingsOpen(true)}
          onConnectCalendar={() => void openCalendarConnect('google')}
          liveMeeting={liveMeetingPin}
          onOpenLiveMeeting={handleOpenLiveMeeting}
          onStopLiveMeeting={handleStopLiveMeeting}
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
          onStart={(deviceId, label, skipNextTime, templateId) =>
            handleMicPickerStart(deviceId, label, skipNextTime, templateId)
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

        {folderModal ? (
          <CreateFolderModal
            open
            mode={folderModal.mode}
            initial={
              folderModal.mode === 'edit' && folderModal.folderId
                ? (() => {
                    const folder = folders.find((f) => f.id === folderModal.folderId)
                    if (!folder) return { parentId: null }
                    return {
                      name: folder.name,
                      color: folder.color as import('../shared/folderAppearance').FolderColorId,
                      icon: folder.icon,
                      parentId: folder.parentId,
                    }
                  })()
                : { parentId: folderModal.parentId ?? null }
            }
            onClose={() => setFolderModal(null)}
            onSubmit={async (values) => {
              if (folderModal.mode === 'edit' && folderModal.folderId) {
                await updateFolder(folderModal.folderId, {
                  name: values.name,
                  color: values.color,
                  icon: values.icon,
                })
                return
              }
              const folder = await createFolder({
                name: values.name,
                color: values.color,
                icon: values.icon,
                parentId: values.parentId ?? null,
              })
              const meetingId = folderModal.assignToMeetingId
              if (folder?.id && meetingId) {
                const meeting =
                  activeMeeting?.id === meetingId
                    ? activeMeeting
                    : meetings.find((m) => m.id === meetingId)
                const next = Array.from(new Set([...(meeting?.folderIds ?? []), folder.id]))
                await setMeetingFolders(meetingId, next)
                if (activeMeeting?.id === meetingId) {
                  const refreshed = await getMeeting(meetingId)
                  if (refreshed) setActiveMeeting(refreshed)
                }
              }
            }}
          />
        ) : null}

        <main className="workspace">
          {activeMeeting ? (
            <MeetingWorkspace
              meeting={activeMeeting}
              connected={connection.paired}
              plan={connection.plan}
              ownerEmail={connection.email}
              captureMeetingId={captureMeetingId}
              recording={recording}
              folders={folders}
              onStartCapture={handleStartCapture}
              onUpdate={(patch) => void handleUpdate(patch)}
              onDelete={requestDelete}
              onEnhance={() => void handleEnhance()}
              onConnect={() => void openConnect()}
              onOpenDashboard={() => void openDashboard()}
              onSetFolders={(folderIds) => {
                void setMeetingFolders(activeMeeting.id, folderIds).then(async () => {
                  const refreshed = await getMeeting(activeMeeting.id)
                  if (refreshed) setActiveMeeting(refreshed)
                })
              }}
              onRequestCreateFolder={() =>
                setFolderModal({
                  mode: 'create',
                  parentId: null,
                  assignToMeetingId: activeMeeting.id,
                })
              }
              allTags={allTags}
              onSetTags={(tags) => {
                void setMeetingTags(activeMeeting.id, tags).then(async () => {
                  const refreshed = await getMeeting(activeMeeting.id)
                  if (refreshed) setActiveMeeting(refreshed)
                })
              }}
              onChangeTemplate={(templateId) => {
                void setMeetingTemplate(activeMeeting.id, templateId).then(async () => {
                  const refreshed = await getMeeting(activeMeeting.id)
                  if (refreshed) setActiveMeeting(refreshed)
                  await handleEnhance()
                })
              }}
              transcriptFocus={
                transcriptFocus && transcriptFocus.meetingId === activeMeeting.id
                  ? transcriptFocus
                  : null
              }
              onTranscriptFocusConsumed={() => setTranscriptFocus(null)}
              relatedMeetings={meetings}
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
              onOpenCitation={handleOpenCitation}
              isMeetingLocked={(meeting) => isMeetingLocked(meeting, connection.plan)}
            />
          ) : nav.view === 'chat' ? (
            <ChatView
              meetings={meetings}
              folders={folders}
              paired={connection.paired}
              onConnect={() => void openConnect()}
              onOpenMeeting={(id) => void handleSelect(id)}
              onOpenCitation={handleOpenCitation}
              initialScope={
                nav.personEmail ? 'person' : nav.company ? 'company' : 'all'
              }
              initialPersonEmail={nav.personEmail ?? ''}
              initialCompany={nav.company ?? ''}
              onOpenEntity={(kind, value) =>
                handleSelectView(
                  kind === 'person'
                    ? { view: 'person', personEmail: value }
                    : { view: 'company', company: value },
                )
              }
            />
          ) : nav.view === 'person' && nav.personEmail ? (
            <EntityMemoryView
              kind="person"
              value={nav.personEmail}
              meetings={meetings}
              onOpenMeeting={(id) => void handleSelect(id)}
              onOpenScopedChat={(scope, value) =>
                handleSelectView(
                  scope === 'person'
                    ? { view: 'chat', personEmail: value }
                    : { view: 'chat', company: value },
                )
              }
            />
          ) : nav.view === 'company' && nav.company ? (
            <EntityMemoryView
              kind="company"
              value={nav.company}
              meetings={meetings}
              onOpenMeeting={(id) => void handleSelect(id)}
              onOpenScopedChat={(scope, value) =>
                handleSelectView(
                  scope === 'person'
                    ? { view: 'chat', personEmail: value }
                    : { view: 'chat', company: value },
                )
              }
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
                  : nav.view === 'tag'
                    ? 'Meetings tagged with this label'
                    : 'All of your meeting notes'
              }
              meetings={filteredMeetings}
              selectedId={selectedId}
              connection={connection}
              onSelectMeeting={(id) => void handleSelect(id)}
              onOpenDashboard={() => void openDashboard()}
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
