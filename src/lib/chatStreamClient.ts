/** Shared progressive chat send helper for Electron renderer. */

export type StreamChatCitation = {
  meetingId: string
  title: string
  quote?: string
  entryId?: string
  audioStartMs?: number
}

export type StreamChatResult = {
  reply?: string
  citations?: StreamChatCitation[]
  error?: string
}

export async function invokeChatWithStream(input: {
  payload: Record<string, unknown>
  onDelta: (text: string) => void
}): Promise<StreamChatResult> {
  const streamRequestId = `chat-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
  const unsubscribe = window.electronAPI.on('chat:delta', (...args: unknown[]) => {
    const event = args[0] as { requestId?: string; text?: string } | undefined
    if (!event || event.requestId !== streamRequestId) return
    if (typeof event.text === 'string' && event.text) input.onDelta(event.text)
  })
  try {
    return (await window.electronAPI.invoke('chat:send', {
      ...input.payload,
      streamRequestId,
    })) as StreamChatResult
  } finally {
    unsubscribe()
  }
}
