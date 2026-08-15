import { describe, expect, it, vi } from 'vitest'

import {
  CITATIONS_MARKER,
  createStreamReplyEmitter,
  parseAnthropicSseDataLine,
  parseClarifiChatSseData,
  parseJsonChatReply,
  splitStreamedChatReply,
} from '../shared/chatStream'

describe('parseJsonChatReply', () => {
  it('parses non-stream JSON contract', () => {
    const parsed = parseJsonChatReply(
      '{"reply":"Hello","citations":[{"meetingId":"m1","title":"Kickoff","quote":"ship it"}]}',
    )
    expect(parsed).toEqual({
      reply: 'Hello',
      citations: [{ meetingId: 'm1', title: 'Kickoff', quote: 'ship it' }],
    })
  })
})

describe('splitStreamedChatReply', () => {
  it('splits plain reply from citation trailer', () => {
    const raw = `We decided on Q3 pricing.\n\n${CITATIONS_MARKER}\n[{"meetingId":"m2","title":"Pricing","quote":"Q3"}]`
    expect(splitStreamedChatReply(raw)).toEqual({
      reply: 'We decided on Q3 pricing.',
      citations: [{ meetingId: 'm2', title: 'Pricing', quote: 'Q3' }],
    })
  })

  it('falls back to plain text when marker missing', () => {
    expect(splitStreamedChatReply('Just an answer')).toEqual({
      reply: 'Just an answer',
      citations: [],
    })
  })
})

describe('createStreamReplyEmitter', () => {
  it('emits chunk order and hides citation trailer', () => {
    const deltas: string[] = []
    const emitter = createStreamReplyEmitter((text) => deltas.push(text))
    emitter.push('Hello ')
    emitter.push('world')
    emitter.push(`.\n\n${CITATIONS_MARKER}\n[]`)
    const finished = emitter.finish()
    expect(deltas.join('')).toBe('Hello world.')
    expect(finished.reply).toBe('Hello world.')
    expect(finished.citations).toEqual([])
  })

  it('holds back partial marker characters', () => {
    const deltas: string[] = []
    const emitter = createStreamReplyEmitter((text) => deltas.push(text))
    emitter.push('Answer <<<CITA')
    expect(deltas.join('').includes('<<<')).toBe(false)
    emitter.push('TIONS>>>\n[]')
    const finished = emitter.finish()
    expect(deltas.join('').trim()).toBe('Answer')
    expect(finished.citations).toEqual([])
  })
})

describe('parseAnthropicSseDataLine', () => {
  it('extracts text_delta chunks in order', () => {
    const lines = [
      'data: {"type":"message_start","message":{}}',
      'data: {"type":"content_block_delta","delta":{"type":"text_delta","text":"Hi"}}',
      'data: {"type":"content_block_delta","delta":{"type":"text_delta","text":" there"}}',
      'data: [DONE]',
    ]
    expect(lines.map(parseAnthropicSseDataLine).filter(Boolean)).toEqual(['Hi', ' there'])
  })
})

describe('parseClarifiChatSseData', () => {
  it('parses proxy SSE event shapes', () => {
    expect(parseClarifiChatSseData('{"type":"delta","text":"a"}')).toEqual({
      type: 'delta',
      text: 'a',
    })
    expect(
      parseClarifiChatSseData('{"type":"done","reply":"a","citations":[]}'),
    ).toEqual({ type: 'done', reply: 'a', citations: [] })
  })
})

describe('fallback non-stream path', () => {
  it('still prefers JSON when streamed body is actually JSON', () => {
    const spy = vi.fn()
    const emitter = createStreamReplyEmitter(spy)
    const json = '{"reply":"Batch","citations":[]}'
    emitter.push(json)
    const finished = emitter.finish()
    expect(finished.reply).toBe('Batch')
    expect(finished.citations).toEqual([])
  })
})
