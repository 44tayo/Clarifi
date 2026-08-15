type IconSizeProps = {
  size?: number
  className?: string
}

const googleSrc = `${import.meta.env.BASE_URL}logos/google-calendar.svg`
const outlookSrc = `${import.meta.env.BASE_URL}logos/outlook-calendar.svg`

export function GoogleCalendarIcon({ size = 34, className }: IconSizeProps) {
  return (
    <img
      src={googleSrc}
      alt=""
      width={size}
      height={size}
      className={className}
      draggable={false}
    />
  )
}

export function OutlookCalendarIcon({ size = 34, className }: IconSizeProps) {
  return (
    <img
      src={outlookSrc}
      alt=""
      width={size}
      height={size}
      className={className}
      draggable={false}
    />
  )
}

export function CalendarBrandStack({ size = 34 }: { size?: number }) {
  return (
    <div className="home-calendar-icons" aria-hidden>
      <span className="home-calendar-badge home-calendar-badge-img">
        <GoogleCalendarIcon size={size - 4} />
      </span>
      <span className="home-calendar-badge home-calendar-badge-img home-calendar-badge-overlap">
        <OutlookCalendarIcon size={size - 4} />
      </span>
    </div>
  )
}
