let proactiveEngineStarted = false
let fallbackTimer: ReturnType<typeof setTimeout> | null = null

async function startProactiveEngine(): Promise<void> {
  if (proactiveEngineStarted) return
  proactiveEngineStarted = true
  const { initializeProactiveEngine } = await import('./proactive')
  initializeProactiveEngine()
}

/** Defer proactive engine until overlay is ready or a short fallback timeout. */
export function scheduleProactiveEngineStart(): void {
  if (proactiveEngineStarted || fallbackTimer) return
  fallbackTimer = setTimeout(() => {
    fallbackTimer = null
    void startProactiveEngine()
  }, 2000)
}

export function startProactiveEngineOnOverlayReady(): void {
  if (fallbackTimer) {
    clearTimeout(fallbackTimer)
    fallbackTimer = null
  }
  void startProactiveEngine()
}
