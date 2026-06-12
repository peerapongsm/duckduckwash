export type OrderStatus = 'waiting_input' | 'in_progress' | 'complete' | 'closed'

export type ServiceKey =
  | 'wash_dry_fold'
  | 'wash_dry_fold_iron'
  | 'iron'
  | 'dry_clean'

export interface Customer {
  id: number
  name: string
  location: string | null
  phone: string | null
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
  customer_phone: string | null
  created_at: string
  status: OrderStatus
  is_delivery: number
  total: number
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
}

// phase 1: drop-off intake
export interface OrderIntake {
  customer_id: number | null
  customer_name: string
  customer_location: string | null
  customer_phone: string | null
  is_delivery: boolean
  service_ids: number[]
  notes: string | null
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
}

export interface OrderDetailsInput {
  order_id: number
  items: ItemDetailInput[]
  garments: GarmentInput[]
}

export interface RangeReport {
  revenue: number
  expenses: number
  profit: number
  granularity: 'day' | 'month'
  buckets: { label: string; revenue: number }[]
}

export interface Expense {
  id: number
  date: string
  category: 'supplies' | 'utilities' | 'rent' | 'other'
  description: string | null
  amount: number
}

export interface TodayStats {
  income: number
  waitingInput: number
  inProgress: number
  readyForPickup: number
}
