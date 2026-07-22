import Link from 'next/link'
import { MarketingNav } from '@/components/marketing/MarketingNav'
import '../legal.css'

const CONTACT_EMAIL = 'tayowilliams23@gmail.com'

const SECTIONS = [
  { id: 'scope', label: 'Scope and Applicability' },
  { id: 'collect', label: 'What Information We Collect' },
  { id: 'use', label: 'How We Use Information' },
  { id: 'legal-bases', label: 'Legal Bases (GDPR)' },
  { id: 'share', label: 'Do We Share Information?' },
  { id: 'transfers', label: 'International Transfers' },
  { id: 'cookies', label: 'Tracking Technologies' },
  { id: 'security', label: 'Security' },
  { id: 'retention', label: 'Data Retention' },
  { id: 'rights', label: 'Your Privacy Rights' },
  { id: 'gdpr', label: 'GDPR — Spain & EEA' },
  { id: 'dnt', label: 'Do Not Track' },
  { id: 'children', label: 'Children Under 16' },
  { id: 'regions', label: 'Other Regions' },
  { id: 'contact', label: 'Contact Us' },
] as const

export const metadata = {
  title: 'Privacy Policy — Clarifi',
  description: 'How Clarifi collects, uses, and protects your personal information.',
  alternates: { canonical: '/privacy' },
}

