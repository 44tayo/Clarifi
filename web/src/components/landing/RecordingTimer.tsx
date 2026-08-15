'use client'

import { useEffect, useState } from 'react'

export function RecordingTimer() {
  const [seconds, setSeconds] = useState(19)

  useEffect(() => {
    const id = window.setInterval(() => {
      setSeconds((s) => (s >= 59 ? 0 : s + 1))
    }, 1000)
    return () => window.clearInterval(id)
  }, [])

  const mm = String(Math.floor(seconds / 60)).padStart(2, '0')
  const ss = String(seconds % 60).padStart(2, '0')

  return (
    <div className="landing-timer">
      {mm}:{ss}
    </div>
  )
}
