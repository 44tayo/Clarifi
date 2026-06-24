import { useState } from 'react'
import type { DeviceProfile } from './types'
import { avatarPlaceholderColor, hasUploadedAvatar, profileInitials } from './utils'

type ProfileAvatarProps = {
  profile: DeviceProfile
  large?: boolean
  draftFirstName?: string
  draftLastName?: string
}

export function ProfileAvatar({
  profile,
  large = false,
  draftFirstName,
  draftLastName,
}: ProfileAvatarProps) {
  const [imageFailed, setImageFailed] = useState(false)
  const displayProfile: DeviceProfile =
    draftFirstName !== undefined || draftLastName !== undefined
      ? { ...profile, firstName: draftFirstName, lastName: draftLastName }
      : profile
  const showImage = hasUploadedAvatar(profile) && !imageFailed
  const sizeClass = large
    ? 'settings-profile-photo settings-profile-photo-lg'
    : 'settings-profile-photo'

  if (showImage && profile.localAvatarUrl) {
    return (
      <img
        src={profile.localAvatarUrl}
        alt=""
        className={sizeClass}
        onError={() => setImageFailed(true)}
      />
    )
  }

  return (
    <span
      className={`${sizeClass} settings-profile-photo-fallback`}
      style={{ backgroundColor: avatarPlaceholderColor(displayProfile) }}
    >
      {profileInitials(displayProfile)}
    </span>
  )
}

export async function resizeImageForAvatar(
  file: File,
  maxSize = 256,
): Promise<{ base64: string; mimeType: string }> {
  const bitmap = await createImageBitmap(file)
  const scale = Math.min(1, maxSize / Math.max(bitmap.width, bitmap.height))
  const width = Math.max(1, Math.round(bitmap.width * scale))
  const height = Math.max(1, Math.round(bitmap.height * scale))

  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('canvas_unavailable')

  ctx.drawImage(bitmap, 0, 0, width, height)
  bitmap.close()

  const mimeType = file.type.includes('png') ? 'image/png' : 'image/jpeg'
  const dataUrl = canvas.toDataURL(mimeType, mimeType === 'image/jpeg' ? 0.88 : undefined)
  const comma = dataUrl.indexOf(',')
  const base64 = comma >= 0 ? dataUrl.slice(comma + 1) : dataUrl
  return { base64, mimeType }
}
