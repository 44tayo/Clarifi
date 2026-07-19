import Link from 'next/link'
import { MarketingNav } from '@/components/marketing/MarketingNav'
import { FREE_HISTORY_RETENTION_DAYS } from '@/lib/entitlements'
import '../legal.css'

const CONTACT_EMAIL = 'tayowilliams23@gmail.com'

const SECTIONS = [
  { id: 'overview', label: 'Overview' },
  { id: 'storage', label: 'Where Your Data Lives' },
  { id: 'audio', label: 'What Happens To Your Audio' },
  { id: 'encryption', label: 'Encryption' },
  { id: 'training', label: 'AI Training' },
  { id: 'retention', label: 'Data Retention & Deletion' },
  { id: 'subprocessors', label: 'Who Else Touches Your Data' },
  { id: 'contact', label: 'Questions' },
] as const

export const metadata = {
  title: 'Trust & Security — Clarifi',
  description:
    'Where Clarifi stores your data, what happens to your audio after transcription, how data is encrypted, and our no-model-training commitment.',
  alternates: { canonical: '/trust' },
}

export default function TrustPage() {
  return (
    <div className="legal-root">
      <MarketingNav showBack />

      <div className="legal-layout">
        <main className="legal-main" data-reveal>
          <h1>Trust &amp; Security</h1>
          <p className="legal-updated">Last updated on 19 July 2026</p>

          <div className="legal-highlight">
            <p>
              <strong>
                Your audio is never stored. We keep only the text transcript, and we don&apos;t let
                any AI provider train on your data.
              </strong>{' '}
              This page explains exactly how, in plain language. For the full legal terms, see our{' '}
              <Link href="/privacy">Privacy Policy</Link>.
            </p>
          </div>

          <h2 id="overview">Overview</h2>
          <p>
            Clarifi is an AI notepad for meetings: it listens in the background while you take light
            notes, then turns everything into a summary, decisions, and action items. This page is a
            plain-language account of where your data goes and how it&apos;s protected — every claim
            below reflects how our systems actually work today, not aspirational marketing copy. If we
            change something described here, we&apos;ll update this page.
          </p>

          <h2 id="storage">Where Your Data Lives</h2>
          <p>
            Clarifi is operated by a company based in Spain. Your account data, meeting transcripts,
            and notes that sync to your account are stored in a managed Postgres database hosted with
            Supabase in <strong>Canada</strong> (AWS region <code>ca-central-1</code>). We are
            evaluating a move to an EU-hosted database region; until that happens, data leaving the EEA
            is covered by the transfer safeguards described in our{' '}
            <Link href="/privacy">Privacy Policy</Link> (including Standard Contractual Clauses).
          </p>
          <p>
            Meeting notes and transcripts are also cached locally on your Mac or PC so the desktop app
            works offline — see <Link href="#encryption">Encryption</Link> for how that local copy is
            protected.
          </p>

          <h2 id="audio">What Happens To Your Audio</h2>
          <p>
            <strong>We do not store your raw audio.</strong> When you record a meeting, the audio is
            captured on your device and sent directly to our transcription providers (Groq and
            Deepgram) purely to convert speech to text. Our servers never write that audio to disk or a
            database — it exists only in memory for the moment it takes to transcribe, then it&apos;s
            gone. What we keep afterward is the resulting text transcript, not the recording itself.
          </p>

          <h2 id="encryption">Encryption</h2>
          <ul>
            <li>
              <strong>In transit:</strong> every request between the desktop app, our servers, and our
              AI providers travels over TLS-encrypted connections.
            </li>
            <li>
              <strong>At rest, in the cloud:</strong> our database provider, Supabase, encrypts all
              stored data (tables, indexes, and backups) at rest using AES-256 by default.
            </li>
            <li>
              <strong>At rest, on your device:</strong> meeting notes and transcripts cached locally by
              the desktop app are encrypted using your operating system&apos;s native secure storage
              (the macOS Keychain, or the Windows equivalent) via Electron&apos;s <code>safeStorage</code>{' '}
              API — not saved as plain text files.
            </li>
          </ul>

          <h2 id="training">AI Training</h2>
          <p>
            <strong>We do not use your meetings to train AI models, and we don&apos;t let our
            providers do it either.</strong> Here&apos;s the provider-by-provider reality behind that
            claim:
          </p>
          <ul>
            <li>
              <strong>Anthropic (Claude, used for notes and chat):</strong> commercial API usage is
              excluded from model training by default under Anthropic&apos;s terms.
            </li>
            <li>
              <strong>Groq (speech-to-text):</strong> Groq does not train on API data or retain
              inference logs for model improvement.
            </li>
            <li>
              <strong>Deepgram (speech-to-text and speaker labels):</strong> Deepgram only trains on
              audio from customers who opt in to its Model Improvement Partnership Program. Every
              request Clarifi sends explicitly opts out (<code>mip_opt_out=true</code>), so your audio
              is retained only for the moment it takes to process the request.
            </li>
          </ul>

          <h2 id="retention">Data Retention &amp; Deletion</h2>
          <p>
            Meetings themselves are never limited — every plan, including the free plan, supports
            unlimited meetings. The free plan keeps your{' '}
            <strong>most recent {FREE_HISTORY_RETENTION_DAYS} days</strong> of note history visible;
            older notes are preserved (not deleted) and become viewable again if you upgrade. Pro and
            Pro+ keep full history with no time limit.
          </p>
          <p>
            You can request full deletion of your account and associated data at any time by emailing{' '}
            <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>.
          </p>

          <h2 id="subprocessors">Who Else Touches Your Data</h2>
          <p>
            We keep the list of every third party that can process data on our behalf up to date and
            public — see our <Link href="/subprocessors">Subprocessors</Link> page for the full list,
            what each one does, and where they&apos;re located.
          </p>

          <h2 id="contact">Questions</h2>
          <p>
            If anything here is unclear, or you need more detail for your own compliance review,
            contact us at <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>.
          </p>
          <p>
            <Link href="/">← Back to home</Link>
          </p>
        </main>

        <aside className="legal-sidebar" aria-label="On this page">
          <h2>On this page</h2>
          <nav>
            {SECTIONS.map((section) => (
              <a key={section.id} href={`#${section.id}`}>
                {section.label}
              </a>
            ))}
          </nav>
        </aside>
      </div>
    </div>
  )
}
