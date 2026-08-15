import type { CSSProperties, ReactElement, SVGProps } from 'react'

import {
  DEFAULT_FOLDER_ICON,
  folderColorHex,
  isFolderEmoji,
  isFolderIconId,
  type FolderIconId,
} from '../../shared/folderAppearance'

type IconProps = SVGProps<SVGSVGElement>

function base(props: IconProps) {
  return {
    width: 16,
    height: 16,
    viewBox: '0 0 16 16',
    fill: 'none',
    'aria-hidden': true as const,
    ...props,
  }
}

const STROKE = { stroke: 'currentColor', strokeWidth: 1.3, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const }

const ICONS: Record<FolderIconId, (props: IconProps) => ReactElement> = {
  folder: (p) => (
    <svg {...base(p)}>
      <path d="M2.5 5.2A1.7 1.7 0 0 1 4.2 3.5h2.1L7.5 5h4.3A1.7 1.7 0 0 1 13.5 6.7v4.6A1.7 1.7 0 0 1 11.8 13H4.2A1.7 1.7 0 0 1 2.5 11.3V5.2Z" {...STROKE} />
    </svg>
  ),
  briefcase: (p) => (
    <svg {...base(p)}>
      <rect x="2.5" y="5" width="11" height="8" rx="1.5" {...STROKE} />
      <path d="M6 5V4a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1v1M2.5 8h11" {...STROKE} />
    </svg>
  ),
  users: (p) => (
    <svg {...base(p)}>
      <circle cx="6" cy="5.5" r="2" {...STROKE} />
      <circle cx="11" cy="6" r="1.6" {...STROKE} />
      <path d="M2.5 12.5c.5-2 2-3 3.5-3s3 1 3.5 3M9.5 10c1 .2 2.2 1 2.8 2.5" {...STROKE} />
    </svg>
  ),
  calendar: (p) => (
    <svg {...base(p)}>
      <rect x="2.5" y="3.5" width="11" height="10" rx="1.5" {...STROKE} />
      <path d="M2.5 6.5h11M5.5 2.5v2M10.5 2.5v2" {...STROKE} />
    </svg>
  ),
  mic: (p) => (
    <svg {...base(p)}>
      <rect x="6" y="2.5" width="4" height="7" rx="2" {...STROKE} />
      <path d="M4 8.5a4 4 0 0 0 8 0M8 12.5v1.5" {...STROKE} />
    </svg>
  ),
  video: (p) => (
    <svg {...base(p)}>
      <rect x="2.5" y="4.5" width="8" height="7" rx="1.5" {...STROKE} />
      <path d="M10.5 7l3-1.5v5L10.5 9" {...STROKE} />
    </svg>
  ),
  document: (p) => (
    <svg {...base(p)}>
      <path d="M4.5 2.5h5l3 3V13.5a1 1 0 0 1-1 1h-7a1 1 0 0 1-1-1v-10a1 1 0 0 1 1-1Z" {...STROKE} />
      <path d="M9.5 2.5V6h3.5M5.5 9h5M5.5 11.5h3.5" {...STROKE} />
    </svg>
  ),
  star: (p) => (
    <svg {...base(p)}>
      <path d="M8 2.5l1.6 3.3 3.6.5-2.6 2.6.6 3.6L8 11.2l-3.2 1.7.6-3.6L2.8 6.3l3.6-.5L8 2.5Z" {...STROKE} />
    </svg>
  ),
  bookmark: (p) => (
    <svg {...base(p)}>
      <path d="M4.5 2.5h7v11L8 11.2 4.5 13.5v-11Z" {...STROKE} />
    </svg>
  ),
  flag: (p) => (
    <svg {...base(p)}>
      <path d="M4 2.5v11M4 3.5h7l-1.5 2.5L11 8.5H4" {...STROKE} />
    </svg>
  ),
  rocket: (p) => (
    <svg {...base(p)}>
      <path d="M8 2.5c2.5 1.5 4 4 4 6.5 0 1.2-.4 2.2-1.2 3L8 14.5 5.2 12c-.8-.8-1.2-1.8-1.2-3 0-2.5 1.5-5 4-6.5Z" {...STROKE} />
      <circle cx="8" cy="7" r="1.2" {...STROKE} />
      <path d="M5 12.5l-1.5 1.5M11 12.5l1.5 1.5" {...STROKE} />
    </svg>
  ),
  target: (p) => (
    <svg {...base(p)}>
      <circle cx="8" cy="8" r="5.5" {...STROKE} />
      <circle cx="8" cy="8" r="3" {...STROKE} />
      <circle cx="8" cy="8" r="1" fill="currentColor" />
    </svg>
  ),
  chart: (p) => (
    <svg {...base(p)}>
      <path d="M2.5 13.5h11M4.5 13V8M8 13V5M11.5 13V9" {...STROKE} />
    </svg>
  ),
  lightbulb: (p) => (
    <svg {...base(p)}>
      <path d="M6 12.5h4M6.5 14h3M8 2.5a4 4 0 0 1 2.5 7c-.5.4-1 1.2-1 2h-3c0-.8-.5-1.6-1-2A4 4 0 0 1 8 2.5Z" {...STROKE} />
    </svg>
  ),
  building: (p) => (
    <svg {...base(p)}>
      <path d="M3.5 13.5h9M4.5 13.5V4.5l3.5-2 3.5 2v9M7 6.5h.01M9.5 6.5h.01M7 9h.01M9.5 9h.01" {...STROKE} />
    </svg>
  ),
  handshake: (p) => (
    <svg {...base(p)}>
      <path d="M2.5 8.5l2-2 2.5 1.5 2-2 2.5 1.5 2-1.5M5.5 10.5l1.5 1.5h2l1.5-1.5" {...STROKE} />
    </svg>
  ),
  mail: (p) => (
    <svg {...base(p)}>
      <rect x="2.5" y="4" width="11" height="8" rx="1.5" {...STROKE} />
      <path d="M3 5l5 3.5L13 5" {...STROKE} />
    </svg>
  ),
  tag: (p) => (
    <svg {...base(p)}>
      <path d="M2.5 8.5V3.5h5l6 6-5 5-6-6Z" {...STROKE} />
      <circle cx="5.5" cy="6" r="1" fill="currentColor" />
    </svg>
  ),
  shield: (p) => (
    <svg {...base(p)}>
      <path d="M8 2.5l5 2v4c0 3-2.2 5.2-5 6-2.8-.8-5-3-5-6v-4l5-2Z" {...STROKE} />
    </svg>
  ),
  sparkles: (p) => (
    <svg {...base(p)}>
      <path d="M8 2.5v3M8 10.5v3M2.5 8h3M10.5 8h3M4.2 4.2l2 2M9.8 9.8l2 2M11.8 4.2l-2 2M6.2 9.8l-2 2" {...STROKE} />
    </svg>
  ),
}

export function FolderGlyph({
  icon,
  color,
  size = 16,
  className,
}: {
  icon?: string | null
  color?: string | null
  size?: number
  className?: string
}) {
  const style: CSSProperties = {
    color: folderColorHex(color),
    width: size,
    height: size,
    flexShrink: 0,
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: size * 0.92,
    lineHeight: 1,
  }

  if (isFolderEmoji(icon)) {
    return (
      <span className={className} style={style} aria-hidden>
        {icon}
      </span>
    )
  }

  const id = isFolderIconId(icon) ? icon : DEFAULT_FOLDER_ICON
  const Icon = ICONS[id]
  return (
    <span className={className} style={style}>
      <Icon width={size} height={size} />
    </span>
  )
}
