const DEFAULT_APP_URL = 'https://www.clarifiapp.com'
export const MAC_DMG_FILENAME = 'Clarifi-0.1.0-arm64.dmg'
export const WIN_EXE_FILENAME = 'Clarifi Setup 0.1.0.exe'

export function getMacDownloadPath(): string {
  return `/downloads/${encodeURIComponent(MAC_DMG_FILENAME)}`
}

export function getWindowsDownloadPath(): string {
  return `/downloads/${encodeURIComponent(WIN_EXE_FILENAME)}`
}

function resolveAppUrl(): string {
  return (process.env.NEXT_PUBLIC_APP_URL?.trim() || DEFAULT_APP_URL).replace(/\/$/, '')
}

export function getMacDownloadUrl(): string {
  const override = process.env.NEXT_PUBLIC_CLARIFI_MAC_DOWNLOAD_URL?.trim()
  if (override) return override
  return `${resolveAppUrl()}${getMacDownloadPath()}`
}

export function getWindowsDownloadUrl(): string {
  const override = process.env.NEXT_PUBLIC_CLARIFI_WIN_DOWNLOAD_URL?.trim()
  if (override) return override
  return `${resolveAppUrl()}${getWindowsDownloadPath()}`
}

export function getDownloadForPlatform(platform: 'mac' | 'windows'): {
  url: string
  filename: string
  label: string
} {
  if (platform === 'windows') {
    return {
      url: getWindowsDownloadUrl(),
      filename: WIN_EXE_FILENAME,
      label: 'Download for Windows',
    }
  }
  return {
    url: getMacDownloadUrl(),
    filename: MAC_DMG_FILENAME,
    label: 'Download for macOS (Apple Silicon)',
  }
}
