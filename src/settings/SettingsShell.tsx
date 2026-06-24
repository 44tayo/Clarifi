import type { ReactNode } from 'react'
import { SettingsSidebar } from './SettingsSidebar'
import type { DeviceProfile, SettingsTab } from './types'

type SettingsShellProps = {
  tab: SettingsTab
  profile: DeviceProfile | null
  onTabChange: (tab: SettingsTab) => void
  children: ReactNode
  footer: ReactNode
}

export function SettingsShell({
  tab,
  profile,
  onTabChange,
  children,
  footer,
}: SettingsShellProps) {
  return (
    <div className="settings-root">
      <div className="settings-drag-region" aria-hidden />
      <SettingsSidebar tab={tab} profile={profile} onTabChange={onTabChange} />
      <div className="settings-shell">
        <main className="settings-main">{children}</main>
        {footer}
      </div>
    </div>
  )
}
