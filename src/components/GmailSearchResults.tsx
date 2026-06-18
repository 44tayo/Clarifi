export type GmailSearchMessage = {
  id: string
  threadId: string
  subject: string
  from: string
  date: string
  snippet: string
  webUrl: string
}

type GmailSearchResultsProps = {
  query?: string
  messages: GmailSearchMessage[]
  onOpenGmail?: (url: string) => void
}

function openExternal(url: string): void {
  void window.electronAPI.invoke('gmail:open-url', { url })
}

export function GmailSearchResults({ query, messages, onOpenGmail }: GmailSearchResultsProps) {
  if (messages.length === 0) return null

  const handleOpen = onOpenGmail ?? openExternal

  return (
    <div className="gmail-search-results">
      <div className="gmail-search-results-header">
        Gmail results{query ? ` · ${query}` : ''}
      </div>
      <ul className="gmail-search-results-list">
        {messages.map((msg) => (
          <li key={msg.id} className="gmail-search-result-card">
            <div className="gmail-search-result-subject">{msg.subject}</div>
            <div className="gmail-search-result-meta">
              <span>{msg.from}</span>
              {msg.date ? <span>{msg.date}</span> : null}
            </div>
            {msg.snippet ? (
              <div className="gmail-search-result-snippet">{msg.snippet}</div>
            ) : null}
            <button
              type="button"
              className="gmail-search-result-open"
              onClick={() => handleOpen(msg.webUrl)}
            >
              Open in Gmail
            </button>
          </li>
        ))}
      </ul>
    </div>
  )
}
