// Shared allowlist for any URL the Electron app opens in the user's default
// browser. Blocks schemes like file:, javascript:, or custom protocol
// handlers that could be abused if a URL is ever influenced by untrusted
// input (a compromised renderer, a malformed deep link, etc.).
const ALLOWED_EXTERNAL_SCHEMES = new Set(['https:', 'mailto:'])

export function isAllowedExternalUrl(url: string): boolean {
  try {
    return ALLOWED_EXTERNAL_SCHEMES.has(new URL(url).protocol)
  } catch {
    return false
  }
}
