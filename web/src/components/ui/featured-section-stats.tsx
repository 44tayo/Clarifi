'use client'

import { Area, AreaChart, ResponsiveContainer, Tooltip } from 'recharts'

/** Illustrative transcript growth across a sample meeting — not live user data. */
const CHART_DATA = [
  { minute: '0m', lines: 0 },
  { minute: '5m', lines: 8 },
  { minute: '10m', lines: 17 },
  { minute: '15m', lines: 26 },
  { minute: '20m', lines: 34 },
  { minute: '25m', lines: 43 },
  { minute: '30m', lines: 52 },
  { minute: '35m', lines: 61 },
  { minute: '40m', lines: 69 },
  { minute: '45m', lines: 78 },
]

const STATS = [
  { value: '0', label: 'Bots in your meetings' },
  { value: '300ms', label: 'Avg transcription time' },
  { value: 'Unlimited', label: 'Meetings notetaken' },
  { value: 'Seconds', label: 'From "end call" to summary' },
] as const

export function FeaturedSectionStats() {
  return (
    <section className="mx-auto w-full max-w-6xl py-32 text-left">
      <div className="px-4">
        <h3 className="mb-16 text-lg font-medium text-[var(--cl-navy)] sm:text-xl lg:text-4xl">
          Less scrambling. More clarity in every meeting.{' '}
          <span className="text-sm text-[var(--cl-muted)] sm:text-base lg:text-4xl">
            Clarifi listens in the background and turns it into clean notes the moment you&apos;re
            done — without ever joining the call as a bot.
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
                formatter={(value) => [`${value ?? 0} lines`, 'Transcript captured']}
                labelFormatter={(label) => `${label} into meeting`}
              />
              <Area
                type="monotone"
                dataKey="lines"
                stroke="#3b82f6"
                strokeWidth={2}
                fillOpacity={1}
                fill="url(#colorBlue)"
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
        <p className="mt-3 px-4 text-sm text-[var(--cl-muted)]">
          Sample 45-min meeting — live transcript lines captured over time
        </p>
      </div>
    </section>
  )
}
