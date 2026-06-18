import * as fs from 'fs'
import * as path from 'path'
import { getMigrationsDirectory, openMemoryDatabase } from './db'

type MigrationRow = {
  version: number
  name: string
}

function ensureMigrationsTable(): void {
  const db = openMemoryDatabase()
  db.exec(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version     INTEGER PRIMARY KEY,
      name        TEXT NOT NULL,
      applied_at  INTEGER NOT NULL
    );
  `)
}

function getAppliedVersions(): Set<number> {
  const db = openMemoryDatabase()
  const rows = db.prepare('SELECT version FROM schema_migrations ORDER BY version').all() as MigrationRow[]
  return new Set(rows.map((row) => row.version))
}

function listMigrationFiles(): { version: number; name: string; filePath: string }[] {
  const dir = getMigrationsDirectory()
  if (!fs.existsSync(dir)) {
    console.warn('[memory] migrations directory missing:', dir)
    return []
  }

  return fs
    .readdirSync(dir)
    .filter((file) => /^\d+_.+\.sql$/.test(file))
    .map((file) => {
      const version = Number.parseInt(file.split('_')[0] ?? '', 10)
      return { version, name: file.replace(/\.sql$/, ''), filePath: path.join(dir, file) }
    })
    .filter((entry) => Number.isFinite(entry.version))
    .sort((a, b) => a.version - b.version)
}

export function runMemoryMigrations(): void {
  ensureMigrationsTable()
  const applied = getAppliedVersions()
  const db = openMemoryDatabase()

  for (const migration of listMigrationFiles()) {
    if (applied.has(migration.version)) continue

    const sql = fs.readFileSync(migration.filePath, 'utf-8')
    const apply = db.transaction(() => {
      db.exec(sql)
      db.prepare(
        'INSERT INTO schema_migrations (version, name, applied_at) VALUES (?, ?, ?)',
      ).run(migration.version, migration.name, Date.now())
    })

    apply()
    console.log(`[memory] applied migration ${migration.version}: ${migration.name}`)
  }
}

export function initializeMemoryDatabase(): void {
  openMemoryDatabase()
  runMemoryMigrations()
}
