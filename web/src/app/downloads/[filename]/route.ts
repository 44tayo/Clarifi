import { NextResponse } from 'next/server'

import {
  MAC_DMG_ARM64_FILENAME,
  MAC_DMG_X64_FILENAME,
  WIN_EXE_FILENAME,
  getMacDownloadUrl,
  getWindowsDownloadUrl,
} from '@/lib/downloads'

const FILENAME_TO_URL: Record<string, () => string> = {
  [MAC_DMG_ARM64_FILENAME]: () => getMacDownloadUrl('arm64'),
  [MAC_DMG_X64_FILENAME]: () => getMacDownloadUrl('x64'),
  [WIN_EXE_FILENAME]: () => getWindowsDownloadUrl(),
}

export async function GET(
  _request: Request,
  context: { params: Promise<{ filename: string }> },
): Promise<NextResponse> {
  const { filename } = await context.params
  const decoded = decodeURIComponent(filename)
  const resolve = FILENAME_TO_URL[decoded]
  if (!resolve) {
    return NextResponse.json({ error: 'Download not found' }, { status: 404 })
  }

  const target = resolve()
  // #region agent log
  fetch('http://127.0.0.1:7545/ingest/c19994d6-505e-4d73-855e-70ee46048b6f', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Debug-Session-Id': '6989d7',
    },
    body: JSON.stringify({
      sessionId: '6989d7',
      runId: 'download-redirect',
      hypothesisId: 'H3',
      location: 'app/downloads/[filename]/route.ts',
      message: 'Redirecting legacy download path',
      data: { filename: decoded, target },
      timestamp: Date.now(),
    }),
  }).catch(() => {})
  // #endregion

  return NextResponse.redirect(target, 302)
}
