# Calendar integration setup

Clarifi syncs **Google Calendar** and **Microsoft Outlook** for upcoming meetings, auto-filled titles, and speaker hints from invitees. This is separate from Supabase sign-in OAuth — calendar access uses its own scopes and token storage.

## Environment variables

Add to `my-app/web/.env.local`:

```env
GOOGLE_CALENDAR_CLIENT_ID=
GOOGLE_CALENDAR_CLIENT_SECRET=
MICROSOFT_CALENDAR_CLIENT_ID=
MICROSOFT_CALENDAR_CLIENT_SECRET=
```

You can reuse the same Google Cloud / Azure app used for Supabase auth, or create dedicated OAuth clients.

## Google Calendar

1. [Google Cloud Console](https://console.cloud.google.com/) → APIs & Services → **Enable Google Calendar API**
2. OAuth client (Web application)
3. Authorized redirect URI:
   - `http://localhost:3000/api/calendar/callback`
   - `https://www.clarifiapp.com/api/calendar/callback`
4. Scopes used:
   - `https://www.googleapis.com/auth/calendar.readonly`
   - `https://www.googleapis.com/auth/contacts.readonly`
   - `https://www.googleapis.com/auth/contacts.other.readonly`
   - `https://www.googleapis.com/auth/userinfo.email`

Before public verification, the Privacy Policy at `/privacy` must disclose how Clarifi accesses, uses, stores, and deletes this Google user data (see Google API Services User Data Policy — Accurately represent your identity and intent).

## Microsoft Outlook

1. [Azure Portal](https://portal.azure.com/) → App registrations
2. Redirect URI (Web):
   - `http://localhost:3000/api/calendar/callback`
   - `https://www.clarifiapp.com/api/calendar/callback`
3. API permissions → Microsoft Graph → Delegated:
   - `Calendars.Read`
   - `User.Read`
   - `offline_access`
4. Works with cloud Microsoft 365 (Exchange Online) only — not on-prem Exchange.

## Database migration

Apply migration `015_calendar_connections.sql` to your Supabase project:

```bash
cd my-app/web && supabase db push
```

## Desktop flow

1. Sign in to Clarifi (paired account)
2. **Settings → Calendar → Connect Google** or **Connect Outlook**
3. Browser opens → authorize → return to Clarifi
4. **Coming up** section in the sidebar shows meetings for the next 10 days
5. Click a meeting to start recording with the event title and attendee-based speaker hints

## API routes

| Route | Auth | Purpose |
|-------|------|---------|
| `GET /api/calendar/connect?provider=google\|microsoft` | Web session | Start OAuth |
| `GET /api/calendar/callback` | OAuth state | Store tokens |
| `GET /api/calendar/status` | Web or device | Connection status |
| `POST /api/calendar/disconnect` | Web or device | Remove connection |
| `GET /api/desktop/calendar/events` | Device headers | Upcoming events |
| `GET /api/desktop/calendar/status` | Device headers | Connection status |
