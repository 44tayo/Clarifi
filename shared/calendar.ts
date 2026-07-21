export type CalendarProvider = 'google' | 'microsoft'

export type CalendarAttendee = {
  email: string
  name: string | null
  self: boolean
}

export type CalendarEvent = {
  id: string
  provider: CalendarProvider
  title: string
  startAt: string
  endAt: string
  attendees: CalendarAttendee[]
  meetingUrl: string | null
  isOnline: boolean
}

export type CalendarConnectionInfo = {
  provider: CalendarProvider
  connected: boolean
  accountEmail: string | null
}

export type CalendarStatus = {
  connected: boolean
  google: CalendarConnectionInfo
  microsoft: CalendarConnectionInfo
}

export type CalendarEventsResponse = {
  connected: boolean
  events: CalendarEvent[]
}
