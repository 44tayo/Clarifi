import {
  GoogleCalendarIcon,
  OutlookCalendarIcon,
} from './icons/CalendarBrandIcons'

type CalendarConnectModalProps = {
  open: boolean
  suggestedProvider?: 'google' | 'microsoft' | null
  onClose: () => void
  onConnect: (provider: 'google' | 'microsoft') => void
}

export function CalendarConnectModal({
  open,
  suggestedProvider = 'google',
  onClose,
  onConnect,
}: CalendarConnectModalProps) {
  if (!open) return null

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
        <h2 id="calendar-connect-title">Connect your calendar for better notes</h2>
        <p className="calendar-connect-lead">
          Connect Google Calendar or Outlook so Clarifi can identify speakers, detect your
          meetings, and tailor each summary.
        </p>

        <div className="calendar-connect-rows">
          <div className="calendar-connect-row">
            <div className="calendar-connect-row-main">
              <GoogleCalendarIcon size={40} className="calendar-connect-logo" />
              <div>
                <div className="calendar-connect-row-title">
                  <strong>Google Calendar</strong>
                  {suggestedProvider === 'google' ? (
                    <span className="calendar-connect-badge">Suggested</span>
                  ) : null}
                </div>
                <span className="calendar-connect-row-sub">Connect your Google account</span>
              </div>
            </div>
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => onConnect('google')}
            >
              Connect
            </button>
          </div>

          <div className="calendar-connect-row">
            <div className="calendar-connect-row-main">
              <OutlookCalendarIcon size={40} className="calendar-connect-logo" />
              <div>
                <div className="calendar-connect-row-title">
                  <strong>Outlook Calendar</strong>
                  {suggestedProvider === 'microsoft' ? (
                    <span className="calendar-connect-badge">Suggested</span>
                  ) : null}
                </div>
                <span className="calendar-connect-row-sub">Connect your Microsoft account</span>
              </div>
            </div>
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => onConnect('microsoft')}
            >
              Connect
            </button>
          </div>
        </div>

        <p className="calendar-connect-privacy">
          Clarifi reads your calendar to personalise your notes. Your data is never sold or shared.
        </p>

        <button type="button" className="link-btn calendar-connect-later" onClick={onClose}>
          Connect later
        </button>
      </div>
    </div>
  )
}
