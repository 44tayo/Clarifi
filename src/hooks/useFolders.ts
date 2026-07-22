import { useCallback, useEffect, useState } from 'react'

import type { Folder } from '../types/meeting'

export function useFolders() {
  const [folders, setFolders] = useState<Folder[]>([])
  const [loading, setLoading] = useState(true)

  const refresh = useCallback(async () => {
    const list = (await window.electronAPI.invoke('folders:list')) as Folder[]
    setFolders(Array.isArray(list) ? list : [])
    setLoading(false)
  }, [])

  useEffect(() => {
    void refresh()
    const off = window.electronAPI.on('meetings:changed', () => {
      void refresh()
    })
    return off
  }, [refresh])

  const createFolder = useCallback(
    async (name: string) => {
      const folder = (await window.electronAPI.invoke('folders:create', name)) as Folder
      await refresh()
      return folder
    },
    [refresh],
  )

  const renameFolder = useCallback(
    async (id: string, name: string) => {
      const folder = (await window.electronAPI.invoke('folders:rename', { id, name })) as Folder | null
      await refresh()
      return folder
    },
    [refresh],
  )

  const deleteFolder = useCallback(
    async (id: string) => {
      await window.electronAPI.invoke('folders:delete', id)
      await refresh()
    },
    [refresh],
  )

  const setMeetingFolders = useCallback(
    async (meetingId: string, folderIds: string[]) => {
      const updated = await window.electronAPI.invoke('meetings:set-folders', {
        id: meetingId,
        folderIds,
      })
      await refresh()
      return updated
    },
    [refresh],
  )

  return {
    folders,
    loading,
    refresh,
    createFolder,
    renameFolder,
    deleteFolder,
    setMeetingFolders,
  }
}
