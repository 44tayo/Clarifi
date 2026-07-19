import { app } from 'electron'
import * as fs from 'fs'
import * as path from 'path'

export type OnboardingState = {
  completed: boolean
  welcomeSeen: boolean
  permissionsSeen: boolean
}

const FILE = 'onboarding.json'

const DEFAULTS: OnboardingState = {
  completed: false,
  welcomeSeen: false,
  permissionsSeen: false,
}

function filePath(): string {
  return path.join(app.getPath('userData'), FILE)
}

export function loadOnboardingState(): OnboardingState {
  try {
    const raw = fs.readFileSync(filePath(), 'utf-8')
    const parsed = JSON.parse(raw) as Partial<OnboardingState>
    return {
      completed: Boolean(parsed.completed),
      welcomeSeen: Boolean(parsed.welcomeSeen),
      permissionsSeen: Boolean(parsed.permissionsSeen),
    }
  } catch {
    return { ...DEFAULTS }
  }
}

export function saveOnboardingState(patch: Partial<OnboardingState>): OnboardingState {
  const next = { ...loadOnboardingState(), ...patch }
  fs.mkdirSync(app.getPath('userData'), { recursive: true })
  fs.writeFileSync(filePath(), JSON.stringify(next, null, 2))
  return next
}

export function markOnboardingComplete(): OnboardingState {
  return saveOnboardingState({
    completed: true,
    welcomeSeen: true,
    permissionsSeen: true,
  })
}
