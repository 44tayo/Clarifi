import { describe, expect, it } from 'vitest'
import { mergeWavBuffers } from '../electron/wavMerge'

function makeSilentWav(pcmBytes: number, sampleRate = 16000): Buffer {
  const pcm = Buffer.alloc(pcmBytes)
  const header = Buffer.alloc(44)
  header.write('RIFF', 0)
  header.writeUInt32LE(36 + pcm.length, 4)
  header.write('WAVE', 8)
  header.write('fmt ', 12)
  header.writeUInt32LE(16, 16)
  header.writeUInt16LE(1, 20)
  header.writeUInt16LE(1, 22)
  header.writeUInt32LE(sampleRate, 24)
  header.writeUInt32LE(sampleRate * 2, 28)
  header.writeUInt16LE(2, 32)
  header.writeUInt16LE(16, 34)
  header.write('data', 36)
  header.writeUInt32LE(pcm.length, 40)
  return Buffer.concat([header, pcm])
}

describe('wav merge for meeting recordings', () => {
  it('concatenates pcm from multiple wav chunks', () => {
    const a = makeSilentWav(3200)
    const b = makeSilentWav(1600)
    const merged = mergeWavBuffers([a, b])
    expect(merged).not.toBeNull()
    expect(merged!.length).toBe(44 + 4800)
    expect(merged!.readUInt32LE(40)).toBe(4800)
  })
})

describe('speaker label continuity helpers', () => {
  it('formats speaker labels from deepgram indices consistently', async () => {
    const { canonicalSpeakerKey, isDiarizedSpeakerLabel } = await import(
      '../electron/transcriptUtils'
    )
    expect(isDiarizedSpeakerLabel('Speaker 1')).toBe(true)
    expect(isDiarizedSpeakerLabel('Me')).toBe(false)
    expect(canonicalSpeakerKey('speaker 2', 'system')).toBe('Speaker 2')
    expect(canonicalSpeakerKey('Me', 'mic')).toBe('Me')
  })
})

describe('resolveSpeakerSnippetTiming', () => {
  it('prefers the longest contiguous stretch and aims for ~14s', async () => {
    const { resolveSpeakerSnippetTiming, SNIPPET_TARGET_MS, SNIPPET_MAX_MS } = await import(
      '../electron/meetingRecording'
    )
    const timing = resolveSpeakerSnippetTiming(
      [
        { speaker: 'Speaker 1', at: 0, audioStartMs: 1_000, audioEndMs: 2_500 },
        { speaker: 'Speaker 2', at: 1, audioStartMs: 3_000, audioEndMs: 8_000 },
        { speaker: 'Speaker 1', at: 2, audioStartMs: 20_000, audioEndMs: 26_000 },
        { speaker: 'Speaker 1', at: 3, audioStartMs: 26_500, audioEndMs: 31_000 },
      ],
      'Speaker 1',
    )
    expect(timing).not.toBeNull()
    expect(timing!.startMs).toBe(20_000)
    expect(timing!.durationMs).toBeGreaterThanOrEqual(SNIPPET_TARGET_MS)
    expect(timing!.durationMs).toBeLessThanOrEqual(SNIPPET_MAX_MS)
  })
})
