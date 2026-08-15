export type CalendarProvider = 'google' | 'microsoft'

export type CalendarConnection = {
  provider: CalendarProvider
  accountEmail: string | null
  connected: boolean
}

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

export type CalendarStatus = {
  connected: boolean
  google: CalendarConnection
  microsoft: CalendarConnection
}
