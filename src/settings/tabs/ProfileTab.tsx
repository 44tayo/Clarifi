import { SettingsPageHeader } from '../SettingsPageHeader'
import { ProfileAvatar } from '../ProfileAvatar'
import type { DeviceProfile } from '../types'

type ProfileTabProps = {
  profile: DeviceProfile | null
  editingProfile: boolean
  draftFirstName: string
  draftLastName: string
  profileSaving: boolean
  onDraftFirstName: (value: string) => void
  onDraftLastName: (value: string) => void
  onStartEdit: () => void
  onCancelEdit: () => void
  onSave: () => void
  onUploadAvatar: () => void
  onRemoveAvatar: () => void
  onConnect: () => void
  onBilling: () => void
  onDashboard: () => void
}

export function ProfileTab({
  profile,
  editingProfile,
  draftFirstName,
  draftLastName,
  profileSaving,
  onDraftFirstName,
  onDraftLastName,
  onStartEdit,
  onCancelEdit,
  onSave,
  onUploadAvatar,
  onRemoveAvatar,
  onConnect,
  onBilling,
  onDashboard,
}: ProfileTabProps) {
  return (
    <>
      <SettingsPageHeader
        title="Profile"
        description="Your account, connected services, and plan details."
      />

      {!profile ? (
        <p className="settings-empty">Loading profile…</p>
      ) : !profile.paired ? (
        <div className="settings-card settings-profile-card">
          <div className="settings-card-title">Not connected</div>
          <p className="settings-card-desc">
            Sign in on the website and open Clarifi to link this desktop app to your account.
          </p>
          <button type="button" className="settings-btn primary" onClick={onConnect}>
            Connect account
          </button>
        </div>
      ) : (
        <div className="settings-profile-details">
          <div className="settings-profile-card settings-card">
            <div className="settings-profile-section">
              <div className="settings-profile-section-label">Profile</div>

              {!editingProfile ? (
                <div className="settings-profile-summary-row">
                  <div className="settings-profile-summary-left">
                    <ProfileAvatar profile={profile} />
                    <span className="settings-profile-display-name">
                      {profile.fullName ||
                        `${profile.firstName ?? ''} ${profile.lastName ?? ''}`.trim() ||
                        profile.email}
                    </span>
                  </div>
                  <button type="button" className="settings-link-btn" onClick={onStartEdit}>
                    Update profile
                  </button>
                </div>
              ) : (
                <div className="settings-profile-edit">
                  <div className="settings-profile-upload-row">
                    <ProfileAvatar
                      profile={profile}
                      large
                      draftFirstName={draftFirstName}
                      draftLastName={draftLastName}
                    />
                    <div className="settings-profile-upload-actions">
                      <button type="button" className="settings-btn" onClick={onUploadAvatar}>
                        Upload
                      </button>
                      <button
                        type="button"
                        className="settings-link-btn settings-link-btn-danger"
                        onClick={onRemoveAvatar}
                      >
                        Remove
                      </button>
                      <p className="settings-profile-upload-hint">
                        Recommended size 1:1, up to 10MB.
                      </p>
                    </div>
                  </div>

                  <div className="settings-form-grid">
                    <div className="settings-field">
                      <label>First name</label>
                      <input
                        className="settings-input"
                        value={draftFirstName}
                        onChange={(e) => onDraftFirstName(e.target.value)}
                      />
                    </div>
                    <div className="settings-field">
                      <label>Last name</label>
                      <input
                        className="settings-input"
                        value={draftLastName}
                        onChange={(e) => onDraftLastName(e.target.value)}
                      />
                    </div>
                  </div>

                  <div className="settings-form-actions settings-form-actions-end">
                    <button
                      type="button"
                      className="settings-link-btn"
                      onClick={onCancelEdit}
                      disabled={profileSaving}
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      className="settings-btn primary"
                      onClick={() => void onSave()}
                      disabled={profileSaving}
                    >
                      {profileSaving ? 'Saving…' : 'Save'}
                    </button>
                  </div>
                </div>
              )}
            </div>

            <div className="settings-profile-divider" />

            <div className="settings-profile-section">
              <div className="settings-profile-section-label">Email addresses</div>
              {profile.email ? (
                <div className="settings-profile-list-row">
                  <div className="settings-profile-list-main">
                    <span>{profile.email}</span>
                    <span className="settings-pill">Primary</span>
                  </div>
                </div>
              ) : null}
              <button type="button" className="settings-link-btn" onClick={onDashboard}>
                + Add email address
              </button>
            </div>

            <div className="settings-profile-divider" />

            <div className="settings-profile-section">
              <div className="settings-profile-section-label">Connected accounts</div>
              {(profile.connectedAccounts ?? []).map((account) => (
                <div key={account.provider} className="settings-profile-list-row">
                  <div className="settings-profile-list-main">
                    {account.provider === 'google' ? (
                      <span className="settings-provider-icon" aria-hidden>
                        G
                      </span>
                    ) : null}
                    <span>
                      {account.label}
                      {account.email ? ` · ${account.email}` : ''}
                    </span>
                  </div>
                </div>
              ))}
              <button type="button" className="settings-link-btn" onClick={onConnect}>
                + Connect account
              </button>
            </div>

            <div className="settings-profile-divider" />

            <div className="settings-profile-section settings-profile-plan-row">
              <div>
                <div className="settings-profile-section-label">Plan</div>
                <div className="settings-profile-plan-value">
                  {profile.planLabel ?? profile.plan ?? '—'}
                  {typeof profile.sessionsToday === 'number' ? (
                    <span className="settings-profile-plan-meta">
                      {' '}
                      · {profile.sessionsToday}
                      {typeof profile.sessionsLimit === 'number'
                        ? ` / ${profile.sessionsLimit}`
                        : profile.sessionsLimit === null
                          ? ' / Unlimited'
                          : ''}{' '}
                      sessions today
                    </span>
                  ) : null}
                </div>
              </div>
              <button type="button" className="settings-btn small" onClick={onBilling}>
                Manage plan
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
