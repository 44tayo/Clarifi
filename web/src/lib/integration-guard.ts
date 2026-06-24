import { resolveIntegrationUserId } from './integration-auth'
import { type Feature, type Plan } from './entitlements'
import { isPlanGuardResponse, planRequiredResponse, requireFeature } from './plan-guard'

export function unauthorizedIntegrationResponse(): Response {
  return Response.json({ error: 'unauthorized' }, { status: 401 })
}

export async function requireIntegrationAccess(
  req: Request,
  feature: Feature,
): Promise<{ userId: string; plan: Plan } | Response> {
  const userId = await resolveIntegrationUserId(req)
  if (!userId) return unauthorizedIntegrationResponse()

  const planOrBlock = await requireFeature(userId, feature)
  if (isPlanGuardResponse(planOrBlock)) return planOrBlock

  return { userId, plan: planOrBlock }
}

export async function requireIntegrationUserId(req: Request): Promise<string | Response> {
  const userId = await resolveIntegrationUserId(req)
  if (!userId) return unauthorizedIntegrationResponse()
  return userId
}

export async function requirePaidIntegrationUser(
  req: Request,
  feature: Feature,
): Promise<string | Response> {
  const access = await requireIntegrationAccess(req, feature)
  if (access instanceof Response) return access
  return access.userId
}

/** Web dashboard OAuth flows (Clerk session only). */
export async function requirePaidWebUser(
  userId: string | null,
  feature: Feature,
): Promise<Plan | Response> {
  if (!userId) return unauthorizedIntegrationResponse()
  const planOrBlock = await requireFeature(userId, feature)
  if (isPlanGuardResponse(planOrBlock)) return planOrBlock
  return planOrBlock
}

export { planRequiredResponse }
