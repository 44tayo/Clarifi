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

  return NextResponse.redirect(target, 302)
}
