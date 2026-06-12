import { useState } from 'react'
import type { JSX } from 'react'
import logo from './assets/logo.png'
import Home from './screens/Home'
import NewOrder from './screens/NewOrder'
import Orders from './screens/Orders'
import OrderDetails from './screens/OrderDetails'
import Customers from './screens/Customers'
import Expenses from './screens/Expenses'
import Reports from './screens/Reports'
import Settings from './screens/Settings'

export type Screen =
  | { name: 'home' } | { name: 'newOrder' } | { name: 'orders' }
  | { name: 'orderDetails'; orderId: number }
  | { name: 'customers' } | { name: 'expenses' } | { name: 'reports' } | { name: 'settings' }

const TABS = [
  { key: 'home', label: 'Home', icon: '🏠' },
  { key: 'orders', label: 'Orders', icon: '🧺' },
  { key: 'customers', label: 'Customers', icon: '👥' },
  { key: 'expenses', label: 'Expenses', icon: '🧾' },
  { key: 'reports', label: 'Reports', icon: '📈' },
  { key: 'settings', label: 'Settings', icon: '⚙️' }
] as const

const TITLES: Record<Screen['name'], string> = {
  home: 'Today at the shop',
  newOrder: 'New order',
  orders: 'Orders',
  orderDetails: 'Order details',
  customers: 'Regular customers',
  expenses: 'Expenses',
  reports: 'Monthly report',
  settings: 'Settings'
}

export default function App(): JSX.Element {
  const [screen, setScreen] = useState<Screen>({ name: 'home' })

  return (
    <div className="flex h-screen text-lg">
      <aside className="flex w-56 shrink-0 flex-col gap-1 border-r border-base-300 bg-base-200/70 p-3">
        <div className="mb-4 flex items-center gap-2 px-2 pt-2">
          <img src={logo} alt="" className="h-12 w-12 object-contain drop-shadow" />
          <div className="font-display text-xl font-semibold leading-tight">
            DuckDuck<span className="text-secondary">Wash</span>
          </div>
        </div>
        {TABS.map((tab) => {
          const active = screen.name === tab.key || (tab.key === 'orders' && screen.name === 'orderDetails')
          return (
            <button
              key={tab.key}
              className={`btn btn-lg justify-start gap-3 border-0 font-display text-lg font-medium ${
                active ? 'btn-primary shadow-soft' : 'btn-ghost hover:bg-base-300/60'
              }`}
              onClick={() => setScreen({ name: tab.key } as Screen)}
            >
              <span className="text-2xl">{tab.icon}</span>
              {tab.label}
            </button>
          )
        })}
        <div className="mt-auto px-3 pb-2 text-sm opacity-50">Cash only · ฿</div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="px-8 pb-2 pt-6">
          <h1 className="font-display text-3xl font-semibold">{TITLES[screen.name]}</h1>
        </header>
        <main className="flex-1 overflow-y-auto px-8 pb-8 pt-2">
          {screen.name === 'home' && <Home go={setScreen} />}
          {screen.name === 'newOrder' && <NewOrder go={setScreen} />}
          {screen.name === 'orders' && <Orders go={setScreen} />}
          {screen.name === 'orderDetails' && <OrderDetails orderId={screen.orderId} go={setScreen} />}
          {screen.name === 'customers' && <Customers />}
          {screen.name === 'expenses' && <Expenses />}
          {screen.name === 'reports' && <Reports />}
          {screen.name === 'settings' && <Settings />}
        </main>
      </div>
    </div>
  )
}
