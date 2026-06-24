import { NAV_GROUPS } from './nav'
import { ProfileAvatar } from './ProfileAvatar'
import type { DeviceProfile, SettingsTab } from './types'
import { hasCommunitiesAccess } from './utils'

type SettingsSidebarProps = {
  tab: SettingsTab
  profile: DeviceProfile | null
  onTabChange: (tab: SettingsTab) => void
}

function NavIcon({ name }: { name?: string }) {
  switch (name) {
    case 'user':
      return (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="12" cy="8" r="4" />
          <path d="M4 20c0-4 4-6 8-6s8 2 8 6" />
        </svg>
      )
    case 'users':
      return (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
          <circle cx="9" cy="7" r="4" />
          <path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" />
        </svg>
      )
    case 'mic':
      return (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z" />
          <path d="M19 10v2a7 7 0 0 1-14 0v-2M12 19v3" />
        </svg>
      )
    case 'clock':
      return (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="12" cy="12" r="10" />
          <path d="M12 6v6l4 2" />
        </svg>
      )
    case 'cpu':
      return (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <rect x="4" y="4" width="16" height="16" rx="2" />
          <rect x="9" y="9" width="6" height="6" />
        </svg>
      )
    case 'spark':
      return (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="m12 3 1.5 4.5L18 9l-4.5 1.5L12 15l-1.5-4.5L6 9l4.5-1.5L12 3Z" />
        </svg>
      )
    case 'plug':
      return (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M12 22v-5M9 8V2M15 8V2M7 8h10v4a5 5 0 0 1-10 0V8Z" />
        </svg>
      )
    case 'keyboard':
      return (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <rect x="2" y="6" width="20" height="12" rx="2" />
          <path d="M6 10h.01M10 10h.01M14 10h.01M18 10h.01M8 14h8" />
        </svg>
      )
    case 'wave':
      return (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M2 12h2M6 12h2M10 12h2M14 12h2M18 12h2M22 12h2" />
        </svg>
      )
    case 'zap':
      return (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M13 2 3 14h9l-1 8 10-12h-9l1-8Z" />
        </svg>
      )
    default:
      return null
  }
}

export function SettingsSidebar({ tab, profile, onTabChange }: SettingsSidebarProps) {
  const communitiesAccess = hasCommunitiesAccess(profile)

  return (
    <aside className="settings-sidebar">
      {profile?.paired ? (
        <div className="settings-sidebar-profile">
          <ProfileAvatar profile={profile} />
          <div className="settings-sidebar-profile-text">
            <span className="settings-sidebar-profile-name">
              {profile.fullName ||
                `${profile.firstName ?? ''} ${profile.lastName ?? ''}`.trim() ||
                profile.email}
            </span>
            {profile.planLabel ? (
              <span className="settings-sidebar-plan-badge">{profile.planLabel}</span>
            ) : null}
          </div>
        </div>
      ) : (
        <div className="settings-brand">
          <span className="settings-brand-dot" />
          Clarifi
        </div>
      )}

      <nav className="settings-nav">
        {NAV_GROUPS.map((group) => (
          <div key={group.label} className="settings-nav-group">
            <div className="settings-nav-group-label">{group.label}</div>
            {group.items.map((item) => {
              if (item.proPlusOnly && !communitiesAccess) {
                return (
                  <button
                    key={item.id}
                    type="button"
                    className={`settings-nav-btn settings-nav-btn--locked ${tab === item.id ? 'active' : ''}`}
                    onClick={() => onTabChange(item.id)}
                  >
                    <span className="settings-nav-icon" aria-hidden>
                      <NavIcon name={item.icon} />
                    </span>
                    {item.label}
                    <span className="settings-nav-pro-badge">Pro+</span>
                  </button>
                )
              }

              return (
                <button
                  key={item.id}
                  type="button"
                  className={`settings-nav-btn ${tab === item.id ? 'active' : ''}`}
                  onClick={() => onTabChange(item.id)}
                >
                  <span className="settings-nav-icon" aria-hidden>
                    <NavIcon name={item.icon} />
                  </span>
                  {item.label}
                </button>
              )
            })}
          </div>
        ))}
      </nav>
    </aside>
  )
}
