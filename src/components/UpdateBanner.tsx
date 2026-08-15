import { useAppUpdate } from '../hooks/useAppUpdate'

export function UpdateBanner() {
  const { status, bannerVisible, download, install, dismiss } = useAppUpdate()

  if (!bannerVisible || !status.availableVersion) return null

  const version = status.availableVersion
  const downloading =
    !status.downloaded && status.downloadPercent != null && status.downloadPercent < 100
  const percent =
    status.downloadPercent != null ? Math.round(status.downloadPercent) : null

  if (status.downloaded) {
    return (
      <div className="update-banner" role="status">
        <span className="update-banner-copy">
          Clarifi {version} is ready — restart to install.
        </span>
        <div className="update-banner-actions">
          <button type="button" className="btn btn-primary update-banner-btn" onClick={() => void install()}>
            Restart now
          </button>
          <button type="button" className="link-btn" onClick={dismiss}>
            Later
          </button>
        </div>
      </div>
    )
  }

  if (downloading) {
    return (
      <div className="update-banner" role="status" aria-live="polite">
        <span className="update-banner-copy">
          Downloading Clarifi {version}
          {percent != null ? `… ${percent}%` : '…'}
        </span>
      </div>
    )
  }

  return (
    <div className="update-banner" role="status">
      <span className="update-banner-copy">Clarifi {version} is available</span>
      <div className="update-banner-actions">
        <button type="button" className="btn btn-primary update-banner-btn" onClick={() => void download()}>
          Update
        </button>
        <button type="button" className="link-btn" onClick={dismiss}>
          Later
        </button>
      </div>
    </div>
  )
}
