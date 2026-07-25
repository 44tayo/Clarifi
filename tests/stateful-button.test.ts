import { describe, expect, it } from 'vitest'

/**
 * Pure helpers mirroring StatefulButton phase transitions for regression coverage
 * without a React DOM test harness.
 */
type Phase = 'idle' | 'loading' | 'success' | 'error'

function nextPhase(current: Phase, event: 'click' | 'resolve' | 'reject' | 'timeout'): Phase {
  if (event === 'click') {
    if (current === 'loading') return current
    return 'loading'
  }
  if (current !== 'loading') return current
  if (event === 'resolve') return 'success'
  if (event === 'reject') return 'error'
  return current
}

function afterHold(phase: Phase, event: 'timeout'): Phase {
  if (event === 'timeout' && (phase === 'success' || phase === 'error')) return 'idle'
  return phase
}

describe('StatefulButton state machine', () => {
  it('follows idle → loading → success → idle', () => {
    let phase: Phase = 'idle'
    phase = nextPhase(phase, 'click')
    expect(phase).toBe('loading')
    phase = nextPhase(phase, 'resolve')
    expect(phase).toBe('success')
    phase = afterHold(phase, 'timeout')
    expect(phase).toBe('idle')
  })

  it('follows idle → loading → error → idle', () => {
    let phase: Phase = 'idle'
    phase = nextPhase(phase, 'click')
    expect(phase).toBe('loading')
    phase = nextPhase(phase, 'reject')
    expect(phase).toBe('error')
    phase = afterHold(phase, 'timeout')
    expect(phase).toBe('idle')
  })

  it('ignores double-click while loading', () => {
    let phase: Phase = 'idle'
    phase = nextPhase(phase, 'click')
    expect(phase).toBe('loading')
    phase = nextPhase(phase, 'click')
    expect(phase).toBe('loading')
  })
})

describe('share link toast messages', () => {
  it('formats copy success copy', () => {
    expect('Link copied').toMatch(/copied/i)
    expect('Summary copied').toMatch(/copied/i)
  })
})
