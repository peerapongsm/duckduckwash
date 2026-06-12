import fs from 'node:fs'
import path from 'node:path'
import type Database from 'better-sqlite3'

export async function backupDb(db: Database.Database, backupDir: string, keep = 30): Promise<string> {
  fs.mkdirSync(backupDir, { recursive: true })
  const stamp = new Date().toISOString().replace(/[:T]/g, '-').slice(0, 19)
  const dest = path.join(backupDir, `laundry-${stamp}.db`)
  await db.backup(dest)

  const old = fs.readdirSync(backupDir)
    .filter((f) => f.startsWith('laundry-') && f.endsWith('.db'))
    .sort()
    .reverse()
    .slice(keep)
  for (const f of old) fs.unlinkSync(path.join(backupDir, f))
  return dest
}
