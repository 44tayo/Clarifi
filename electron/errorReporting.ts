import { app } from 'electron'

let initialized = false

export async function initErrorReporting(): Promise<void> {
  const dsn = process.env.SENTRY_DSN?.trim()
  if (!dsn || initialized) return

  try {
    const Sentry = await import('@sentry/electron/main')
    Sentry.init({
      dsn,
      release: `clarifi@${app.getVersion()}`,
      environment: app.isPackaged ? 'production' : 'development',
    })
    initialized = true
  } catch (error) {
    console.warn('Sentry init skipped:', error instanceof Error ? error.message : error)
  }
}

export function captureMainError(error: unknown, context?: Record<string, unknown>): void {
  if (!initialized) {
    console.error('Unhandled error:', error, context)
    return
  }
  void import('@sentry/electron/main').then((Sentry) => {
    Sentry.withScope((scope) => {
      if (context) scope.setContext('extra', context)
      Sentry.captureException(error)
    })
  })
}
