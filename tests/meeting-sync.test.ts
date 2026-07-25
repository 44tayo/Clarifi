import { describe, expect, it } from 'vitest'

import { mergeMeetingsLww, type SyncableMeeting } from '../electron/meetingSync'

function meeting(partial: Partial<SyncableMeeting> & { id: string; updatedAt: number }): SyncableMeeting {
  return {
    title: 'Meeting',
    createdAt: 1,
    status: 'ready',
    userNotes: '',
    transcript: [],
    ...partial,
  }
}

describe('mergeMeetingsLww', () => {
  it('pushes local-only and pulls remote-only', () => {
    const { toPush, toPull, toDeleteRemote } = mergeMeetingsLww(
      [meeting({ id: 'local', updatedAt: 10 })],
      [meeting({ id: 'remote', updatedAt: 10 })],
    )
    expect(toPush.map((m) => m.id)).toEqual(['local'])
    expect(toPull.map((m) => m.id)).toEqual(['remote'])
    expect(toDeleteRemote).toEqual([])
  })

  it('keeps the newer updatedAt on conflict', () => {
    const { toPush, toPull } = mergeMeetingsLww(
      [meeting({ id: 'same', updatedAt: 20, title: 'Local' })],
      [meeting({ id: 'same', updatedAt: 10, title: 'Remote' })],
    )
    expect(toPush[0]?.title).toBe('Local')
    expect(toPull).toEqual([])
  })

  it('pulls when remote is newer', () => {
    const { toPush, toPull } = mergeMeetingsLww(
      [meeting({ id: 'same', updatedAt: 5, title: 'Local' })],
      [meeting({ id: 'same', updatedAt: 50, title: 'Remote' })],
    )
    expect(toPush).toEqual([])
    expect(toPull[0]?.title).toBe('Remote')
  })

  it('does not revive locally deleted meetings from remote', () => {
    const { toPush, toPull, toDeleteRemote } = mergeMeetingsLww(
      [],
      [meeting({ id: 'gone', updatedAt: 99, title: 'Should stay deleted' })],
      ['gone'],
    )
    expect(toPush).toEqual([])
    expect(toPull).toEqual([])
    expect(toDeleteRemote).toEqual(['gone'])
  })

  it('does not push a tombstoned meeting that still exists locally', () => {
    const { toPush, toPull, toDeleteRemote } = mergeMeetingsLww(
      [meeting({ id: 'gone', updatedAt: 50, title: 'Stale local' })],
      [meeting({ id: 'gone', updatedAt: 99, title: 'Remote' })],
      ['gone'],
    )
    expect(toPush).toEqual([])
    expect(toPull).toEqual([])
    expect(toDeleteRemote).toEqual(['gone'])
  })
})
