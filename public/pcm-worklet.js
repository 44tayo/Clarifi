// AudioWorkletProcessor for low-latency mic capture (Deepgram live STT path).
// Runs in AudioWorkletGlobalScope — no bundler imports allowed here, plain JS only.
//
// Accumulates raw input samples, resamples to 16kHz mono if the AudioContext
// wasn't created at 16kHz already, converts to 16-bit linear PCM, and posts
// ~200ms chunks back to the main thread as transferable ArrayBuffers.

const TARGET_SAMPLE_RATE = 16000
const CHUNK_MS = 200

class PcmCaptureProcessor extends AudioWorkletProcessor {
  constructor() {
    super()
    this.inputBuffer = []
    this.inputBufferLength = 0
    this.chunkInputSamples = Math.max(1, Math.round(sampleRate * (CHUNK_MS / 1000)))
  }

  resampleTo16k(input) {
    if (sampleRate === TARGET_SAMPLE_RATE) return input
    const ratio = TARGET_SAMPLE_RATE / sampleRate
    const outLength = Math.max(1, Math.round(input.length * ratio))
    const output = new Float32Array(outLength)
    for (let i = 0; i < outLength; i += 1) {
      const srcPos = i / ratio
      const srcIndexFloor = Math.floor(srcPos)
      const srcIndexCeil = Math.min(srcIndexFloor + 1, input.length - 1)
      const frac = srcPos - srcIndexFloor
      output[i] = input[srcIndexFloor] + (input[srcIndexCeil] - input[srcIndexFloor]) * frac
    }
    return output
  }

  floatTo16BitPcm(float32) {
    const buffer = new ArrayBuffer(float32.length * 2)
    const view = new DataView(buffer)
    for (let i = 0; i < float32.length; i += 1) {
      const sample = Math.max(-1, Math.min(1, float32[i]))
      view.setInt16(i * 2, sample < 0 ? sample * 0x8000 : sample * 0x7fff, true)
    }
    return buffer
  }

  flush() {
    if (this.inputBufferLength === 0) return
    const merged = new Float32Array(this.inputBufferLength)
    let offset = 0
    for (const chunk of this.inputBuffer) {
      merged.set(chunk, offset)
      offset += chunk.length
    }
    this.inputBuffer = []
    this.inputBufferLength = 0

    const resampled = this.resampleTo16k(merged)
    const pcmBuffer = this.floatTo16BitPcm(resampled)
    this.port.postMessage(pcmBuffer, [pcmBuffer])
  }

  process(inputs) {
    const input = inputs[0]
    const channel = input && input[0]
    if (channel && channel.length > 0) {
      this.inputBuffer.push(channel.slice())
      this.inputBufferLength += channel.length
      if (this.inputBufferLength >= this.chunkInputSamples) {
        this.flush()
      }
    }
    return true
  }
}

registerProcessor('pcm-capture-processor', PcmCaptureProcessor)
