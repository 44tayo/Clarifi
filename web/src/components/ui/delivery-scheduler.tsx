import { ChevronLeft, ChevronRight } from 'lucide-react'
import { AnimatePresence, motion } from 'framer-motion'
import { useState } from 'react'
import { cva, type VariantProps } from 'class-variance-authority'

import { cn } from '@/lib/utils'

interface DeliverySchedulerProps {
  initialDate?: Date
  timeSlots: string[]
  timeZone: string
  onSchedule: (dateTime: { date: Date; time: string }) => void
  className?: string
}

const scheduleButtonVariants = cva(
  'relative isolate inline-flex items-center justify-center rounded-lg px-4 py-2 text-sm font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:pointer-events-none disabled:opacity-50',
  {
    variants: {
      variant: {
        default: 'bg-transparent text-foreground hover:bg-muted',
        selected: 'text-primary-foreground',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  },
)

const getWeekDays = (startDate: Date): Date[] => {
  const days: Date[] = []
  const startOfWeek = new Date(startDate)
  const day = startOfWeek.getDay()
  const diff = startOfWeek.getDate() - day + (day === 0 ? -6 : 1)
  startOfWeek.setDate(diff)

  for (let i = 0; i < 6; i++) {
    const nextDay = new Date(startOfWeek)
    nextDay.setDate(startOfWeek.getDate() + i)
    days.push(nextDay)
  }
  return days
}

export const DeliveryScheduler = ({
  initialDate = new Date(),
  timeSlots,
  timeZone,
  onSchedule,
  className,
}: DeliverySchedulerProps) => {
  const [currentDate, setCurrentDate] = useState(initialDate)
  const [selectedDate, setSelectedDate] = useState<Date>(initialDate)
  const [selectedTime, setSelectedTime] = useState<string | null>(timeSlots[0] || null)

  const weekDays = getWeekDays(currentDate)
  const monthYear = currentDate.toLocaleDateString('en-US', { year: 'numeric', month: 'long' })

  const changeWeek = (direction: 'prev' | 'next') => {
    const newDate = new Date(currentDate)
    newDate.setDate(newDate.getDate() + (direction === 'next' ? 7 : -7))
    setCurrentDate(newDate)
  }

  const handleSchedule = () => {
    if (selectedDate && selectedTime) {
      onSchedule({ date: selectedDate, time: selectedTime })
    }
  }

  return (
    <div
      className={cn(
        'w-full max-w-md rounded-2xl border border-border bg-card p-6 text-card-foreground shadow-lg shadow-black/5',
        className,
      )}
    >
      <div className="space-y-6">
        <div>
          <label className="text-sm font-medium text-muted-foreground">Delivery Window*</label>
          <div className="mt-2 flex items-center justify-between">
            <h3 className="font-semibold">{monthYear}</h3>
            <div className="flex items-center space-x-2">
              <button
                type="button"
                onClick={() => changeWeek('prev')}
                className="rounded-lg p-1 hover:bg-muted"
              >
                <ChevronLeft className="h-5 w-5" />
              </button>
              <button
                type="button"
                onClick={() => changeWeek('next')}
                className="rounded-lg p-1 hover:bg-muted"
              >
                <ChevronRight className="h-5 w-5" />
              </button>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-6 gap-2">
          {weekDays.map((day) => {
            const isSelected = selectedDate.toDateString() === day.toDateString()
            return (
              <div key={day.toISOString()} className="relative flex flex-col items-center">
                <span className="mb-2 text-xs text-muted-foreground">
                  {day.toLocaleDateString('en-US', { weekday: 'short' })}
                </span>
                <button
                  type="button"
                  onClick={() => setSelectedDate(day)}
                  className={cn(
                    scheduleButtonVariants({ variant: isSelected ? 'selected' : 'default' }),
                    'h-10 w-10',
                  )}
                >
                  <AnimatePresence>
                    {isSelected ? (
                      <motion.div
                        layoutId="date-selector"
                        className="absolute inset-0 z-0 rounded-lg bg-primary"
                        initial={{ scale: 0.5, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        exit={{ scale: 0.5, opacity: 0 }}
                        transition={{ type: 'spring', stiffness: 300, damping: 25 }}
                      />
                    ) : null}
                  </AnimatePresence>
                  <span className="relative z-10">{day.getDate()}</span>
                </button>
              </div>
            )
          })}
        </div>

        <div>
          <p className="text-sm font-medium">{timeZone}</p>
          <div className="mt-2 grid grid-cols-3 gap-2">
            {timeSlots.map((time) => {
              const isSelected = selectedTime === time
              return (
                <button
                  key={time}
                  type="button"
                  onClick={() => setSelectedTime(time)}
                  className={cn(
                    scheduleButtonVariants({ variant: isSelected ? 'selected' : 'default' }),
                  )}
                >
                  <AnimatePresence>
                    {isSelected ? (
                      <motion.div
                        layoutId="time-selector"
                        className="absolute inset-0 z-0 rounded-lg bg-primary"
                        initial={{ scale: 0.5, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        exit={{ scale: 0.5, opacity: 0 }}
                        transition={{ type: 'spring', stiffness: 300, damping: 25 }}
                      />
                    ) : null}
                  </AnimatePresence>
                  <span className="relative z-10">{time}</span>
                </button>
              )
            })}
          </div>
        </div>

        <div className="flex items-center justify-end space-x-3 border-t border-border pt-4">
          <button
            type="button"
            className={cn(scheduleButtonVariants({ variant: 'default' }), 'bg-muted px-6')}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSchedule}
            className={cn(scheduleButtonVariants({ variant: 'selected' }), 'bg-primary px-6')}
          >
            Schedule
          </button>
        </div>
      </div>
    </div>
  )
}
