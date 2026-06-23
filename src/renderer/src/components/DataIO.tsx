import { useState } from 'react'
import type { JSX } from 'react'

const msg = (err: unknown): string => (err instanceof Error ? err.message : String(err))

// Export / Import .xlsx buttons for one operational table. Import upserts on the
// ID column, so the same file round-trips: edit in Excel, import back.
export default function DataIO({
  kind,
  onImported
}: {
  kind: 'orders' | 'customers' | 'expenses'
  onImported: () => void
}): JSX.Element {
  const [busy, setBusy] = useState(false)

  async function doExport(): Promise<void> {
    setBusy(true)
    try {
      const path = await window.api.data.export(kind)
      if (path) alert('Saved to:\n' + path)
    } catch (err) {
      alert('Export failed: ' + msg(err))
    } finally {
      setBusy(false)
    }
  }

  async function doImport(): Promise<void> {
    setBusy(true)
    try {
      const r = await window.api.data.import(kind)
      if (r) {
        alert(
          `Imported: ${r.inserted} added, ${r.updated} updated` +
            (r.skipped ? `, ${r.skipped} skipped` : '')
        )
        onImported()
      }
    } catch (err) {
      alert('Import failed: ' + msg(err))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex gap-2">
      <button className="btn btn-outline" disabled={busy} onClick={doExport}>📤 Export .xlsx</button>
      <button className="btn btn-outline" disabled={busy} onClick={doImport}>📥 Import .xlsx</button>
    </div>
  )
}
