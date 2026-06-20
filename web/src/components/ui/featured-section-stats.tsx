'use client'

import { Area, AreaChart, ResponsiveContainer, Tooltip } from 'recharts'

/** Illustrative assist activity across a sample sales call — not live user data. */
const CHART_DATA = [
  { minute: '0m', suggestions: 0 },
  { minute: '5m', suggestions: 1 },
  { minute: '10m', suggestions: 2 },
  { minute: '15m', suggestions: 5 },
  { minute: '20m', suggestions: 4 },
  { minute: '25m', suggestions: 8 },
  { minute: '30m', suggestions: 6 },
  { minute: '35m', suggestions: 10 },
  { minute: '40m', suggestions: 7 },
  { minute: '45m', suggestions: 3 },
]

const STATS = [
  { value: '0', label: 'Bots in your meetings' },
  { value: '100%', label: 'Invisible on screen share' },
  { value: '<2s', label: 'Avg assist response' },
  { value: 'Unlimited', label: 'Live assist per session' },
] as const

export function FeaturedSectionStats() {
  return (
    <section className="mx-auto w-full max-w-6xl py-32 text-left">
      <div className="px-4">
        <h3 className="mb-16 text-lg font-medium text-[var(--cl-navy)] sm:text-xl lg:text-4xl">
          Less scrambling. More clarity in every meeting.{' '}
          <span className="text-sm text-[var(--cl-muted)] sm:text-base lg:text-4xl">
            Clarifi listens, watches your screen, and surfaces answers the moment you need them —
            without joining the call.
          </span>
        </h3>

        <div className="mt-8 grid grid-cols-2 gap-6 sm:grid-cols-4">
          {STATS.map((stat) => (
            <div key={stat.label}>
              <p className="text-3xl font-medium text-gray-900">{stat.value}</p>
              <p className="text-md text-gray-500">{stat.label}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="mt-8">
        <div className="h-48 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={CHART_DATA}>
              <defs>
                <linearGradient id="colorBlue" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.4} />
                  <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                </linearGradient>
              </defs>
              <Tooltip
                formatter={(value) => [`${value ?? 0} suggestions`, 'Assist activity']}
                labelFormatter={(label) => `${label} into call`}
              />
              <Area
                type="monotone"
                dataKey="suggestions"
                stroke="#3b82f6"
                strokeWidth={2}
                fillOpacity={1}
                fill="url(#colorBlue)"
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
        <p className="mt-3 px-4 text-sm text-[var(--cl-muted)]">
          Sample 45-min call — assist suggestions surfaced over time
        </p>
      </div>
    </section>
  )
}
