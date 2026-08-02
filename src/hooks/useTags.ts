import { useCallback, useEffect, useState } from 'react'

export function useTags() {
  const [tags, setTags] = useState<string[]>([])
  const [loading, setLoading] = useState(true)

  const refresh = useCallback(async () => {
    const list = (await window.electronAPI.invoke('tags:list-all')) as string[]
    setTags(Array.isArray(list) ? list : [])
    setLoading(false)
  }, [])

  useEffect(() => {
    void refresh()
    const off = window.electronAPI.on('meetings:changed', () => {
      void refresh()
    })
    return off
  }, [refresh])

  const setMeetingTags = useCallback(
    async (meetingId: string, nextTags: string[]) => {
      const updated = await window.electronAPI.invoke('meetings:set-tags', {
        id: meetingId,
        tags: nextTags,
      })
      await refresh()
      return updated
    },
    [refresh],
  )

  return {
    tags,
    loading,
    refresh,
    setMeetingTags,
  }
}
