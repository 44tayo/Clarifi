export type Subprocessor = {
  name: string
  purpose: string
  location: string
  website: string
}

/** Third parties that may process personal data on Clarifi's behalf. */
export const SUBPROCESSORS: Subprocessor[] = [
  {
    name: 'Vercel',
    purpose: 'Application hosting, deployment, and analytics',
    location: 'United States',
    website: 'https://vercel.com',
  },
  {
    name: 'Supabase',
    purpose: 'Database, authentication, and edge functions',
    location: 'Canada',
    website: 'https://supabase.com',
  },
  {
    name: 'Stripe',
    purpose: 'Payment processing and subscription billing',
    location: 'United States',
    website: 'https://stripe.com',
  },
  {
    name: 'Anthropic',
    purpose: 'AI language model services',
    location: 'United States',
    website: 'https://anthropic.com',
  },
  {
    name: 'Groq',
    purpose: 'Speech-to-text transcription (one-on-one and fallback)',
    location: 'United States',
    website: 'https://groq.com',
  },
  {
    name: 'Deepgram',
    purpose: 'Speech-to-text transcription and speaker diarization for group calls',
    location: 'United States',
    website: 'https://deepgram.com',
  },
  {
    name: 'Google',
    purpose: 'OAuth sign-in for app accounts',
    location: 'United States',
    website: 'https://google.com',
  },
]
