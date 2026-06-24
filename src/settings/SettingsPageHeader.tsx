import type { ReactNode } from 'react'

type SettingsPageHeaderProps = {
  title: string
  description?: string
  actions?: ReactNode
}

export function SettingsPageHeader({ title, description, actions }: SettingsPageHeaderProps) {
  return (
    <header className="settings-page-header">
      <div className="settings-page-header-text">
        <h1 className="settings-page-title">{title}</h1>
        {description ? <p className="settings-page-desc">{description}</p> : null}
      </div>
      {actions ? <div className="settings-page-header-actions">{actions}</div> : null}
    </header>
  )
}
