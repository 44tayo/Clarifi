import type { ReactNode } from 'react'

type MacBookMockProps = {
  children: ReactNode
  className?: string
  size?: 'md' | 'lg'
}

export function MacBookMock({ children, className = '', size = 'md' }: MacBookMockProps) {
  return (
    <div className={`macbook-mock size-${size} ${className}`.trim()}>
      <div className="macbook-lid">
        <div className="macbook-bezel">
          <div className="macbook-camera" aria-hidden />
          <div className="macbook-screen">{children}</div>
        </div>
      </div>
      <div className="macbook-hinge" aria-hidden />
      <div className="macbook-base" aria-hidden />
    </div>
  )
}
