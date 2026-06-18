export type BlogBlock =
  | { type: 'p'; text: string; strong?: boolean }
  | { type: 'h2'; id?: string; text: string }
  | { type: 'h3'; text: string }
  | { type: 'ul'; items: string[] }
  | { type: 'ol'; items: string[] }
  | { type: 'table'; headers: string[]; rows: string[][] }
  | { type: 'cta'; text: string; href: string; label: string }
  | { type: 'hr' }

export type BlogCategory = 'blog' | 'announcement' | 'press'

export type BlogAuthor = {
  name: string
  avatar?: string
}

export type BlogPost = {
  slug: string
  title: string
  excerpt: string
  date: string
  readTime: string
  image: string
  imageAlt: string
  metaDescription: string
  metaTitle: string
  category: BlogCategory
  author: BlogAuthor
  featured?: boolean
  externalUrl?: string
  blocks: BlogBlock[]
}

export const BLOG_POSTS: BlogPost[] = [
    {
    slug: 'ai-meeting-assistant',
    featured: true,
    title: 'AI Meeting Assistant: Do You Actually Need One in 2026?',
    excerpt:
      'AI meeting assistants are everywhere — but do you need one? We compare notetakers vs real-time copilots, who they\'re for, and what to look for.',
    date: 'June 10, 2026',
    readTime: '8 min read',
    category: 'blog',
    author: { name: 'Clarifi Team' },
    image: '/blog/ai-meeting-assistant.png',
    imageAlt:
      'Illustration of a person overwhelmed by meeting notes and charts at a desk — representing the overload an AI meeting assistant can help solve',
    metaTitle: 'Do You Need an AI Meeting Assistant in 2026?',
    metaDescription:
      'AI meeting assistants are everywhere in 2026 — but do you need one? We compare notetakers vs real-time copilots, who they\'re for, and what to look for before you commit.',
    blocks: [
      {
        type: 'p',
        text: 'Short answer: You probably need an AI meeting assistant if your meetings affect revenue, hiring, or trust — and you want help during the call, not just a summary afterward. For low-stakes internal check-ins, you likely don\'t.',
        strong: true,
      },
      {
        type: 'p',
        text: 'Everybody seems to have an AI meeting assistant these days. A colleague swears by theirs. A new tool launches every week. And somewhere in the back of your mind, you\'re wondering if you\'re already behind.',
      },
      {
        type: 'p',
        text: 'Before you sign up for another subscription, it\'s worth asking the obvious question: do you actually need an AI meeting assistant?',
      },
      {
        type: 'p',
        text: 'Here\'s an honest answer — no hype, no "AI will change everything" TED talk.',
      },
      { type: 'hr' },
      { type: 'h2', id: 'what-is', text: 'What Is an AI Meeting Assistant?' },
      {
        type: 'p',
        text: 'An AI meeting assistant is software that helps you during or after meetings on Zoom, Google Meet, Microsoft Teams, or other platforms — usually by listening to the conversation and producing transcripts, summaries, suggestions, or live answers.',
      },
      {
        type: 'p',
        text: 'Important: not all of them work the same way.',
      },
      {
        type: 'table',
        headers: ['Type', 'How it works', 'Best for', 'Limitation'],
        rows: [
          [
            'AI notetaker',
            'Often joins as a visible "bot" participant, records, transcribes, summarizes after the call',
            'Documentation, async follow-up',
            'Help arrives after the moment that mattered',
          ],
          [
            'Real-time AI copilot',
            'Runs on your device as a private overlay; listens locally without joining the meeting',
            'Live sales calls, interviews, high-stakes Q&A',
            'You still need judgment — it augments, not replaces you',
          ],
        ],
      },
      {
        type: 'p',
        text: 'Tools like Otter, Fireflies, and Fathom are mostly in the first bucket. Clarifi is in the second: a real-time AI meeting copilot that helps while you\'re still on the call — without a bot on the guest list and without showing up on screen share.',
      },
      {
        type: 'p',
        text: 'For the ethics side of using AI on live calls, read our post Is Using AI in Meetings Cheating? on the Clarifi blog.',
      },
      { type: 'h2', id: 'who-needs', text: 'Who Actually Needs an AI Meeting Assistant?' },
      {
        type: 'p',
        text: 'Not everyone. If your week is mostly internal standups with nothing at stake, a shared doc is enough.',
      },
      {
        type: 'p',
        text: 'But if any of these sound familiar, an AI meeting assistant is worth serious consideration:',
      },
      {
        type: 'ul',
        items: [
          'High-stakes calls are routine — sales demos, client presentations, investor meetings, job interviews. When answers matter, real-time support beats a recap an hour later.',
          'You stop listening when you\'re thinking. Most people do. A real-time AI meeting tool can hold context while you stay present.',
          'Deals die in the Q&A. You nailed the pitch; a curveball killed momentum. Live prompts help you recover in the same breath.',
          'Post-meeting admin eats your day. Notes, CRM updates, follow-ups — an assistant that captures context live saves hours.',
          'You want a higher floor, not just peak days. AI doesn\'t replace skill, but it reduces the gap between your best meeting and your tired-Tuesday meeting.',
        ],
      },
      {
        type: 'h2',
        id: 'what-to-look-for',
        text: 'What to Look for in the Best AI Meeting Assistant',
      },
      {
        type: 'p',
        text: '"Best" depends on your job. Use this checklist before you commit:',
      },
      { type: 'h3', text: '1. Real-time vs post-meeting' },
      {
        type: 'p',
        text: 'Do you need help during the conversation or only after? Post-meeting summaries are useful; they can\'t fix a pause that already happened.',
      },
      { type: 'h3', text: '2. Bot vs invisible' },
      {
        type: 'p',
        text: 'If the tool joins as a participant, everyone sees it — and some buyers or interviewers will care. If you need discretion, look for an undetectable AI meeting assistant that runs locally and stays off screen share.',
      },
      { type: 'h3', text: '3. Latency' },
      {
        type: 'p',
        text: 'In a fast conversation, a three-second delay might as well be never. Test how quickly suggestions appear under pressure.',
      },
      { type: 'h3', text: '4. Price and limits' },
      {
        type: 'p',
        text: 'Watch per-seat pricing, per-minute caps, and features that lock mid-meeting. The best AI meeting assistant for you is one you can actually use every day without hitting a wall.',
      },
      { type: 'h3', text: '5. Customisation' },
      {
        type: 'p',
        text: 'Generic answers help generic meetings. Sales, recruiting, and consulting all need different context — battlecards, objections, product detail. Prefer tools you can tune to your world.',
      },
      { type: 'h2', id: 'case-for-waiting', text: 'The Honest Case for Waiting' },
      {
        type: 'p',
        text: 'You might not need one yet if:',
      },
      {
        type: 'ul',
        items: [
          'You\'re early in a role and still building foundational knowledge — lean on AI to augment, not skip learning.',
          'Your meetings are low-stakes and predictable — ROI may not be there.',
          'Your org forbids recording or third-party tools — check policy first.',
        ],
      },
      { type: 'h2', id: 'case-for-not-waiting', text: 'The Case for Not Waiting' },
      {
        type: 'p',
        text: 'Productivity tools compound. Early CRM adopters didn\'t just log a few more calls — they built better habits and data. AI meeting assistants are on a similar curve, especially real-time ones that change how conversations go, not just how they\'re documented.',
      },
      {
        type: 'p',
        text: 'The gap between people who show up with live support and people who don\'t will likely widen. Building the habit early is easier than catching up later.',
      },
      { type: 'h2', id: 'bottom-line', text: 'So, Do You Actually Need an AI Meeting Assistant?' },
      {
        type: 'p',
        text: 'Yes, if your work includes meetings where confidence, accuracy, and speed under pressure change outcomes — sales, fundraising, hiring, client delivery, negotiations.',
      },
      {
        type: 'p',
        text: 'No, if your calls are mostly low-stakes and you\'re fine with manual notes.',
      },
      {
        type: 'p',
        text: 'Not because AI is trendy. Because the alternative is walking into important conversations with less support than you could have — for no good reason.',
        strong: true,
      },
      { type: 'h2', id: 'faq', text: 'FAQ' },
      { type: 'h3', text: 'What is an AI meeting assistant?' },
      {
        type: 'p',
        text: 'Software that helps before, during, or after meetings — typically via transcription, summaries, or live suggestions on platforms like Zoom, Meet, and Teams.',
      },
      { type: 'h3', text: 'Is an AI meeting assistant the same as an AI notetaker?' },
      {
        type: 'p',
        text: 'Often grouped together, but not the same. Notetakers focus on after the call. Real-time copilots focus on during the call.',
      },
      { type: 'h3', text: 'Do AI meeting assistants join Zoom as a bot?' },
      {
        type: 'p',
        text: 'Many notetakers do. Desktop copilots like Clarifi are designed not to join — they listen locally so nothing extra appears on the guest list or screen share.',
      },
      { type: 'h3', text: 'What\'s the best AI meeting assistant for sales calls?' },
      {
        type: 'p',
        text: 'Usually a real-time AI copilot for meetings that surfaces objections, talk tracks, and answers live — not just a transcript the next morning.',
      },
      { type: 'h3', text: 'Are AI meeting assistants worth it in 2026?' },
      {
        type: 'p',
        text: 'If even one high-stakes conversation per week affects your results, yes — especially if you choose real-time help over post-meeting notes alone.',
      },
      {
        type: 'p',
        text: 'Clarifi is a real-time AI meeting copilot — invisible on screen share, built for people who can\'t afford a bad meeting.',
      },
      {
        type: 'cta',
        text: 'Launching August 24, 2026.',
        href: '/#faq',
        label: 'Join the waitlist →',
      },
      {
        type: 'p',
        text: 'Follow updates on X @Clarifi_ai.',
      },
    ],
  },
  {
    slug: 'is-using-ai-in-meetings-cheating',
    title: "Is Using AI in Meetings Cheating? Here's the Honest Answer for Sales Reps",
    excerpt:
      'Sales reps use AI copilots for real-time answers on live calls. Is that cheating — or just smart selling? The honest ethics breakdown.',
    date: 'June 9, 2026',
    readTime: '9 min read',
    category: 'blog',
    author: { name: 'Clarifi Team' },
    image: '/blog/is-using-ai-in-meetings-cheating.png',
    imageAlt:
      'Illustration of a sales rep presenting to a team with flowing ideas — representing real-time AI support during meetings',
    metaTitle: 'Is Using AI in Meetings Cheating? Honest Answer for Sales',
    metaDescription:
      'Is using AI in meetings cheating? Sales reps use AI copilots for real-time answers on live calls. Here\'s the honest ethics breakdown — and what top closers do instead.',
    blocks: [
      {
        type: 'p',
        text: 'Is using AI in meetings cheating? For most sales reps, no — not when the goal is to give accurate answers faster, not to misrepresent who you are or what your product does.',
      },
      {
        type: 'p',
        text: "If you've ever frozen mid-demo while a prospect asked about pricing, a competitor, or a technical edge case, you already know the cost of that pause: momentum dies, trust wobbles, and \"let me follow up\" becomes another stalled deal.",
      },
      {
        type: 'p',
        text: 'More reps are fixing that with an AI meeting assistant — software that listens live and surfaces real-time AI answers during the call. The ethics question followed immediately: is this an unfair advantage, or just smart selling?',
      },
      {
        type: 'p',
        text: 'This post answers that honestly — without the hype — and explains when AI on sales calls crosses the line.',
      },
      { type: 'hr' },
      { type: 'h2', id: 'the-case', text: 'The case that it\'s "cheating"' },
      {
        type: 'p',
        text: 'The argument usually sounds like this: If you need AI to answer a question, you don\'t really know your product. You\'re deceiving the prospect. You\'re cutting corners.',
      },
      {
        type: 'p',
        text: 'On the surface, that feels fair. Sales has always rewarded reps who know their stuff — who can handle objections without flinching and speak confidently about value.',
      },
      {
        type: 'p',
        text: "But that argument assumes something worth examining: that every answer on a live call must come from memory alone, with no tools, no teammates, and no preparation support in the moment. We don't apply that standard anywhere else in sales.",
      },
      { type: 'h2', id: 'cheating-vs-smart', text: 'What counts as cheating vs. smart selling' },
      {
        type: 'p',
        text: 'Before labeling an AI sales tool as cheating, compare it to what reps already do without guilt:',
      },
      {
        type: 'table',
        headers: ['What reps do today', 'Is it "cheating"?', "Why it's accepted"],
        rows: [
          ['Review CRM notes before a call', 'No', 'Preparation'],
          ['Open a battlecard during a competitor question', 'No', 'Enablement'],
          ['Bring a sales engineer on the call', 'No', 'Expertise on demand'],
          ['Search internal docs while a prospect waits', 'No', 'Accuracy over ego'],
          [
            'Use an AI copilot for sales calls for real-time answers',
            'Usually no',
            'Same goal: serve the buyer better',
          ],
        ],
      },
      {
        type: 'p',
        text: "The job of a sales rep is not to win a trivia contest. It's to understand the prospect's problem, communicate value clearly, and help them make a confident decision.",
      },
      {
        type: 'p',
        text: 'If an AI meeting assistant helps you do that more accurately — without inventing features or lying about pricing — the prospect often gets a better experience, not a worse one.',
      },
      { type: 'h3', text: 'Where it does become a problem' },
      {
        type: 'ul',
        items: [
          'Misrepresenting product capabilities you know aren\'t true',
          'Fabricating case studies, metrics, or security certifications',
          "Pretending to be a technical expert when you're fundamentally not — and dodging honest scope conversations",
          'Using AI to deceive, not to inform',
        ],
      },
      {
        type: 'p',
        text: "That's not an AI problem. That's an integrity problem — and it existed long before real-time copilots.",
        strong: true,
      },
      {
        type: 'p',
        text: 'Short answer: Using AI in meetings is not cheating when you use it to answer accurately and help the buyer. It is unethical when you use it to mislead.',
        strong: true,
      },
      { type: 'h2', id: 'what-ai-does', text: 'What an AI copilot for sales calls actually does' },
      {
        type: 'p',
        text: 'Not all meeting AI works the same way — and that matters for the ethics conversation.',
      },
      {
        type: 'p',
        text: 'After-the-call tools transcribe, summarize, and send follow-ups after you hang up. Useful for documentation. Useless when a prospect asks a hard question in second 37 of the demo.',
      },
      {
        type: 'p',
        text: 'Real-time AI meeting assistants work differently. They:',
      },
      {
        type: 'ol',
        items: [
          'Listen live to the conversation (and sometimes screen context)',
          'Detect moments that matter — objections, pricing pushes, competitor mentions, technical probes',
          'Surface real-time AI answers — talking points, rebuttals, clarifying questions — while you\'re still on the call',
          'Run invisibly — without joining as a bot participant or appearing on screen share',
        ],
      },
      {
        type: 'p',
        text: 'Tools like Clarifi are built for that second category: an overlay on your Mac that acts like a senior colleague whispering the right line — not a replacement for your judgment.',
      },
      {
        type: 'p',
        text: "This isn't about outsourcing your expertise. It's about removing the performance gap between what you understand about the deal and what you can articulate under pressure, in real time.",
      },
      { type: 'h2', id: 'transparency', text: 'The transparency question reps should ask' },
      {
        type: 'p',
        text: 'The real ethical line isn\'t "did you use AI?" It\'s "did you mislead the buyer?"',
      },
      {
        type: 'p',
        text: 'Ask yourself before every call:',
      },
      {
        type: 'ol',
        items: [
          'Would I stand behind this answer if the prospect asked me to explain it again without help?',
          'Am I using AI to be more accurate — or to bluff past gaps I should honestly address?',
          'If the prospect knew I had live support, would they feel deceived — or would they just appreciate the fast, correct response?',
        ],
      },
      {
        type: 'p',
        text: "In most B2B sales conversations, buyers care about outcomes: clarity, speed, trust, and whether you can actually solve their problem. They don't care whether you remembered a pricing tier from memory or surfaced it in two seconds with assistance.",
      },
      {
        type: 'p',
        text: 'Good rule of thumb: Use AI to reduce errors and hesitation. Don\'t use it to inflate capabilities.',
        strong: true,
      },
      { type: 'h2', id: 'top-reps', text: 'Why top reps are adopting real-time AI now' },
      {
        type: 'p',
        text: 'The reps still debating whether an AI meeting assistant is "fair" are often the same ones who will wonder, six months from now, why peers close faster with fewer follow-up loops.',
      },
      {
        type: 'p',
        text: "Early CRM adopters didn't win because spreadsheets were immoral. They won because they had better information at the right moment. Real-time AI is the same shift — but for live conversations, not post-call admin.",
      },
      {
        type: 'p',
        text: "Here's what changes when you have an AI copilot for sales calls on every meeting:",
      },
      {
        type: 'ul',
        items: [
          'Objection handling gets faster — the rebuttal is there before the awkward pause.',
          'Technical questions stop freezing deals — respond with substance instead of defaulting to "I\'ll loop in engineering."',
          'Discovery improves — when you\'re not scrambling, you actually listen.',
          'Follow-up gets tighter — context is captured live, not reconstructed from memory.',
          'Confidence compounds — knowing you can handle curveballs changes how you show up on every call.',
        ],
      },
      {
        type: 'p',
        text: 'The gap between reps who use real-time AI answers and reps who don\'t will widen the same way the CRM gap did. Not because AI is magic — because speed and accuracy win deals.',
      },
      { type: 'h2', id: 'faq', text: 'FAQ' },
      { type: 'h3', text: 'Is using AI in meetings cheating?' },
      {
        type: 'p',
        text: 'For most sales reps, no. Using an AI meeting assistant to get real-time answers during a call is closer to using a battlecard or CRM notes than to deceiving a prospect. It becomes unethical when you use AI to misrepresent your product, invent capabilities, or mislead buyers about qualifications or outcomes.',
      },
      { type: 'h3', text: "Do prospects know when you're using AI on a call?" },
      {
        type: 'p',
        text: "It depends on the tool. Some AI notetakers join as visible meeting participants. Others — like desktop copilots — run as a private overlay only you see. Either way, the ethical standard isn't visibility; it's whether you're giving honest, accurate information.",
      },
      { type: 'h3', text: 'Is an AI meeting assistant the same as a notetaker?' },
      {
        type: 'p',
        text: 'No. Notetakers focus on transcription and summaries after the call. A real-time AI copilot for sales calls is built for the moment a prospect asks an unexpected question — when you need an answer in seconds, not a recap in an hour.',
      },
      { type: 'h3', text: 'Can AI help with sales objections in real time?' },
      {
        type: 'p',
        text: "Yes — that's one of the highest-value use cases. A good AI sales tool can surface objection-handling frameworks, competitor positioning, and clarifying questions while the conversation is still live.",
      },
      { type: 'h3', text: 'When should a sales rep not use AI in a meeting?' },
      {
        type: 'p',
        text: 'Skip it (or use it carefully) when the conversation requires deep bespoke scoping, sensitive HR/legal discussions, or situations where you personally need to own every word. And never use AI to fabricate answers you can\'t defend.',
      },
      { type: 'h2', id: 'bottom-line', text: 'Bottom line' },
      {
        type: 'p',
        text: 'Is using AI in meetings cheating? No — not if your standard is what sales has always rewarded: know the customer, tell the truth, and move the deal forward with clarity.',
      },
      {
        type: 'p',
        text: 'An AI meeting assistant is the modern version of being well-prepared — except instead of memorizing every possible scenario the night before, you get real-time AI answers that adapt to wherever the conversation actually goes.',
      },
      {
        type: 'p',
        text: 'The reps asking "is this cheating?" will be the ones asking "how is everyone else closing faster?" next year. The reps who use an AI copilot for sales calls responsibly — to be accurate, not to bluff — are already pulling ahead.',
      },
      {
        type: 'p',
        text: 'Clarifi is a real-time AI meeting copilot built for sales reps who want to show up to every call fully prepared — whatever gets thrown at them. No bot joining your Zoom. No overlay on screen share. Just live support when you need it.',
      },
      {
        type: 'cta',
        text: 'Launching August 24, 2026.',
        href: '/#faq',
        label: 'Join the waitlist →',
      },
      {
        type: 'p',
        text: "Have a take on this? We'd love to hear it — find us on X @Clarifi_ai.",
      },
    ],
  },
]

export const BLOG_POST_SLUGS = BLOG_POSTS.map((post) => post.slug)

export function getBlogPost(slug: string): BlogPost | undefined {
  return BLOG_POSTS.find((post) => post.slug === slug)
}
