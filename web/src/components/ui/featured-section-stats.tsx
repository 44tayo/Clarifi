'use client'

import { Area, AreaChart, ResponsiveContainer, Tooltip } from 'recharts'

const CHART_DATA = [
  { name: 'Jan', value: 20 },
  { name: 'Feb', value: 40 },
  { name: 'Mar', value: 60 },
  { name: 'Apr', value: 80 },
  { name: 'May', value: 100 },
  { name: 'Jun', value: 130 },
  { name: 'Jul', value: 160 },
]

export function FeaturedSectionStats() {
  return (
    <section className="mx-auto w-full max-w-6xl py-32 text-left">
      <div className="px-4">
        <h3 className="mb-16 text-lg font-medium text-gray-900 sm:text-xl lg:text-4xl dark:text-white">
          Powering teams with real-time insights.{' '}
          <span className="text-sm text-gray-500 sm:text-base lg:text-4xl dark:text-gray-400">
            Our next-gen analytics dashboard helps you track performance, manage clients, and make
            data-driven decisions in seconds.
          </span>
        </h3>

        <div className="mt-8 grid grid-cols-2 gap-6 sm:grid-cols-4">
          <div>
            <p className="text-3xl font-medium text-gray-900">50,000+</p>
            <p className="text-md text-gray-500">Projects Managed</p>
          </div>
          <div>
            <p className="text-3xl font-medium text-gray-900">99.9%</p>
            <p className="text-md text-gray-500">Uptime Guarantee</p>
          </div>
          <div>
            <p className="text-3xl font-medium text-gray-900">1,200+</p>
            <p className="text-md text-gray-500">Enterprise Clients</p>
          </div>
          <div>
            <p className="text-3xl font-medium text-gray-900">1.2s</p>
            <p className="text-md text-gray-500">Avg. Response Time</p>
          </div>
        </div>
      </div>

      <div className="mt-8 h-48 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={CHART_DATA}>
            <defs>
              <linearGradient id="colorBlue" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.4} />
                <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
              </linearGradient>
            </defs>
            <Tooltip />
            <Area
              type="monotone"
              dataKey="value"
              stroke="#3b82f6"
              strokeWidth={2}
              fillOpacity={1}
              fill="url(#colorBlue)"
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </section>
  )
}
