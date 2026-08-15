/** Baked at build time via vite `define`; fallback for local electron builds. */
declare const __CLARIFI_API_URL__: string | undefined

export const DEFAULT_PRODUCTION_API_URL = 'https://www.clarifiapp.com'

export function getPackagedApiUrl(): string {
  if (typeof __CLARIFI_API_URL__ === 'string' && __CLARIFI_API_URL__.trim()) {
    return __CLARIFI_API_URL__.trim()
  }
  return DEFAULT_PRODUCTION_API_URL
}
