import { describe, expect, it } from 'vitest'

import {
  buildIndexFromMeetings,
  cosineSimilarity,
  embedTextLocal,
  hybridRetrieve,
  packHybridHits,
  retrieveAndPack,
  type RetrievalMeeting,
} from '../shared/meetingRetrieval'

const NOW = Date.UTC(2026, 7, 1)

const corpus: RetrievalMeeting[] = [
  {
    id: 'pricing',
    title: 'Q3 Pricing Review',
    enhancedNotes:
      'Agreed to raise enterprise pricing 8% in Q3. Discount floor stays at 15%. Competitor Acme undercutting mid-market.',
    createdAt: NOW - 2 * 86400000,
    startedAt: NOW - 2 * 86400000,
  },
  {
    id: 'hiring',
    title: 'Engineering Hiring Sync',
    enhancedNotes:
      'Open roles: senior backend and product designer. Interview loop updated. Offer for candidate Maya pending.',
    transcript: [
      { text: 'We need two senior backend hires this quarter.' },
      { text: 'Designer interviews start next week.' },
    ],
    createdAt: NOW - 1 * 86400000,
    startedAt: NOW - 1 * 86400000,
  },
  {
    id: 'onboarding',
    title: 'Customer Onboarding Retro',
    summary: 'Activation emails need clearer CTAs. Support handoff still slow.',
    createdAt: NOW - 10 * 86400000,
    startedAt: NOW - 10 * 86400000,
  },
]

describe('meetingRetrieval hybrid RAG', () => {
  it('prices query hits pricing meeting', () => {
    const { hits } = retrieveAndPack(corpus, 'What did we decide about enterprise pricing?', {
      now: NOW,
    })
    expect(hits[0]?.chunk.meetingId).toBe('pricing')
  })

  it('hiring query hits hiring meeting', () => {
    const { hits } = retrieveAndPack(corpus, 'Who are we hiring for backend roles?', {
      now: NOW,
    })
    expect(hits[0]?.chunk.meetingId).toBe('hiring')
  })

  it('hit-rate threshold across seeded eval set', () => {
    const cases: Array<{ query: string; expected: string }> = [
      { query: 'enterprise pricing discount floor', expected: 'pricing' },
      { query: 'raise pricing Acme competitor', expected: 'pricing' },
      { query: 'senior backend hiring offer Maya', expected: 'hiring' },
      { query: 'product designer interview loop', expected: 'hiring' },
      { query: 'activation emails onboarding CTA', expected: 'onboarding' },
    ]
    let hits = 0
    for (const testCase of cases) {
      const result = retrieveAndPack(corpus, testCase.query, { now: NOW, topK: 3 })
      if (result.hits.some((hit) => hit.chunk.meetingId === testCase.expected)) hits += 1
    }
    expect(hits / cases.length).toBeGreaterThanOrEqual(0.8)
  })

  it('respects packing budget', () => {
    const chunks = buildIndexFromMeetings(corpus, true)
    const hits = hybridRetrieve(chunks, 'pricing hiring onboarding', { now: NOW, topK: 10 })
    const packed = packHybridHits(hits, 900)
    expect(packed.length).toBeLessThanOrEqual(1100)
    expect(packed).toContain('hybrid retrieval')
  })

  it('falls back to keyword when embeddings empty', () => {
    const chunks = buildIndexFromMeetings(corpus, false)
    expect(chunks.every((chunk) => chunk.embedding.length === 0)).toBe(true)
    const hits = hybridRetrieve(chunks, 'enterprise pricing discount', { now: NOW })
    expect(hits[0]?.chunk.meetingId).toBe('pricing')
    expect(hits[0]?.cosine).toBe(0)
    expect(hits[0]?.keyword).toBeGreaterThan(0)
  })

  it('local embeddings are normalized and comparable', () => {
    const a = embedTextLocal('enterprise pricing discount')
    const b = embedTextLocal('enterprise pricing discount floor')
    const c = embedTextLocal('completely unrelated gardening tips')
    expect(Math.abs(Math.sqrt(a.reduce((s, v) => s + v * v, 0)) - 1)).toBeLessThan(1e-6)
    expect(cosineSimilarity(a, b)).toBeGreaterThan(cosineSimilarity(a, c))
  })
})
