import type { CustomerPlatform } from '@/lib/platform'

const GITHUB_REPO = 'Tayowill/clarificluely'

export const CLARIFI_VERSION = '1.0.0'
export const MAC_DMG_ARM64_FILENAME = 'Clarifi-1.0.0-arm64.dmg'
export const MAC_DMG_X64_FILENAME = 'Clarifi-1.0.0-x64.dmg'
/** @deprecated Use MAC_DMG_ARM64_FILENAME */
export const MAC_DMG_FILENAME = MAC_DMG_ARM64_FILENAME
export const WIN_EXE_FILENAME = 'Clarifi Setup 1.0.0.exe'
export const MAC_QUARANTINE_COMMAND =
  'xattr -r -d com.apple.quarantine /Applications/Clarifi.app'

export type MacArch = 'arm64' | 'x64'
export type DownloadTarget = 'mac-arm64' | 'mac-x64' | 'windows'

export type DownloadPlatformManifest = {
  id: DownloadTarget
  label: string
  shortLabel: string
  pillLabel: string
  filename: string
  path: string
  href: string
  macArch?: MacArch
}

export function macDmgFilename(arch: MacArch): string {
  return arch === 'x64' ? MAC_DMG_X64_FILENAME : MAC_DMG_ARM64_FILENAME
}

export function getMacDownloadPath(arch: MacArch = 'arm64'): string {
  return `/downloads/${encodeURIComponent(macDmgFilename(arch))}`
}

export function getWindowsDownloadPath(): string {
  return `/downloads/${encodeURIComponent(WIN_EXE_FILENAME)}`
}

export function getDownloadPageHref(target: DownloadTarget): string {
  if (target === 'windows') return '/download?platform=windows'
  const arch = target === 'mac-x64' ? 'x64' : 'arm64'
  return `/download?platform=mac&arch=${arch}`
}

export const DOWNLOAD_PLATFORMS: DownloadPlatformManifest[] = [
  {
    id: 'mac-arm64',
    label: 'macOS (Apple Silicon)',
    shortLabel: 'Mac — Apple Silicon',
    pillLabel: 'macOS — Apple Silicon',
    filename: MAC_DMG_ARM64_FILENAME,
    path: getMacDownloadPath('arm64'),
    href: getDownloadPageHref('mac-arm64'),
    macArch: 'arm64',
  },
  {
    id: 'mac-x64',
    label: 'macOS (Intel)',
    shortLabel: 'Mac — Intel',
    pillLabel: 'macOS — Intel',
    filename: MAC_DMG_X64_FILENAME,
    path: getMacDownloadPath('x64'),
    href: getDownloadPageHref('mac-x64'),
    macArch: 'x64',
  },
  {
    id: 'windows',
    label: 'Windows (64-bit)',
    shortLabel: 'Windows (.exe)',
    pillLabel: 'Windows (.exe)',
    filename: WIN_EXE_FILENAME,
    path: getWindowsDownloadPath(),
    href: getDownloadPageHref('windows'),
  },
]

export function getDownloadManifest(target: DownloadTarget): DownloadPlatformManifest {
  return DOWNLOAD_PLATFORMS.find((p) => p.id === target) ?? DOWNLOAD_PLATFORMS[0]
}

function githubReleaseAssetUrl(filename: string): string {
  const tag = `v${CLARIFI_VERSION}`
  return `https://github.com/${GITHUB_REPO}/releases/download/${tag}/${encodeURIComponent(filename)}`
}

function isStaleLocalDownloadOverride(url: string): boolean {
  try {
    const parsed = new URL(url)
    return parsed.pathname.startsWith('/downloads/') && !parsed.hostname.includes('github.com')
  } catch {
    return url.startsWith('/downloads/')
  }
}

function resolveDownloadOverride(
  override: string | undefined,
  fallback: () => string,
): string {
  const trimmed = override?.trim()
  if (!trimmed || isStaleLocalDownloadOverride(trimmed)) return fallback()
  return trimmed
}

export function getMacDownloadUrl(arch: MacArch = 'arm64'): string {
  if (arch === 'arm64') {
    return resolveDownloadOverride(
      process.env.NEXT_PUBLIC_CLARIFI_MAC_DOWNLOAD_URL,
      () => githubReleaseAssetUrl(macDmgFilename('arm64')),
    )
  }
  return resolveDownloadOverride(
    process.env.NEXT_PUBLIC_CLARIFI_MAC_X64_DOWNLOAD_URL,
    () => githubReleaseAssetUrl(macDmgFilename('x64')),
  )
}

export function getWindowsDownloadUrl(): string {
  return resolveDownloadOverride(
    process.env.NEXT_PUBLIC_CLARIFI_WIN_DOWNLOAD_URL,
    () => githubReleaseAssetUrl(WIN_EXE_FILENAME),
  )
}

export function getDownloadForTarget(target: DownloadTarget): {
  url: string
  filename: string
  label: string
} {
  const entry = getDownloadManifest(target)
  if (target === 'windows') {
    return {
      url: getWindowsDownloadUrl(),
      filename: WIN_EXE_FILENAME,
      label: entry.label,
    }
  }
  const arch = entry.macArch ?? 'arm64'
  return {
    url: getMacDownloadUrl(arch),
    filename: macDmgFilename(arch),
    label: entry.label,
  }
}

/** @deprecated Use getDownloadForTarget */
export function getDownloadForPlatform(platform: CustomerPlatform): {
  url: string
  filename: string
  label: string
} {
  return getDownloadForTarget(platform === 'windows' ? 'windows' : 'mac-arm64')
}

export function parseMacArch(value: string | null | undefined): MacArch {
  return value === 'x64' ? 'x64' : 'arm64'
}

export function parseDownloadTarget(
  platform: string | null | undefined,
  arch?: string | null | undefined,
): DownloadTarget {
  if (platform === 'windows') return 'windows'
  return parseMacArch(arch) === 'x64' ? 'mac-x64' : 'mac-arm64'
}

export function parseDownloadPlatform(value: string | null | undefined): CustomerPlatform {
  if (value === 'windows') return 'windows'
  return 'mac'
}

export function downloadTargetToPlatform(target: DownloadTarget): CustomerPlatform {
  return target === 'windows' ? 'windows' : 'mac'
}
