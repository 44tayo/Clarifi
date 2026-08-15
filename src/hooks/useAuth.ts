import { useCallback, useEffect, useState } from 'react'

import type { ConnectionStatus } from '../types/meeting'

export function useAuth() {
  const [connection, setConnection] = useState<ConnectionStatus>({ paired: false })
  const [loading, setLoading] = useState(true)

  const refresh = useCallback(async (force = false) => {
    const status = (await window.electronAPI.invoke('auth:connection-status', { force })) as ConnectionStatus
    setConnection(status)
    setLoading(false)
  }, [])

  useEffect(() => {
    void refresh()
    const offConnected = window.electronAPI.on('auth:connected', () => {
      void refresh(true)
    })
    const onFocus = () => {
      void refresh(true)
    }
    window.addEventListener('focus', onFocus)
    return () => {
      offConnected()
      window.removeEventListener('focus', onFocus)
    }
  }, [refresh])

  const openConnect = useCallback(async () => {
    await window.electronAPI.invoke('auth:open-connect')
  }, [])

  const openSignIn = useCallback(async (provider: 'google' | 'azure' | 'email') => {
    await window.electronAPI.invoke('auth:open-sign-in', provider)
  }, [])

  const openDashboard = useCallback(async () => {
    await window.electronAPI.invoke('auth:open-dashboard')
  }, [])

  return { connection, loading, refresh, openConnect, openSignIn, openDashboard }
}
