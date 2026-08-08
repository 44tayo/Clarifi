import { describe, expect, it } from 'vitest'

import {
  filterMeetingsByCompany,
  filterMeetingsByPerson,
} from '../shared/entityMemory'

const meetings = [
  {
    id: '1',
    title: 'Acme sync',
    attendeeEmails: ['maya@acme.com'],
    createdAt: 3,
    startedAt: 3,
  },
  {
    id: '2',
    title: 'Beta kickoff',
    attendeeEmails: ['jon@beta.io'],
    createdAt: 2,
    startedAt: 2,
  },
  {
    id: '3',
    title: 'Acme renew',
    attendees: [{ email: 'jon@acme.com' }],
    createdAt: 1,
    startedAt: 4,
  },
]

describe('entity memory filters', () => {
  it('returns only meetings for a person email', () => {
    expect(filterMeetingsByPerson(meetings, 'maya@acme.com').map((m) => m.id)).toEqual(['1'])
  })

  it('returns only meetings for a company domain', () => {
    expect(filterMeetingsByCompany(meetings, 'acme.com').map((m) => m.id)).toEqual(['3', '1'])
  })
})
