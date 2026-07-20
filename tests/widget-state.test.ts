import { describe, expect, it } from 'vitest'

import { widgetBoundsForMode, WIDGET_SIZES } from '../electron/widgetBounds'
import { mergeWavBuffers } from '../electron/wavMerge'
import {
  canonicalSpeakerKey,
  resolveSpeakerDisplay,
} from '../electron/transcriptUtils'

describe('widgetBoundsForMode', () => {
  it('keeps top-right anchor when expanding', () => {
    const anchor = { x: 800, y: 24, width: WIDGET_SIZES.compact.width, height: WIDGET_SIZES.compact.height }
    const compact = widgetBoundsForMode('compact', anchor)
    const expanded = widgetBoundsForMode('expanded', anchor)

    expect(compact).toEqual({
      x: 800,
      y: 24,
      width: WIDGET_SIZES.compact.width,
      height: WIDGET_SIZES.compact.height,
    })
    expect(expanded.x).toBe(800 + WIDGET_SIZES.compact.width - WIDGET_SIZES.expanded.width)
    expect(expanded.y).toBe(24)
    expect(expanded.width).toBe(WIDGET_SIZES.expanded.width)
    expect(expanded.height).toBe(WIDGET_SIZES.expanded.height)
  })
})

describe('mergeWavBuffers', () => {
  it('concatenates PCM from valid mono WAV chunks', () => {
    function makeWav(pcmBytes: number[]): Buffer {
      const pcm = Buffer.from(pcmBytes)
      const header = Buffer.alloc(44)
      header.write('RIFF', 0)
      header.writeUInt32LE(36 + pcm.length, 4)
      header.write('WAVE', 8)
      header.write('fmt ', 12)
      header.writeUInt32LE(16, 16)
      header.writeUInt16LE(1, 20)
      header.writeUInt16LE(1, 22)
      header.writeUInt32LE(16000, 24)
      header.writeUInt32LE(32000, 28)
      header.writeUInt16LE(2, 32)
      header.writeUInt16LE(16, 34)
      header.write('data', 36)
      header.writeUInt32LE(pcm.length, 40)
      return Buffer.concat([header, pcm])
    }

    const merged = mergeWavBuffers([makeWav([1, 2, 3, 4]), makeWav([5, 6, 7, 8])])
    expect(merged).not.toBeNull()
    expect(merged!.length).toBe(44 + 8)
    expect(merged!.subarray(44).equals(Buffer.from([1, 2, 3, 4, 5, 6, 7, 8]))).toBe(true)
  })

  it('returns null when no valid buffers', () => {
    expect(mergeWavBuffers([])).toBeNull()
    expect(mergeWavBuffers([Buffer.from('not wav')])).toBeNull()
  })
})

describe('speaker labels', () => {
  it('resolves custom display names', () => {
    const labels = { 'Speaker 1': 'Alex', Me: 'Jordan' }
    expect(resolveSpeakerDisplay('Speaker 1', labels)).toBe('Alex')
    expect(resolveSpeakerDisplay('Speaker 2', labels)).toBe('Speaker 2')
    expect(resolveSpeakerDisplay('Me', labels)).toBe('Jordan')
  })

  it('normalizes diarized speaker keys', () => {
    expect(canonicalSpeakerKey('speaker 2', 'system')).toBe('Speaker 2')
    expect(canonicalSpeakerKey(undefined, 'mic')).toBe('Me')
    expect(canonicalSpeakerKey(undefined, 'system')).toBe('Them')
  })
})

describe('audio preference defaults', () => {
  it('defaults to auto mode and shows mic picker', async () => {
    const { DEFAULT_AUDIO_PREFERENCES } = await import('../shared/audio-preferences')
    expect(DEFAULT_AUDIO_PREFERENCES.transcriptionMode).toBe('auto')
    expect(DEFAULT_AUDIO_PREFERENCES.skipMicPicker).toBe(false)
  })
})
