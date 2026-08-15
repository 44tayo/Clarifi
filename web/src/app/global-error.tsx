'use client'

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <html lang="en">
      <body style={{ margin: 0, fontFamily: 'system-ui, sans-serif', background: '#000', color: '#fff' }}>
        <main
          style={{
            minHeight: '100vh',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '16px',
            padding: '32px',
          }}
        >
          <h1 style={{ fontSize: '24px', fontWeight: 700 }}>Something went wrong</h1>
          <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: '14px', textAlign: 'center' }}>
            {error.message || 'An unexpected error occurred.'}
          </p>
          <button
            type="button"
            onClick={reset}
            style={{
              background: '#fff',
              color: '#000',
              border: 'none',
              borderRadius: '8px',
              padding: '8px 24px',
              fontSize: '14px',
              fontWeight: 500,
              cursor: 'pointer',
            }}
          >
            Try again
          </button>
        </main>
      </body>
    </html>
  )
}
