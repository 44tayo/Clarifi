type PlaceholderViewProps = {
  title: string
  body: string
  actionLabel?: string
  onAction?: () => void
}

export function PlaceholderView({ title, body, actionLabel, onAction }: PlaceholderViewProps) {
  return (
    <div className="placeholder-view">
      <div className="empty-card">
        <h2>{title}</h2>
        <p>{body}</p>
        {actionLabel && onAction ? (
          <button type="button" className="btn btn-primary" onClick={onAction}>
            {actionLabel}
          </button>
        ) : null}
      </div>
    </div>
  )
}
