/**
 * Low-latency mic capture for the Deepgram-live mic STT path (feature-flagged
 * alternative to the MediaRecorder/Whisper path in useRecording.ts).
 *
 * Captures continuous small PCM frames via an AudioWorklet instead of 3s
 * WebM/Opus chunks, eliminating chunk-boundary word cuts.
 */

export type MicPcmCaptureHandle = {
  stop(): void
}

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer)
  let binary = ''
  const chunkSize = 0x8000
  for (let i = 0; i < bytes.length; i += chunkSize) {
    const chunk = bytes.subarray(i, i + chunkSize)
    binary += String.fromCharCode(...chunk)
  }
  return btoa(binary)
}

export async function startMicPcmCapture(
  stream: MediaStream,
  onChunk: (base64: string) => void,
): Promise<MicPcmCaptureHandle> {
  const audioContext = new AudioContext({ sampleRate: 16000 })
  await audioContext.audioWorklet.addModule('/pcm-worklet.js')

  const source = audioContext.createMediaStreamSource(stream)
  const node = new AudioWorkletNode(audioContext, 'pcm-capture-processor')

  node.port.onmessage = (event: MessageEvent<ArrayBuffer>) => {
    const buffer = event.data
    if (!buffer || !buffer.byteLength) return
    onChunk(arrayBufferToBase64(buffer))
  }

  // Deliberately not connected to audioContext.destination — this is a
  // capture-only graph, connecting to output would cause local mic playback.
  source.connect(node)

  let stopped = false
  return {
    stop(): void {
      if (stopped) return
      stopped = true
      node.port.onmessage = null
      try {
        source.disconnect()
      } catch {
        // ignore
      }
      try {
        node.disconnect()
      } catch {
        // ignore
      }
      void audioContext.close()
    },
  }
}
