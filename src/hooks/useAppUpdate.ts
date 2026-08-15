import { useCallback, useEffect, useState } from 'react'

export type AppUpdateStatus = {
  currentVersion: string
  packaged: boolean
  checking: boolean
  availableVersion: string | null
  releaseNotes: string | null
  downloadPercent: number | null
  downloaded: boolean
  lastCheckedAt: number | null
  error: string | null
}

const EMPTY: AppUpdateStatus = {
  currentVersion: '',
  packaged: false,
  checking: false,
  availableVersion: null,
  releaseNotes: null,
  downloadPercent: null,
  downloaded: false,
  lastCheckedAt: null,
  error: null,
}

function asStatus(raw: unknown): AppUpdateStatus {
  if (!raw || typeof raw !== 'object') return EMPTY
  const o = raw as Record<string, unknown>
  return {
    currentVersion: typeof o.currentVersion === 'string' ? o.currentVersion : '',
    packaged: o.packaged === true,
    checking: o.checking === true,
    availableVersion: typeof o.availableVersion === 'string' ? o.availableVersion : null,
    releaseNotes: typeof o.releaseNotes === 'string' ? o.releaseNotes : null,
    downloadPercent: typeof o.downloadPercent === 'number' ? o.downloadPercent : null,
    downloaded: o.downloaded === true,
    lastCheckedAt: typeof o.lastCheckedAt === 'number' ? o.lastCheckedAt : null,
    error: typeof o.error === 'string' ? o.error : null,
  }
}

export function useAppUpdate() {
  const [status, setStatus] = useState<AppUpdateStatus>(EMPTY)
  const [dismissedVersion, setDismissedVersion] = useState<string | null>(null)

  useEffect(() => {
    void window.electronAPI.invoke('update:get-status').then((raw) => {
      setStatus(asStatus(raw))
    })

    const offs = [
      window.electronAPI.on('update:status', (payload) => setStatus(asStatus(payload))),
      window.electronAPI.on('update:available', (payload) => {
        const version =
          payload && typeof payload === 'object' && typeof (payload as { version?: unknown }).version === 'string'
            ? (payload as { version: string }).version
            : null
        setStatus((prev) => ({
          ...prev,
          checking: false,
          availableVersion: version,
          downloaded: false,
          downloadPercent: null,
          error: null,
        }))
      }),
      window.electronAPI.on('update:progress', (payload) => {
        const percent =
          payload &&
          typeof payload === 'object' &&
          typeof (payload as { percent?: unknown }).percent === 'number'
            ? (payload as { percent: number }).percent
            : null
        setStatus((prev) => ({ ...prev, downloadPercent: percent }))
      }),
      window.electronAPI.on('update:downloaded', (payload) => {
        const version =
          payload && typeof payload === 'object' && typeof (payload as { version?: unknown }).version === 'string'
            ? (payload as { version: string }).version
            : null
        setStatus((prev) => ({
          ...prev,
          checking: false,
          downloaded: true,
          downloadPercent: 100,
          availableVersion: version ?? prev.availableVersion,
          error: null,
        }))
        setDismissedVersion(null)
      }),
      window.electronAPI.on('update:error', (payload) => {
        const message =
          payload &&
          typeof payload === 'object' &&
          typeof (payload as { message?: unknown }).message === 'string'
            ? (payload as { message: string }).message
            : 'Couldn’t check for updates'
        setStatus((prev) => ({ ...prev, checking: false, error: message }))
      }),
      window.electronAPI.on('update:not-available', () => {
        setStatus((prev) => ({
          ...prev,
          checking: false,
          availableVersion: null,
          downloaded: false,
          downloadPercent: null,
          error: null,
          lastCheckedAt: Date.now(),
        }))
      }),
      window.electronAPI.on('update:menu-check', () => {
        setDismissedVersion(null)
      }),
    ]

    return () => {
      for (const off of offs) off()
    }
  }, [])

  const check = useCallback(async () => {
    setDismissedVersion(null)
    setStatus((prev) => ({ ...prev, checking: true, error: null }))
    const raw = await window.electronAPI.invoke('update:check')
    setStatus(asStatus(raw))
    return asStatus(raw)
  }, [])

  const download = useCallback(async () => {
    setDismissedVersion(null)
    const raw = await window.electronAPI.invoke('update:download')
    setStatus(asStatus(raw))
    return asStatus(raw)
  }, [])

  const install = useCallback(async () => {
    const raw = await window.electronAPI.invoke('update:install')
    setStatus(asStatus(raw))
    return asStatus(raw)
  }, [])

  const dismiss = useCallback(() => {
    const version = status.availableVersion
    if (version) setDismissedVersion(version)
  }, [status.availableVersion])

  const bannerVisible =
    Boolean(status.availableVersion) && status.availableVersion !== dismissedVersion

  return {
    status,
    bannerVisible,
    check,
    download,
    install,
    dismiss,
  }
}
