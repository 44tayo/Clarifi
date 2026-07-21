import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

import { FREE_HISTORY_RETENTION_DAYS } from '../shared/entitlements'
import { ErrorBoundary } from './components/ErrorBoundary'
import { MeetingWorkspace } from './components/MeetingWorkspace'
import { MicPickerModal } from './components/MicPickerModal'
import { OfflineBanner } from './components/OfflineBanner'
import { OnboardingFlow } from './components/OnboardingFlow'
import { SettingsPanel } from './components/SettingsPanel'
import { Sidebar } from './components/Sidebar'
import { useAudioPreferences } from './hooks/useAudioPreferences'
import { useAuth } from './hooks/useAuth'
import { speakerHintsFromEvent, useCalendar } from './hooks/useCalendar'
import { useMeetings } from './hooks/useMeetings'
import { useRecording } from './hooks/useRecording'
import { formatMicCaptureError, isMicPermissionError } from './lib/microphones'
import type { CalendarEvent } from '../shared/calendar'
import type { Meeting } from './types/meeting'

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
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [activeMeeting, setActiveMeeting] = useState<Meeting | null>(null)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [onboardingDone, setOnboardingDone] = useState<boolean | null>(null)
  const [captureMeetingId, setCaptureMeetingId] = useState<string | null>(null)
  const [micPickerOpen, setMicPickerOpen] = useState(false)
  const [micPickerError, setMicPickerError] = useState<string | null>(null)
  const [micPermissionDenied, setMicPermissionDenied] = useState(false)
  const captureMeetingIdRef = useRef<string | null>(null)

  const recording = useRecording(captureMeetingId)

  useEffect(() => {
    captureMeetingIdRef.current = captureMeetingId
  }, [captureMeetingId])

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
        <div className="app-titlebar-drag" aria-hidden="true" />
        <OfflineBanner />
        <Sidebar
          meetings={meetings}
          calendarEvents={calendarEvents}
          calendarConnected={calendarStatus.connected}
          calendarLoading={calendarLoading}
          selectedId={selectedId}
          connection={connection}
          onSelect={(id) => void handleSelect(id)}
          onNewMeeting={() => void handleNewMeeting()}
          onStartCalendarEvent={(event) => void handleStartCalendarEvent(event)}
          onConnectCalendar={(provider) => void openCalendarConnect(provider)}
          onConnect={() => void openConnect()}
          onOpenDashboard={() => void openDashboard()}
          onOpenSettings={() => setSettingsOpen(true)}
        />

        {settingsOpen ? (
          <SettingsPanel onClose={() => setSettingsOpen(false)} calendarEnabled={connection.paired} />
        ) : null}

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
                  New meeting
                </button>
              </div>
            </div>
          ) : (
            <MeetingWorkspace
              meeting={activeMeeting}
              connected={connection.paired}
              captureMeetingId={captureMeetingId}
              recording={recording}
              onStartCapture={handleStartCapture}
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
