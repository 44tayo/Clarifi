export type NoteTarget = 'enhancedNotes' | 'userNotes'

export type NoteSnapshot = {
  target: NoteTarget
  previous: string
}

export type NoteFields = {
  enhancedNotes?: string
  userNotes?: string
}

export function applyNoteInsert(
  fields: NoteFields,
  target: NoteTarget,
  content: string,
  stack: NoteSnapshot[],
): { next: NoteFields; stack: NoteSnapshot[] } {
  const text = content.trim()
  if (!text) return { next: fields, stack }
  const previous =
    target === 'enhancedNotes' ? fields.enhancedNotes ?? '' : fields.userNotes ?? ''
  const nextStack = [...stack, { target, previous }].slice(-20)
  if (target === 'enhancedNotes') {
    return {
      next: { ...fields, enhancedNotes: text },
      stack: nextStack,
    }
  }
  return {
    next: { ...fields, userNotes: text },
    stack: nextStack,
  }
}

export function undoNoteInsert(
  fields: NoteFields,
  stack: NoteSnapshot[],
): { next: NoteFields; stack: NoteSnapshot[]; restored: NoteSnapshot | null } {
  if (stack.length === 0) return { next: fields, stack, restored: null }
  const nextStack = stack.slice(0, -1)
  const restored = stack[stack.length - 1]!
  if (restored.target === 'enhancedNotes') {
    return {
      next: { ...fields, enhancedNotes: restored.previous },
      stack: nextStack,
      restored,
    }
  }
  return {
    next: { ...fields, userNotes: restored.previous },
    stack: nextStack,
    restored,
  }
}
