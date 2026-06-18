import { app } from 'electron'
import Database from 'better-sqlite3'
import * as fs from 'fs'
import * as path from 'path'

let db: Database.Database | null = null

export function getMemoryDirectory(): string {
  return path.join(app.getPath('userData'), 'memory')
}

export function getMemoryDbPath(): string {
  return path.join(getMemoryDirectory(), 'clarifi-memory.db')
}

export function openMemoryDatabase(): Database.Database {
  if (db) return db

  const dir = getMemoryDirectory()
  fs.mkdirSync(dir, { recursive: true })

  db = new Database(getMemoryDbPath())
  db.pragma('journal_mode = WAL')
  db.pragma('busy_timeout = 5000')
  db.pragma('foreign_keys = ON')

  return db
}

export function closeMemoryDatabase(): void {
  if (!db) return
  db.close()
  db = null
}

export function getMigrationsDirectory(): string {
  return path.join(__dirname, 'memory', 'migrations')
}