export default function PrivacyPolicyPage() {
  return (
    <div className="legal-root">
      <MarketingNav active="privacy" showBack />

      <div className="legal-layout">
        <main className="legal-main" data-reveal>
          <h1>Privacy Policy</h1>
          <p className="legal-updated">Last updated on 8 June 2026</p>

          <div className="legal-highlight">
            <p>
              <strong>Clarifi does not sell your data or use your data to train AI models.</strong>{' '}
              You can contact us at{' '}
              <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a> with any privacy request. For a
              plain-language walkthrough of where your data is stored, what happens to your audio, and
              how it&apos;s encrypted, see <Link href="/trust">Trust &amp; Security</Link>.
            </p>
          </div>

          <p>
            Your privacy is important to us. This Privacy Policy (&quot;Policy&quot;) applies to
            services provided by Clarifi (&quot;we&quot;, &quot;us&quot;, or &quot;Clarifi&quot;) and
            our website (the &quot;Site&quot;), product pages, desktop or mobile applications, or
            other digital products that link to or reference this Policy
            (collectively, the &quot;Services&quot;). It explains what information we collect from
            users of our Services (&quot;you&quot; or &quot;your&quot;), including information that
            may identify you (&quot;Personal Information&quot;), and how we use it.
          </p>

          <p>
            We encourage you to read this Policy carefully. It applies to any visitor to or user of our
            Services. We may update this Policy from time to time by posting a revised version on this
            page and, where appropriate, notifying you by email. Continued use of the Services after
            changes become effective means you accept the updated Policy.
          </p>

          <h2 id="scope">Scope and Applicability</h2>
          <p>
            This Policy applies when you visit our website, create an account, use our desktop app, or
            otherwise use the Services. Where we process Personal Information on behalf of business
            customers as a processor (or &quot;service provider&quot;), the customer&apos;s privacy
            notice governs that processing and you should contact them directly.
          </p>
          <p>
            This Policy does not apply to third-party services you connect to Clarifi (such as Google
            sign-in, Stripe, or meeting platforms). Those services are governed by their own terms and
            privacy policies. Our Site may also contain links to other websites that we do not control.
          </p>

          <h2 id="collect">What Information Do We Collect?</h2>

          <h3>Information you provide</h3>
          <ul>
            <li>
              <strong>Account information:</strong> name, email address, profile picture
              (if using Google sign-in), and authentication credentials.
            </li>
            <li>
              <strong>Payment information:</strong> if you purchase a paid plan, billing details are
              collected and processed by our payment processor, Stripe. We may store card type, last
              four digits, and expiry date to help manage your subscription. See{' '}
              <a href="https://stripe.com/privacy" target="_blank" rel="noopener noreferrer">
                Stripe&apos;s Privacy Policy
              </a>
              .
            </li>
            <li>
              <strong>Customer content:</strong> audio, transcripts (including speaker labels in group
              calls), screenshots, chat messages, and other content you submit through the Services in
              connection with meetings or AI features.
            </li>
            <li>
              <strong>Communications:</strong> information you send when you contact support, join a
              webinar, respond to a survey, or otherwise communicate with us.
            </li>
          </ul>

          <h3>Information collected automatically</h3>
          <ul>
            <li>
              <strong>Log and usage data:</strong> IP address, browser type, device information,
              pages viewed, features used, timestamps, and how you interact with the Services.
            </li>
            <li>
              <strong>Analytics:</strong> we may use privacy-respecting analytics tools to understand
              how the Services are used and to improve performance.
            </li>
            <li>
              <strong>Cookies and similar technologies:</strong> see the Tracking Technologies section
              below.
            </li>
          </ul>

          <h3>Information from third parties</h3>
          <ul>
            <li>
              <strong>Authentication providers:</strong> if you sign in with Google or another
              provider, we receive information they share to authenticate you.
            </li>
            <li>
              <strong>Service providers:</strong> hosting, analytics, payment, transcription, and AI
              infrastructure partners may provide operational data necessary to deliver the Services.
            </li>
          </ul>

          <h2 id="use">How Do We Use The Information We Collect?</h2>
          <p>We use Personal Information to:</p>
          <ul>
            <li>Provide, operate, maintain, and improve the Services</li>
            <li>Create and manage your account</li>
            <li>Process payments and manage subscriptions</li>
            <li>
              Deliver real-time AI assistance, transcription, speaker diarization for group calls, and
              related features you request
            </li>
            <li>Respond to support requests and communicate with you about the Services</li>
            <li>Send service announcements, security alerts, and administrative messages</li>
            <li>Detect, prevent, and address fraud, abuse, and security issues</li>
            <li>Comply with legal obligations and enforce our terms</li>
            <li>Analyze usage to improve reliability and user experience</li>
            <li>Send marketing communications where permitted — you may opt out at any time</li>
          </ul>

          <h2 id="legal-bases">Legal Bases for Processing (GDPR)</h2>
          <p>
            If you are in the European Economic Area (EEA), United Kingdom, or Switzerland — including
            Spain — we process your Personal Information only where we have a valid legal basis under
            the General Data Protection Regulation (GDPR):
          </p>
          <ul>
            <li>
              <strong>Contract:</strong> to provide the Services you request or to take steps at your
              request before entering a contract (e.g. account creation).
            </li>
            <li>
              <strong>Consent:</strong> where you have given clear consent, such as for optional
              marketing emails or non-essential cookies where required.
            </li>
            <li>
              <strong>Legitimate interests:</strong> to operate, secure, and improve the Services,
              prevent fraud, and communicate about product updates, balanced against your rights.
            </li>
            <li>
              <strong>Legal obligation:</strong> where processing is necessary to comply with applicable
              law.
            </li>
          </ul>

          <h2 id="share">Do We Share Your Personal Information?</h2>
          <p>We may share Personal Information with:</p>
          <ul>
            <li>
              <strong>Service providers</strong> who help us operate the Services (hosting, cloud
              infrastructure, analytics, payment processing, customer support, transcription, and AI
              providers), under contracts that require appropriate safeguards
            </li>
            <li>
              <strong>Professional advisers</strong> such as lawyers or accountants where necessary
            </li>
            <li>
              <strong>Authorities</strong> when required by law or to protect rights, safety, and
              security
            </li>
            <li>
              <strong>Successors</strong> in connection with a merger, acquisition, or sale of assets
            </li>
          </ul>
          <p>We do not sell your Personal Information.</p>

          <h2 id="transfers">International Data Transfers</h2>
          <p>
            Clarifi is operated from Spain. Some of our service providers may process data in countries
            outside the EEA, including the United States. Where Personal Information is transferred
            internationally, we implement appropriate safeguards as required by GDPR, such as the
            European Commission&apos;s Standard Contractual Clauses and supplementary measures where
            needed.
          </p>
          <p>
            You may request more information about transfer safeguards by contacting us at{' '}
            <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>.
          </p>

          <h2 id="cookies">How Do We Use Tracking Technologies?</h2>
          <p>
            We use cookies and similar technologies to keep you signed in, remember preferences,
            understand usage, and improve the Services. You can control cookies through your browser
            settings. Where required by law (including in Spain and the EEA), we will ask for your
            consent before placing non-essential cookies.
          </p>
          <ul>
            <li>
              <strong>Strictly necessary cookies:</strong> required for authentication, security, and
              core functionality. These cannot be disabled if you wish to use the Services.
            </li>
            <li>
              <strong>Performance and analytics cookies:</strong> help us understand how visitors use
              the Site. You may opt out where a consent mechanism is provided.
            </li>
            <li>
              <strong>Functional cookies:</strong> remember choices you make to personalize your
              experience.
            </li>
          </ul>

          <h2 id="security">How Do We Secure Your Personal Information?</h2>
          <p>
            We implement technical and organizational measures designed to protect Personal Information,
            including encryption in transit, access controls, and secure infrastructure. No method of
            transmission or storage is completely secure; you are responsible for keeping your account
            credentials confidential.
          </p>

          <h2 id="retention">Data Retention</h2>
          <p>
            We retain Personal Information for as long as needed to provide the Services, comply with
            legal obligations, resolve disputes, and enforce agreements. When data is no longer
            required, we delete or anonymize it unless retention is required by law or for legitimate
            backup and security purposes.
          </p>

          <h2 id="rights">Managing Your Privacy</h2>
          <p>
            You may request access to, correction of, or deletion of Personal Information associated
            with your account by emailing{' '}
            <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>. We may need to verify your
            identity before responding. You may unsubscribe from marketing emails using the link in any
            marketing message.
          </p>

          <h2 id="gdpr">GDPR — Spain &amp; European Residents</h2>
          <p>
            If you are located in Spain or elsewhere in the EEA, UK, or Switzerland, you have the
            following rights under GDPR, subject to applicable limitations:
          </p>
          <ul>
            <li>Right of access to your Personal Information</li>
            <li>Right to rectification of inaccurate data</li>
            <li>Right to erasure (&quot;right to be forgotten&quot;)</li>
            <li>Right to restrict processing in certain circumstances</li>
            <li>Right to data portability in a structured, machine-readable format</li>
            <li>Right to object to processing based on legitimate interests or for direct marketing</li>
            <li>Right to withdraw consent at any time, without affecting prior lawful processing</li>
            <li>
              Right to lodge a complaint with a supervisory authority — in Spain, the{' '}
              <a
                href="https://www.aepd.es"
                target="_blank"
                rel="noopener noreferrer"
              >
                Agencia Española de Protección de Datos (AEPD)
              </a>
            </li>
          </ul>
          <p>
            <strong>Data controller:</strong> For the purposes of GDPR, Clarifi is the data controller
            of Personal Information collected through the Site and Services. To exercise your rights,
            contact us at <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>. We will respond
            within one month, or inform you if an extension is required under GDPR.
          </p>
          <p>
            Where we process Personal Information on behalf of a business customer, that customer is
            the data controller and you should contact them first. We will assist our customers in
            fulfilling data subject requests as required by law.
          </p>

          <h2 id="dnt">How We Respond to Do Not Track Signals</h2>
          <p>
            Some browsers transmit &quot;Do Not Track&quot; signals. We do not currently respond to
            DNT signals because there is no uniform industry standard. You can learn more at{' '}
            <a href="https://www.allaboutdnt.com" target="_blank" rel="noopener noreferrer">
              allaboutdnt.com
            </a>
            .
          </p>

          <h2 id="children">Children Under 16</h2>
          <p>
            The Services are not directed to individuals under 16, and we do not knowingly collect
            Personal Information from children under 16. If you believe we have collected such
            information, contact us at{' '}
            <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a> and we will delete it promptly.
          </p>

          <h2 id="regions">Region-Specific Disclosures</h2>
          <h3>California residents</h3>
          <p>
            We do not sell Personal Information as defined under the California Consumer Privacy Act
            (CCPA/CPRA). California residents may have additional rights to know, delete, and correct
            Personal Information. Contact us to exercise those rights.
          </p>
          <h3>Nevada residents</h3>
          <p>
            We do not sell covered information as defined under Nevada law. Nevada residents may submit
            an opt-out request to <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a> with the
            subject line &quot;Nevada Do Not Sell Request&quot;.
          </p>

          <h2 id="contact">Contact Us</h2>
          <p>
            If you have questions about this Policy or your Personal Information, contact us at{' '}
            <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>.
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
