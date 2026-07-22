# OAuth setup for Clarifi (Google + Microsoft)

Desktop sign-in opens the website (`/desktop/auth` or `/desktop/sign-in`), completes OAuth in the browser, then pairs the app via `clarifi://auth?token=...`. Both providers must be configured in Supabase **and** their respective developer consoles.

## Redirect URLs (required in Google + Supabase)

Add every URL your app uses:

| Environment | Redirect URL |
|-------------|--------------|
| Production | `https://www.clarifiapp.com/auth/callback` |
| Local web | `http://localhost:3000/auth/callback` |

Supabase → **Authentication → URL configuration**:

- **Site URL:** `https://www.clarifiapp.com`
- **Redirect URLs:** include both URLs above plus `https://www.clarifiapp.com/desktop/connect`

---

## Google

### Symptom: `Error 401: deleted_client`

The OAuth client was deleted or disabled. Create a new one.

### Steps

1. [Google Cloud Console](https://console.cloud.google.com/) → APIs & Services → Credentials → **Create OAuth client ID**
2. Application type: **Web application**
3. Authorized redirect URIs:
   - `https://www.clarifiapp.com/auth/callback`
   - `http://localhost:3000/auth/callback`
4. Copy **Client ID** and **Client secret**
5. Supabase → **Authentication → Providers → Google** → paste credentials → **Enable**
6. Smoke test:
   - Web: `https://www.clarifiapp.com/sign-in` → Continue with Google
   - Desktop: onboarding → Continue with Google → complete in browser → app continues automatically

---

## Microsoft (Azure / Entra ID)

### Symptom: `Error getting user email from external provider`

Azure is not returning an `email` claim to Supabase.

### Steps

1. [Azure Portal](https://portal.azure.com/) → App registrations → your Clarifi app (or create one)
2. **Authentication** → add redirect URI (Web):
   - `https://www.clarifiapp.com/auth/callback`
   - `http://localhost:3000/auth/callback`
3. **API permissions** → Microsoft Graph → Delegated:
   - `openid`, `profile`, `email`, `User.Read` → Grant admin consent if required
4. **Token configuration** → Add optional claim → ID token → **email**
5. Supabase → **Authentication → Providers → Azure**:
   - Application (client) ID + secret
   - **Azure Tenant URL:** `https://login.microsoftonline.com/common` (personal + work accounts)
6. Smoke test: sign in with a personal Outlook.com account and a work Microsoft 365 account

---

## Desktop pairing checklist

1. Install/open Clarifi desktop
2. Onboarding → **Continue with Google** or **Continue with Microsoft**
3. Browser opens `clarifiapp.com/desktop/auth?provider=...`
4. Complete OAuth → redirected to `/desktop/connect`
5. Browser shows success; desktop receives `clarifi://auth?token=...`
6. Desktop shows connected email in sidebar

If pairing fails, verify:

- `/desktop/auth` and `/desktop/connect` are reachable without logging in first (public routes)
- `clarifi://` protocol is registered (macOS only for v1)
- `CLARIFI_API_URL` points to `https://www.clarifiapp.com` in packaged builds

---

## Apple Sign-In

Not used in v1 (requires paid Apple Developer Program for Sign in with Apple). Email, Google, and Microsoft cover personal and work accounts.
