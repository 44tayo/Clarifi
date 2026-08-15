export type MicOption = { deviceId: string; label: string }

export async function ensureMicPermission(): Promise<void> {
  await window.electronAPI.invoke('permissions:request-microphone')
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
    stream.getTracks().forEach((track) => track.stop())
  } catch {
    // Soft check for enumeration — labels may still be generic if denied.
  }
}

export async function acquireMicStream(deviceId?: string): Promise<MediaStream> {
  const audioConstraints: MediaTrackConstraints = {
    echoCancellation: true,
    noiseSuppression: true,
    ...(deviceId ? { deviceId: { ideal: deviceId } } : {}),
  }

  try {
    return await navigator.mediaDevices.getUserMedia({ audio: audioConstraints })
  } catch (error) {
    if (deviceId && error instanceof DOMException && error.name === 'OverconstrainedError') {
      return navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true },
      })
    }
    throw error
  }
}

export function isMicPermissionError(error: unknown): boolean {
  return error instanceof DOMException && error.name === 'NotAllowedError'
}

export function formatMicCaptureError(error: unknown): string {
  if (error instanceof DOMException) {
    if (error.name === 'NotAllowedError') {
      return 'Microphone access was denied. Allow Clarifi in System Settings → Privacy & Security → Microphone, then try again.'
    }
    if (error.name === 'NotFoundError') {
      return 'No microphone was found. Connect a mic or choose another device.'
    }
    if (error.name === 'NotReadableError') {
      return 'Your microphone is in use by another app. Close other apps and try again.'
    }
    if (error.name === 'OverconstrainedError') {
      return 'The selected microphone is unavailable. Choose another device.'
    }
    if (error.name === 'NotSupportedError') {
      return 'Recording is not supported for this microphone on your system.'
    }
    if (error.name === 'InvalidStateError') {
      return 'Could not start recording on this microphone. Quit and reopen Clarifi, then try again.'
    }
    if (error.message) {
      return error.message
    }
  }
  if (error instanceof Error && error.message) {
    return error.message
  }
  return 'Could not access your microphone. Check permissions and try again.'
}

export async function enumerateMicrophones(): Promise<MicOption[]> {
  await ensureMicPermission()
  const devices = await navigator.mediaDevices.enumerateDevices()
  const seen = new Set<string>()
  const inputs: MicOption[] = []

  for (const device of devices) {
    if (device.kind !== 'audioinput') continue
    const key = device.deviceId || device.label
    if (seen.has(key)) continue
    seen.add(key)
    inputs.push({
      deviceId: device.deviceId,
      label: device.label || `Microphone ${inputs.length + 1}`,
    })
  }

  return inputs
}

export function resolvePreferredMicId(mics: MicOption[], preferredId?: string): string {
  if (preferredId && mics.some((mic) => mic.deviceId === preferredId)) {
    return preferredId
  }
  const defaultMic = mics.find((mic) => mic.label.toLowerCase().startsWith('default'))
  if (defaultMic) return defaultMic.deviceId
  return mics[0]?.deviceId ?? ''
}
