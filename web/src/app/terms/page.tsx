import Link from 'next/link'
import { MarketingNav } from '@/components/marketing/MarketingNav'
import '../legal.css'

const CONTACT_EMAIL = 'tayowilliams23@gmail.com'
const SITE_URL = 'https://www.clarifiapp.com'

const SECTIONS = [
  { id: 'definitions', label: '1. Definitions' },
  { id: 'services', label: '2. The Services' },
  { id: 'customer-data', label: '3. Customer Data' },
  { id: 'restrictions', label: '4. Restrictions & Responsibilities' },
  { id: 'fees', label: '5. Fees & Payment' },
  { id: 'warranties', label: '6. Warranties' },
  { id: 'confidential', label: '7. Confidential Information' },
  { id: 'term', label: '8. Term & Termination' },
  { id: 'indemnity', label: '9. Indemnity' },
  { id: 'liability', label: '10. Limitation of Liability' },
  { id: 'general', label: '11. General Provisions' },
  { id: 'contact', label: 'Contact Us' },
] as const

export const metadata = {
  title: 'Terms of Service — Clarifi',
  description: 'Terms and conditions governing your use of Clarifi services.',
  alternates: { canonical: '/terms' },
}

export default function TermsOfServicePage() {
  return (
    <div className="legal-root">
      <MarketingNav showBack />

      <div className="legal-layout">
        <main className="legal-main" data-reveal>
          <h1>Terms of Service</h1>
          <p className="legal-updated">Last updated on 8 June 2026</p>

          <p>
            These Customer Terms of Service (&quot;Agreement&quot;) are entered into by and between
            Clarifi (&quot;Clarifi&quot;, &quot;we&quot;, &quot;us&quot;) and the individual or
            entity placing an order for or accessing any Services (&quot;Customer&quot; or
            &quot;you&quot;). If you access or use the Services on behalf of a company, you represent
            that you are authorised to accept this Agreement on that company&apos;s behalf.
          </p>

          <p>
            This Agreement governs your purchase of or subscription to Clarifi&apos;s software-as-a-service
            products, desktop applications, and related services (collectively,
            the &quot;Services&quot;) pursuant to any ordering documents, online registration, checkout
            flows, or order confirmations referencing this Agreement (&quot;Order Form(s)&quot;).
          </p>

          <p>
            The &quot;Effective Date&quot; is the earlier of (a) your initial access to the Services or
            (b) the effective date of the first Order Form referencing this Agreement.
          </p>

          <div className="legal-highlight">
            <p>
              <strong>Auto-renewal:</strong> If you subscribe for a paid plan, your subscription may
              renew automatically for successive billing periods at then-current pricing unless you
              cancel before renewal as described in Section 8. EU/EEA consumers may have additional
              statutory cancellation rights.
            </p>
          </div>

          <p>
            By accepting this Agreement, accessing the Services, or clicking to agree, you confirm that
            you have read, understood, and agree to be bound by these terms. If you do not agree, do
            not use the Services. Our{' '}
            <Link href="/privacy">Privacy Policy</Link> explains how we handle personal data and is
            incorporated by reference.
          </p>

          <h2 id="definitions">1. Definitions</h2>
          <ul>
            <li>
              <strong>&quot;Affiliate&quot;</strong> means an entity that directly or indirectly
              controls, is controlled by, or is under common control with a party.
            </li>
            <li>
              <strong>&quot;Agreement&quot;</strong> means these Terms of Service, applicable Order
              Forms, and documents referenced herein, including the Privacy Policy.
            </li>
            <li>
              <strong>&quot;Beta Services&quot;</strong> means features identified as alpha, beta,
              preview, early access, evaluation, or similar.
            </li>
            <li>
              <strong>&quot;Clarifi Materials&quot;</strong> means software, documentation, systems,
              and other content provided by Clarifi in connection with the Services, excluding
              Customer Data.
            </li>
            <li>
              <strong>&quot;Customer Chosen Third-Party Product&quot;</strong> means third-party
              products or services you choose to connect with the Services.
            </li>
            <li>
              <strong>&quot;Customer Data&quot;</strong> means data you or your Users submit through
              the Services, including audio, transcripts, screenshots, messages, and account
              information.
            </li>
            <li>
              <strong>&quot;Documentation&quot;</strong> means user guides and help materials Clarifi
              makes available for the Services.
            </li>
            <li>
              <strong>&quot;Free Services&quot;</strong> means Services made available without charge,
              subject to usage limits.
            </li>
            <li>
              <strong>&quot;Fees&quot;</strong> means amounts payable for paid Services.
            </li>
            <li>
              <strong>&quot;Pro Services&quot;</strong> means paid individual subscriptions to the
              Services.
            </li>
            <li>
              <strong>&quot;Service Plan&quot;</strong> means the subscription tier and associated
              features you select.
            </li>
            <li>
              <strong>&quot;Usage Data&quot;</strong> means diagnostic and usage information relating
              to operation of the Services, excluding Customer Data content.
            </li>
            <li>
              <strong>&quot;Users&quot;</strong> means individuals authorised by you to access the
              Services.
            </li>
          </ul>

          <h2 id="services">2. The Services</h2>
          <h3>2.1 Services</h3>
          <p>
            Subject to this Agreement, Clarifi grants you a limited, non-exclusive, non-transferable
            right to access and use the Services during your subscription term for lawful internal
            business or personal purposes, as provided by Clarifi and within applicable usage limits.
          </p>
          <h3>2.2 Software</h3>
          <p>
            Clarifi may provide desktop or other software as part of the Services. You receive a
            limited license to install and use such software solely to access the Services. Software
            may update automatically. Open-source components are governed by their applicable
            licenses.
          </p>
          <h3>2.3 Clarifi Ownership</h3>
          <p>
            Clarifi and its licensors retain all rights in the Services, Clarifi Materials,
            Software, Usage Data, and Documentation. No rights are granted except as expressly stated
            herein.
          </p>
          <h3>2.4 Customer Chosen Third-Party Products</h3>
          <p>
            The Services may interoperate with third-party products you choose. Clarifi does not
            control and is not responsible for third-party products. Your use of them is at your own
            risk and subject to their terms.
          </p>
          <h3>2.5 Free Services</h3>
          <p>
            Free Services are provided subject to usage limits described in the Documentation or at
            checkout. Clarifi may modify or discontinue Free Services at any time. Free Services are
            provided &quot;as is&quot; without warranties beyond those required by applicable law.
          </p>

          <h2 id="customer-data">3. Customer Data</h2>
          <h3>3.1 Customer Ownership</h3>
          <p>
            You retain all rights in Customer Data. You are responsible for its accuracy, legality,
            and for having the right to provide it to Clarifi.
          </p>
          <h3>3.2 Authorization</h3>
          <p>
            You grant Clarifi a non-exclusive, worldwide, royalty-free right to use Customer Data
            solely to (a) provide and improve the Services, (b) prevent or address technical or
            security issues, (c) comply with law, and (d) act on your instructions through the
            Services.
          </p>
          <div className="legal-highlight">
            <p>
              <strong>Clarifi does not use Customer Data to train AI or machine learning models,</strong>{' '}
              and does not sell Customer Data. This applies to all Service Plans unless otherwise
              agreed in a separate written enterprise agreement.
            </p>
          </div>
          <h3>3.3 Aggregate and De-Identified Data</h3>
          <p>
            Clarifi may create aggregated or de-identified data that cannot reasonably identify you or
            your Users, and may use such data to improve and operate the Services.
          </p>
          <h3>3.4 Security</h3>
          <p>
            Clarifi implements commercially reasonable technical and organisational measures to
            protect Customer Data. See our <Link href="/privacy">Privacy Policy</Link> for details.
          </p>
          <h3>3.5 Processing and GDPR</h3>
          <p>
            Where we process personal data on your behalf, we act as a processor under GDPR Article 28
            where applicable. A Data Processing Agreement is available on request at{' '}
            <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>.
          </p>

          <h2 id="restrictions">4. Restrictions, Responsibilities and Rights</h2>
          <h3>4.1 Customer Restrictions</h3>
          <p>You shall not:</p>
          <ul>
            <li>Reverse engineer, copy, or create derivative works of the Services except as permitted by law</li>
            <li>Resell, sublicense, or make the Services available to third parties without authorisation</li>
            <li>Use the Services to transmit unlawful, infringing, or harmful content</li>
            <li>Scrape, mine, or harvest data from the Services without permission</li>
            <li>Interfere with the integrity or performance of the Services</li>
            <li>Remove proprietary notices from the Services</li>
            <li>Use the Services from embargoed jurisdictions or in violation of applicable law</li>
            <li>
              Use the Services in violation of recording, consent, or surveillance laws applicable to
              your meetings and jurisdiction
            </li>
          </ul>
          <h3>4.2 Customer Responsibilities</h3>
          <p>
            You are responsible for maintaining accurate account and billing information, safeguarding
            credentials, notifying us of unauthorised access, and ensuring Users comply with this
            Agreement.
          </p>
          <h3>4.3 Artificial Intelligence Features</h3>
          <p>
            The Services include AI features that may generate output (&quot;Output&quot;) based on
            your inputs and context. Output may be inaccurate or inappropriate. You are solely
            responsible for reviewing Output before relying on it. Clarifi makes no warranty regarding
            accuracy, completeness, or suitability of Output.
          </p>
          <p>
            <strong>Recording and consent:</strong> You are solely responsible for obtaining any
            required consent before recording conversations or using AI assistance in meetings,
            including compliance with laws in Spain, the EEA, and any other applicable jurisdiction.
          </p>

          <h2 id="fees">5. Fees; Payment Terms</h2>
          <h3>5.1 Fees</h3>
          <p>
            You agree to pay applicable Fees for your Service Plan. Fees are as stated at checkout, in
            an Order Form, or on our pricing page at {SITE_URL}. Undisputed Fees must be paid on time.
            Disputed Fees must be raised within thirty (30) days of invoice date.
          </p>
          <h3>5.2 Taxes</h3>
          <p>
            Fees are exclusive of VAT and similar taxes unless stated otherwise. You are responsible
            for applicable taxes except taxes on Clarifi&apos;s income.
          </p>
          <h3>5.3 Payment</h3>
          <p>
            Paid subscriptions are processed by Stripe or another designated payment processor. You
            authorise us to charge your payment method for recurring Fees. Keep billing details
            current.
          </p>
          <h3>5.4 Late Payment</h3>
          <p>
            If payment is overdue, Clarifi may suspend access after notice. Interest may apply where
            permitted by law.
          </p>
          <h3>5.5 EU Consumer Rights</h3>
          <p>
            If you are a consumer in the European Union or EEA, you may have a statutory right to
            withdraw from distance contracts within fourteen (14) days of purchase, subject to
            exceptions where digital services have begun with your express consent. Contact us at{' '}
            <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a> to exercise applicable rights.
          </p>

          <h2 id="warranties">6. Warranties</h2>
          <h3>6.1 Mutual Warranty</h3>
          <p>Each party represents that it has authority to enter into this Agreement.</p>
          <h3>6.2 Disclaimer</h3>
          <p>
            EXCEPT AS REQUIRED BY APPLICABLE LAW, THE SERVICES ARE PROVIDED &quot;AS IS&quot; AND
            &quot;AS AVAILABLE&quot;. CLARIFI DISCLAIMS ALL WARRANTIES, EXPRESS OR IMPLIED,
            INCLUDING MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE, AND NON-INFRINGEMENT. CLARIFI
            DOES NOT WARRANT UNINTERRUPTED OR ERROR-FREE OPERATION.
          </p>
          <h3>6.3 Beta Services</h3>
          <p>
            Beta Services are provided without warranty, may change at any time, and may be less
            reliable than production Services.
          </p>

          <h2 id="confidential">7. Confidential Information</h2>
          <p>
            Each party may receive confidential information from the other. The receiving party shall
            use such information only to perform under this Agreement and protect it with reasonable
            care. Confidential Information includes terms of this Agreement, Customer Data, Clarifi
            Materials, and non-public business information.
          </p>

          <h2 id="term">8. Term and Termination</h2>
          <h3>8.1 Term and Renewal</h3>
          <p>
            This Agreement begins on the Effective Date and continues until terminated. Paid
            subscriptions renew automatically for successive billing periods unless you cancel before
            renewal through your account settings or by contacting us at least thirty (30) days before
            the renewal date, unless a different period is stated at checkout.
          </p>
          <h3>8.2 Termination for Breach</h3>
          <p>
            Either party may terminate for material breach not cured within thirty (30) days of
            written notice, or immediately where cure is not possible or for insolvency events.
          </p>
          <h3>8.3 Effect of Termination</h3>
          <p>
            Upon termination, your right to use the Services ends. We may delete Customer Data after
            termination subject to our Privacy Policy and legal retention obligations. You may request
            export or deletion of your data before termination where technically feasible.
          </p>

          <h2 id="indemnity">9. Indemnity</h2>
          <h3>9.1 Clarifi Indemnity</h3>
          <p>
            Clarifi will defend you against third-party claims alleging that your authorised use of
            the Services infringes a third party&apos;s intellectual property rights, and pay damages
            finally awarded, subject to your prompt notice and cooperation.
          </p>
          <h3>9.2 Customer Indemnity</h3>
          <p>
            You will defend Clarifi against claims arising from your breach of Section 4, your Customer
            Data, your use of Output, or your violation of recording or consent laws.
          </p>

          <h2 id="liability">10. Limitation of Liability</h2>
          <p>
            TO THE MAXIMUM EXTENT PERMITTED BY APPLICABLE LAW, NEITHER PARTY SHALL BE LIABLE FOR
            INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR PUNITIVE DAMAGES, OR LOST PROFITS OR
            DATA, ARISING FROM THIS AGREEMENT. CLARIFI&apos;S TOTAL LIABILITY SHALL NOT EXCEED THE FEES
            PAID BY YOU IN THE TWELVE (12) MONTHS PRECEDING THE CLAIM.
          </p>
          <p>
            Nothing in this Agreement limits liability that cannot be limited under applicable law,
            including mandatory consumer rights in Spain and the EEA, or liability for death, personal
            injury, or fraud.
          </p>

          <h2 id="general">11. General Provisions</h2>
          <h3>11.1 Relationship</h3>
          <p>The parties are independent contractors. No partnership, agency, or employment relationship is created.</p>
          <h3>11.2 Notices</h3>
          <p>
            Notices to Clarifi: <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>. Service
            notices may be sent by email or through the Services.
          </p>
          <h3>11.3 Governing Law</h3>
          <p>
            This Agreement is governed by the laws of Spain, without regard to conflict-of-law rules.
            If you are a consumer in the EEA, you benefit from mandatory protections of your country
            of residence where they apply.
          </p>
          <h3>11.4 Dispute Resolution</h3>
          <p>
            We encourage you to contact us first to resolve disputes. If you are a consumer in the EU,
            you may use the European Commission&apos;s Online Dispute Resolution platform at{' '}
            <a
              href="https://ec.europa.eu/consumers/odr"
              target="_blank"
              rel="noopener noreferrer"
            >
              ec.europa.eu/consumers/odr
            </a>
            . Courts in your place of residence may have jurisdiction for consumer disputes as
            required by law. For business customers, exclusive jurisdiction lies with the courts of
            Spain unless mandatory law provides otherwise.
          </p>
          <h3>11.5 Assignment</h3>
          <p>
            You may not assign this Agreement without our consent. Clarifi may assign in connection
            with a merger, acquisition, or sale of assets.
          </p>
          <h3>11.6 Subcontractors</h3>
          <p>
            Clarifi may use subprocessors subject to appropriate contractual safeguards. A list is
            available on request.
          </p>
          <h3>11.7 Changes</h3>
          <p>
            We may update this Agreement. Material changes will be posted on this page and, where
            required, notified by email. Continued use after changes take effect constitutes
            acceptance. If you object, you may cancel before the next renewal term.
          </p>
          <h3>11.8 Entire Agreement</h3>
          <p>
            This Agreement, the Privacy Policy, and applicable Order Forms constitute the entire
            agreement. Customer purchase order terms do not apply unless expressly agreed in writing.
          </p>

          <h2 id="contact">Contact Us</h2>
          <p>
            Questions about this Agreement:{' '}
            <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>
          </p>
          <p>
            Related: <Link href="/privacy">Privacy Policy</Link>
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
