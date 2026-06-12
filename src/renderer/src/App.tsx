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
  { key: 'home', label: 'Home' },
  { key: 'orders', label: 'Orders' },
  { key: 'customers', label: 'Customers' },
  { key: 'expenses', label: 'Expenses' },
  { key: 'reports', label: 'Reports' },
  { key: 'settings', label: 'Settings' }
] as const

export default function App(): JSX.Element {
  const [screen, setScreen] = useState<Screen>({ name: 'home' })

  return (
    <div className="flex h-screen flex-col text-lg">
      <header className="flex items-center gap-3 border-b px-4 py-2">
        <img src={logo} alt="DuckDuckWash" className="h-10" />
        <span className="text-xl font-bold">DuckDuckWash</span>
      </header>
      <main className="flex-1 overflow-y-auto p-4">
        {screen.name === 'home' && <Home go={setScreen} />}
        {screen.name === 'newOrder' && <NewOrder go={setScreen} />}
        {screen.name === 'orders' && <Orders go={setScreen} />}
        {screen.name === 'orderDetails' && <OrderDetails orderId={screen.orderId} go={setScreen} />}
        {screen.name === 'customers' && <Customers />}
        {screen.name === 'expenses' && <Expenses />}
        {screen.name === 'reports' && <Reports />}
        {screen.name === 'settings' && <Settings />}
      </main>
      <nav className="btm-nav btm-nav-lg static border-t">
        {TABS.map((tab) => (
          <button
            key={tab.key}
            className={screen.name === tab.key ? 'active text-primary' : ''}
            onClick={() => setScreen({ name: tab.key } as Screen)}
          >
            {tab.label}
          </button>
        ))}
      </nav>
    </div>
  )
}
