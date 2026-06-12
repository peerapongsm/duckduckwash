import type { OrderStatus } from '../../shared/types'

const FLOW: Record<OrderStatus, OrderStatus | null> = {
  waiting_input: 'in_progress',
  in_progress: 'complete',
  complete: 'closed',
  closed: null
}

export function nextStatus(s: OrderStatus): OrderStatus | null {
  return FLOW[s]
}
