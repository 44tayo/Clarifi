import type { SettingsTab } from './types'

export type NavItem = {
  id: SettingsTab
  label: string
  icon?: string
  proPlusOnly?: boolean
}

export type NavGroup = {
  label: string
  items: NavItem[]
}

export const NAV_GROUPS: NavGroup[] = [
  {
    label: 'Account',
    items: [{ id: 'profile', label: 'Profile', icon: 'user' }],
  },
  {
    label: 'Workspace',
    items: [
      { id: 'community', label: 'Community', icon: 'users', proPlusOnly: true },
      { id: 'audio_sessions', label: 'Audio Sessions', icon: 'mic' },
      { id: 'history', label: 'History', icon: 'clock' },
    ],
  },
  {
    label: 'Clarifi',
    items: [
      { id: 'models', label: 'Models', icon: 'cpu' },
      { id: 'modes', label: 'Modes', icon: 'spark' },
      { id: 'integrations', label: 'Integrations', icon: 'plug' },
      { id: 'keybinds', label: 'Keybinds', icon: 'keyboard' },
      { id: 'audio', label: 'Audio', icon: 'wave' },
      { id: 'productivity', label: 'Productivity', icon: 'zap' },
    ],
  },
]
