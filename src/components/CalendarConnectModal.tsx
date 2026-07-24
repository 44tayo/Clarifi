import type { ReactNode } from 'react'

import type { CalendarConnectionInfo } from '../../shared/calendar'
import {
  GoogleCalendarIcon,
  OutlookCalendarIcon,
} from './icons/CalendarBrandIcons'

type CalendarConnectModalProps = {
  open: boolean
  suggestedProvider?: 'google' | 'microsoft' | null
  google?: CalendarConnectionInfo
  microsoft?: CalendarConnectionInfo
  onClose: () => void
  onConnect: (provider: 'google' | 'microsoft') => void
  onOpenSettings?: () => void
}

function ProviderRow({
  name,
  subConnect,
  icon,
  suggested,
  connection,
  onConnect,
}: {
  name: string
  subConnect: string
  icon: ReactNode
  suggested?: boolean
  connection?: CalendarConnectionInfo
  onConnect: () => void
}) {
  const connected = Boolean(connection?.connected)
  const email = connection?.accountEmail

  return (
    <div className={`calendar-connect-row${connected ? ' is-connected' : ''}`}>
      <div className="calendar-connect-row-main">
        <div className="calendar-connect-logo-wrap">{icon}</div>
        <div className="calendar-connect-row-copy">
          <div className="calendar-connect-row-title">
            <strong>{name}</strong>
            {connected ? (
              <span className="calendar-connect-badge is-connected">Connected</span>
            ) : suggested ? (
              <span className="calendar-connect-badge">Suggested</span>
            ) : null}
          </div>
          <span className="calendar-connect-row-sub">
            {connected ? email ?? 'Linked to Clarifi' : subConnect}
          </span>
        </div>
      </div>
      {connected ? (
        <button type="button" className="btn btn-secondary" onClick={onConnect}>
          Reconnect
        </button>
      ) : (
        <button type="button" className="btn btn-primary" onClick={onConnect}>
          Connect
        </button>
      )}
    </div>
  )
}

export function CalendarConnectModal({
  open,
  suggestedProvider = 'google',
  google,
  microsoft,
  onClose,
  onConnect,
  onOpenSettings,
}: CalendarConnectModalProps) {
  if (!open) return null

  const anyConnected = Boolean(google?.connected || microsoft?.connected)

  return (
    <div
      className="calendar-connect-overlay"
      role="dialog"
      aria-modal="true"
      aria-labelledby="calendar-connect-title"
      onClick={onClose}
    >
      <div
        className="calendar-connect-card"
        role="presentation"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="calendar-connect-hero">
          <p className="calendar-connect-eyebrow">Calendars</p>
          <h2 id="calendar-connect-title">
            {anyConnected ? 'Your calendars' : 'Connect your calendar for better notes'}
          </h2>
        </div>

        <div className="calendar-connect-rows">
          <ProviderRow
            name="Google Calendar"
            subConnect="Connect your Google account"
            suggested={suggestedProvider === 'google'}
            connection={google}
            icon={<GoogleCalendarIcon size={44} className="calendar-connect-logo" />}
            onConnect={() => onConnect('google')}
          />
          <ProviderRow
            name="Outlook Calendar"
            subConnect="Connect your Microsoft account"
            suggested={suggestedProvider === 'microsoft'}
            connection={microsoft}
            icon={<OutlookCalendarIcon size={44} className="calendar-connect-logo" />}
            onConnect={() => onConnect('microsoft')}
          />
        </div>

        <div className="calendar-connect-footer">
          {onOpenSettings ? (
            <button type="button" className="link-btn" onClick={onOpenSettings}>
              Manage in Settings
            </button>
          ) : null}
          <button type="button" className="link-btn calendar-connect-later" onClick={onClose}>
            {anyConnected ? 'Done' : 'Connect later'}
          </button>
        </div>
      </div>
    </div>
  )
}
