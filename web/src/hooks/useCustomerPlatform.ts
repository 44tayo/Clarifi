'use client'

import { useSyncExternalStore } from 'react'

import { type CustomerPlatform, detectClientPlatform } from '@/lib/platform'

function getPlatform(): CustomerPlatform {
  return detectClientPlatform() ?? 'mac'
}

export function useCustomerPlatform(): CustomerPlatform {
  return useSyncExternalStore(() => () => {}, getPlatform, () => 'mac')
}

export function platformDownloadLabel(platform: CustomerPlatform): string {
  return platform === 'mac' ? 'Get for Mac' : 'Get for Windows'
}
