import { useCallback, useEffect, useState } from 'react'

import type { ConnectionStatus } from '../types/meeting'

export function useAuth() {
  const [connection, setConnection] = useState<ConnectionStatus>({ paired: false })
  const [loading, setLoading] = useState(true)

  const refresh = useCallback(async () => {
    const status = (await window.electronAPI.invoke('auth:connection-status')) as ConnectionStatus
    setConnection(status)
    setLoading(false)
  }, [])

  useEffect(() => {
    void refresh()
    const off = window.electronAPI.on('auth:connected', () => {
      void refresh()
    })
    return off
  }, [refresh])

  const openConnect = useCallback(async () => {
    await window.electronAPI.invoke('auth:open-connect')
  }, [])

  const openDashboard = useCallback(async () => {
    await window.electronAPI.invoke('auth:open-dashboard')
  }, [])

  return { connection, loading, refresh, openConnect, openDashboard }
}
