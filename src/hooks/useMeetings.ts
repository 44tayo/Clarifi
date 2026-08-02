import { useCallback, useEffect, useState } from 'react'

import type { MeetingTemplateId } from '../../shared/meetingTemplates'
import type { Meeting, MeetingAttendee, SpeakerIdentities } from '../types/meeting'

export function useMeetings() {
  const [meetings, setMeetings] = useState<Meeting[]>([])
  const [loading, setLoading] = useState(true)

  const refresh = useCallback(async () => {
    const list = (await window.electronAPI.invoke('meetings:list')) as Meeting[]
    setMeetings(Array.isArray(list) ? list : [])
    setLoading(false)
  }, [])

  useEffect(() => {
    void refresh()
    const offChanged = window.electronAPI.on('meetings:changed', () => {
      void refresh()
    })
    const offEnhanced = window.electronAPI.on('meetings:enhanced', () => {
      void refresh()
    })
    return () => {
      offChanged()
      offEnhanced()
    }
  }, [refresh])

  const createMeeting = useCallback(
    async (input?: {
      title?: string
      calendarEventId?: string
      calendarProvider?: 'google' | 'microsoft'
      scheduledStart?: number
      attendeeEmails?: string[]
      attendees?: MeetingAttendee[]
      speakerLabels?: Record<string, string>
      speakerIdentities?: SpeakerIdentities
      templateId?: MeetingTemplateId
    }) => {
      const meeting = (await window.electronAPI.invoke('meetings:create', input ?? {})) as Meeting
      await refresh()
      return meeting
    },
    [refresh],
  )

  const updateMeeting = useCallback(
    async (
      id: string,
      patch: {
        title?: string
        userNotes?: string
        speakerLabels?: Record<string, string>
        speakerIdentities?: SpeakerIdentities
        attendees?: MeetingAttendee[]
        attendeeEmails?: string[]
        actionItems?: string[]
        completedActionItems?: string[]
        enhancedNotes?: string
        evidenceCache?: Record<string, string>
      },
    ) => {
      const updated = (await window.electronAPI.invoke('meetings:update', {
        id,
        ...patch,
      })) as Meeting | null
      await refresh()
      return updated
    },
    [refresh],
  )

  const deleteMeeting = useCallback(
    async (id: string) => {
      await window.electronAPI.invoke('meetings:delete', id)
      await refresh()
    },
    [refresh],
  )

  const getMeeting = useCallback(async (id: string) => {
    return (await window.electronAPI.invoke('meetings:get', id)) as Meeting | null
  }, [])

  const enhanceMeeting = useCallback(
    async (id: string) => {
      const updated = (await window.electronAPI.invoke('meetings:enhance', id)) as Meeting | null
      await refresh()
      return updated
    },
    [refresh],
  )

  const setMeetingTemplate = useCallback(
    async (id: string, templateId: MeetingTemplateId) => {
      const updated = (await window.electronAPI.invoke('meetings:set-template', {
        id,
        templateId,
      })) as Meeting | null
      await refresh()
      return updated
    },
    [refresh],
  )

  return {
    meetings,
    loading,
    refresh,
    createMeeting,
    updateMeeting,
    deleteMeeting,
    getMeeting,
    enhanceMeeting,
    setMeetingTemplate,
  }
}
