import fs from 'node:fs'
import path from 'node:path'

export function backupDb(dbPath: string, backupDir: string, keep = 30): string | null {
  if (!fs.existsSync(dbPath)) return null
  fs.mkdirSync(backupDir, { recursive: true })
  const stamp = new Date().toISOString().replace(/[:T]/g, '-').slice(0, 19)
  const dest = path.join(backupDir, `laundry-${stamp}.db`)
  fs.copyFileSync(dbPath, dest)

  const old = fs.readdirSync(backupDir)
    .filter((f) => f.startsWith('laundry-') && f.endsWith('.db'))
    .sort()
    .reverse()
    .slice(keep)
  for (const f of old) fs.unlinkSync(path.join(backupDir, f))
  return dest
}
