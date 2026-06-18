import { app } from 'electron'
import * as fs from 'fs'
import * as path from 'path'
import { MemoryRepository } from './memoryRepository'
import { MemoryService } from './MemoryService'
import type { MemoryExportBundle } from './types'

export function exportMemoryBundle(): MemoryExportBundle {
  const sessions = MemoryService.listSessionsSync(500)
  return {
    exportedAt: Date.now(),
    settings: MemoryService.getSettingsSync(),
    profile: MemoryService.getUserProfileSync(),
    facts: MemoryService.listFactsSync(),
    sessions,
    summaries: sessions
      .map((s) => MemoryRepository.getSessionSummary(s.id))
      .filter((s): s is NonNullable<typeof s> => s != null),
    people: MemoryRepository.listPeople(undefined, 500),
    actionItems: MemoryRepository.listOpenActionItems(500),
  }
}

export function exportMemoryToFile(): string {
  const bundle = exportMemoryBundle()
  const dir = path.join(app.getPath('userData'), 'memory', 'exports')
  fs.mkdirSync(dir, { recursive: true })
  const filename = `clarifi-memory-${new Date().toISOString().slice(0, 10)}.json`
  const fullPath = path.join(dir, filename)
  fs.writeFileSync(fullPath, JSON.stringify(bundle, null, 2))
  return fullPath
}

export function clearAllMemoryData(): void {
  MemoryRepository.clearAllMemoryData()
  MemoryService.initialize()
}

export function applyRetentionPolicy(): number {
  const settings = MemoryService.getSettingsSync()
  const cutoff = Date.now() - settings.retentionDays * 86_400_000
  return MemoryRepository.purgeSessionsOlderThan(cutoff)
}
