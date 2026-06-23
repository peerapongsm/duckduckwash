import ExcelJS from 'exceljs'
import type Database from 'better-sqlite3'
import { rangeReport } from './reports'
import { SERVICE_LABELS } from '../../shared/labels'

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/

interface OrderRow {
  created_at: string
  customer_name: string
  customer_location: string | null
  services: string | null
  is_delivery: number
  status: string
  total: number | null
}
interface ExpenseRow {
  date: string
  category: string
  description: string | null
  amount: number
}

const labelServices = (keys: string | null): string =>
  (keys ?? '').split(',').filter(Boolean).map((k) => SERVICE_LABELS[k] ?? k).join(', ')

// Build an .xlsx workbook (Summary + Orders + Expenses) for the given date range.
export async function buildReportWorkbook(
  db: Database.Database,
  from: string,
  to: string
): Promise<Buffer> {
  if (!DATE_RE.test(from) || !DATE_RE.test(to)) throw new Error('invalid date')
  if (from > to) throw new Error('start date must not be after end date')

  const report = rangeReport(db, from, to)

  const orders = db
    .prepare(
      `SELECT o.created_at, o.customer_name, o.customer_location,
              (SELECT GROUP_CONCAT(s.key) FROM order_items oi
               JOIN services s ON s.id = oi.service_id WHERE oi.order_id = o.id) AS services,
              o.is_delivery, o.status, o.total
       FROM orders o WHERE date(o.created_at) BETWEEN ? AND ?
       ORDER BY o.created_at`
    )
    .all(from, to) as OrderRow[]

  const expenses = db
    .prepare('SELECT date, category, description, amount FROM expenses WHERE date BETWEEN ? AND ? ORDER BY date')
    .all(from, to) as ExpenseRow[]

  const wb = new ExcelJS.Workbook()
  wb.creator = 'DuckDuckWash'

  const summary = wb.addWorksheet('Summary')
  summary.columns = [
    { header: '', key: 'k', width: 16 },
    { header: '', key: 'v', width: 20 }
  ]
  summary.addRow({ k: 'From', v: from })
  summary.addRow({ k: 'To', v: to })
  summary.addRow({ k: 'Revenue', v: report.revenue })
  summary.addRow({ k: 'Expenses', v: report.expenses })
  summary.addRow({ k: 'Profit', v: report.profit })
  summary.getColumn('k').font = { bold: true }
  for (const r of [3, 4, 5]) summary.getCell(`B${r}`).numFmt = '#,##0'

  const ordersSheet = wb.addWorksheet('Orders')
  ordersSheet.columns = [
    { header: 'Date', key: 'date', width: 20 },
    { header: 'Customer', key: 'customer', width: 22 },
    { header: 'Location', key: 'location', width: 22 },
    { header: 'Services', key: 'services', width: 28 },
    { header: 'Delivery', key: 'delivery', width: 10 },
    { header: 'Status', key: 'status', width: 14 },
    { header: 'Total', key: 'total', width: 12 }
  ]
  ordersSheet.getRow(1).font = { bold: true }
  for (const o of orders)
    ordersSheet.addRow({
      date: o.created_at,
      customer: o.customer_name,
      location: o.customer_location ?? '',
      services: labelServices(o.services),
      delivery: o.is_delivery ? 'Yes' : 'No',
      status: o.status,
      total: o.total ?? 0
    })
  ordersSheet.getColumn('total').numFmt = '#,##0'

  const expensesSheet = wb.addWorksheet('Expenses')
  expensesSheet.columns = [
    { header: 'Date', key: 'date', width: 14 },
    { header: 'Category', key: 'category', width: 16 },
    { header: 'Description', key: 'description', width: 32 },
    { header: 'Amount', key: 'amount', width: 12 }
  ]
  expensesSheet.getRow(1).font = { bold: true }
  for (const e of expenses)
    expensesSheet.addRow({
      date: e.date,
      category: e.category,
      description: e.description ?? '',
      amount: e.amount
    })
  expensesSheet.getColumn('amount').numFmt = '#,##0'

  return Buffer.from(await wb.xlsx.writeBuffer())
}
