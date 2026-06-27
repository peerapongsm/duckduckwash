// Display dates as DD-MM-YYYY (day-month-year). Accepts a 'YYYY-MM-DD' or
// 'YYYY-MM-DD HH:MM:SS' string (how dates/datetimes are stored in SQLite).
// ponytail: native <input type="date"> pickers still follow the OS locale —
// only displayed text is reformatted here.
export function formatDate(s: string | null | undefined): string {
  if (!s) return ''
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(s)
  return m ? `${m[3]}-${m[2]}-${m[1]}` : s
}

// Same, keeping the HH:MM time when present (orders carry a datetime that helps
// disambiguate same-day orders).
export function formatDateTime(s: string | null | undefined): string {
  if (!s) return ''
  const m = /^(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{2}:\d{2}))?/.exec(s)
  if (!m) return s
  const d = `${m[3]}-${m[2]}-${m[1]}`
  return m[4] ? `${d} ${m[4]}` : d
}
