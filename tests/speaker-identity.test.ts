import { describe, expect, it } from 'vitest'

import {
  applySpeakerIdentity,
  candidatePeopleFromMeeting,
  displayNameForSpeaker,
  filterPeopleCandidates,
  isSpeakerIdentified,
  meetingAttendeesFromCalendar,
  speakerPillSummary,
} from '../shared/speakers'

describe('speaker identity helpers', () => {
  it('keeps labels in sync when assigning a calendar person', () => {
    const next = applySpeakerIdentity({}, {}, 'Speaker 1', {
      displayName: 'Tayo Williams',
      email: 'tayo@example.com',
      source: 'calendar',
    })
    expect(next.speakerLabels['Speaker 1']).toBe('Tayo Williams')
    expect(next.speakerIdentities['Speaker 1']?.email).toBe('tayo@example.com')
  })

  it('builds candidates from structured attendees without self', () => {
    const people = candidatePeopleFromMeeting({
      attendees: [
        { email: 'me@clarifi.app', name: 'Me', self: true },
        { email: 'sam@clarifi.app', name: 'Sam', self: false },
      ],
    })
    expect(people).toHaveLength(1)
    expect(people[0]?.displayName).toBe('Sam')
  })

  it('filters candidates by name or email', () => {
    const people = [
      { displayName: 'Osap Staff', email: 'osap@utoronto.ca', source: 'calendar' as const },
      { displayName: 'Tayo', email: 'tayo@gmail.com', source: 'manual' as const },
    ]
    expect(filterPeopleCandidates(people, 'osap')).toHaveLength(1)
    expect(filterPeopleCandidates(people, 'gmail')).toHaveLength(1)
  })

  it('treats Speaker N as unidentified until renamed', () => {
    expect(isSpeakerIdentified('Speaker 1', {}, {})).toBe(false)
    expect(
      isSpeakerIdentified(
        'Speaker 1',
        { 'Speaker 1': { displayName: 'Sam', source: 'manual' } },
        { 'Speaker 1': 'Sam' },
      ),
    ).toBe(true)
  })

  it('summarizes pill labels', () => {
    expect(
      speakerPillSummary(
        ['Speaker 1', 'Speaker 2'],
        {
          'Speaker 1': { displayName: 'Osap Staff', source: 'calendar' },
          'Speaker 2': { displayName: 'Tayo Williams', source: 'calendar' },
        },
        {},
      ),
    ).toBe('Osap, Tayo')
  })

  it('maps calendar attendees without inventing speaker order labels', () => {
    const attendees = meetingAttendeesFromCalendar([
      { email: 'a@x.com', name: 'Ada', self: false },
      { email: 'b@x.com', name: null, self: true },
    ])
    expect(attendees[0]?.name).toBe('Ada')
    expect(displayNameForSpeaker('Speaker 1', {}, {})).toBe('Speaker 1')
  })
})
