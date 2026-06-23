export type OrderStatus = 'waiting_input' | 'in_progress' | 'complete' | 'closed'

export type ServiceKey =
  | 'wash_dry_fold'
  | 'wash_dry_fold_iron'
  | 'iron'
  | 'dry_clean'

export type Wearer = 'male' | 'female' | 'child'

export interface Customer {
  id: number
  name: string
  location: string | null
  contact: string | null
  notes: string | null
  created_at: string
}

export interface Service {
  id: number
  key: ServiceKey
  unit: 'kg' | 'item'
  pricing: 'fixed' | 'custom'
  default_price: number | null
  active: number
}

export interface Order {
  id: number
  customer_id: number | null
  customer_name: string
  customer_location: string | null
  customer_contact: string | null
  created_at: string
  status: OrderStatus
  is_delivery: number
  total: number
  surcharge_amount: number
  notes: string | null
}

export interface OrderItem {
  id: number
  order_id: number
  service_id: number
  quantity: number | null
  unit_price: number | null
  total: number | null
}

export interface OrderGarment {
  id: number
  order_id: number
  garment: string
  quantity: number
  special_care: number
  wearer: Wearer
}

// phase 1: drop-off intake
export interface OrderIntake {
  customer_id: number | null
  customer_name: string
  customer_location: string | null
  customer_contact: string | null
  is_delivery: boolean
  service_ids: number[]
  notes: string | null
  // optional backdate (YYYY-MM-DD) for entering old orders; null = now
  created_at: string | null
}

// phase 2: detail input
export interface ItemDetailInput {
  item_id: number
  quantity: number
  unit_price: number // for fixed pricing the caller passes the service default; main re-validates
}

export interface GarmentInput {
  garment: string
  quantity: number
  special_care: boolean
  wearer: Wearer
}

export interface OrderDetailsInput {
  order_id: number
  is_delivery: boolean
  surcharge_amount: number
  // optional date edit (YYYY-MM-DD); null/undefined leaves created_at unchanged
  created_at?: string | null
  items: ItemDetailInput[]
  garments: GarmentInput[]
}

export interface RangeReport {
  revenue: number
  expenses: number
  profit: number
  granularity: 'day' | 'month'
  buckets: { label: string; revenue: number }[]
  revenueByService: BreakdownItem[]
  expensesByCategory: BreakdownItem[]
}

// One slice of a revenue/expense breakdown (already label-resolved by the main
// process), sorted by amount descending and limited to non-zero entries.
export interface BreakdownItem {
  label: string
  amount: number
}

export interface Expense {
  id: number
  date: string
  category: 'supplies' | 'utilities' | 'rent' | 'food' | 'salary' | 'other'
  description: string | null
  amount: number
}

export interface TodayStats {
  income: number
  waitingInput: number
  inProgress: number
  readyForPickup: number
}
