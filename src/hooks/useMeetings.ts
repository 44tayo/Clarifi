import { useCallback, useEffect, useState } from 'react'

import type { Meeting } from '../types/meeting'

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

  const createMeeting = useCallback(async (title?: string) => {
    const meeting = (await window.electronAPI.invoke('meetings:create', { title })) as Meeting
    await refresh()
    return meeting
  }, [refresh])

  const updateMeeting = useCallback(
    async (id: string, patch: { title?: string; userNotes?: string }) => {
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

  return {
    meetings,
    loading,
    refresh,
    createMeeting,
    updateMeeting,
    deleteMeeting,
    getMeeting,
    enhanceMeeting,
  }
}
