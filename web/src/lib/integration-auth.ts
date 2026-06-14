import { getUserIdFromDeviceRequest } from '@/lib/device-auth'
import { getServerUserId } from '@/lib/auth-server'

export async function resolveIntegrationUserId(req: Request): Promise<string | null> {
  const deviceUserId = await getUserIdFromDeviceRequest(req)
  if (deviceUserId) return deviceUserId
  return getServerUserId()
}
