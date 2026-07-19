// Shared allowlist for any URL the Electron app opens in the user's default
// browser. Blocks schemes like file:, javascript:, or custom protocol
// handlers that could be abused if a URL is ever influenced by untrusted
// input (a compromised renderer, a malformed deep link, etc.).
const ALLOWED_EXTERNAL_SCHEMES = new Set(['https:', 'mailto:'])

function isLocalDevHttp(parsed: URL): boolean {
  if (parsed.protocol !== 'http:') return false
  return (
    parsed.hostname === 'localhost' ||
    parsed.hostname === '127.0.0.1' ||
    parsed.hostname === '[::1]'
  )
}

export function isAllowedExternalUrl(url: string): boolean {
  try {
    const parsed = new URL(url)
    if (ALLOWED_EXTERNAL_SCHEMES.has(parsed.protocol)) return true
    return isLocalDevHttp(parsed)
  } catch {
    return false
  }
}
