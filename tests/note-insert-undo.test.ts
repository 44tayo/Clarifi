import { describe, expect, it } from 'vitest'

import { applyNoteInsert, undoNoteInsert } from '../shared/noteInsertUndo'

describe('note insert + undo', () => {
  it('applies rewrite into enhanced notes and undoes without corruption', () => {
    let fields = { enhancedNotes: '## Old\n- a', userNotes: 'scratch' }
    let stack: ReturnType<typeof applyNoteInsert>['stack'] = []

    const applied = applyNoteInsert(fields, 'enhancedNotes', '## New\n- b\n- c', stack)
    fields = applied.next
    stack = applied.stack
    expect(fields.enhancedNotes).toBe('## New\n- b\n- c')
    expect(fields.userNotes).toBe('scratch')

    const undone = undoNoteInsert(fields, stack)
    fields = undone.next
    stack = undone.stack
    expect(fields.enhancedNotes).toBe('## Old\n- a')
    expect(fields.userNotes).toBe('scratch')
    expect(stack).toHaveLength(0)
  })

  it('supports scratchpad insert undo round-trip', () => {
    let fields = { enhancedNotes: 'keep', userNotes: 'before' }
    let stack: ReturnType<typeof applyNoteInsert>['stack'] = []
    ;({ next: fields, stack } = applyNoteInsert(fields, 'userNotes', 'after rewrite', stack))
    expect(fields.userNotes).toBe('after rewrite')
    ;({ next: fields, stack } = undoNoteInsert(fields, stack))
    expect(fields.userNotes).toBe('before')
    expect(fields.enhancedNotes).toBe('keep')
  })
})
