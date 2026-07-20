type ClarifiLogoMarkProps = {
  size?: number
  className?: string
}

const LOGO_SRC = `${import.meta.env.BASE_URL}clarifi-logo.png`

export function ClarifiLogoMark({ size = 26, className }: ClarifiLogoMarkProps) {
  return (
    <img
      src={LOGO_SRC}
      alt=""
      width={size}
      height={size}
      className={className}
      draggable={false}
    />
  )
}
