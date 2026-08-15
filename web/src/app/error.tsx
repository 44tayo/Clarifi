'use client'

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <main className="min-h-screen bg-black text-white flex flex-col items-center justify-center gap-4 px-8">
      <h1 className="text-2xl font-bold">Something went wrong</h1>
      <p className="text-white/50 text-sm text-center max-w-md">
        {error.message || 'An unexpected error occurred.'}
      </p>
      <button
        type="button"
        onClick={reset}
        className="bg-white text-black px-6 py-2 rounded-lg text-sm font-medium hover:bg-white/90"
      >
        Try again
      </button>
    </main>
  )
}
