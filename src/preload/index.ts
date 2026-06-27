import { contextBridge, ipcRenderer } from 'electron'

const invoke = (channel: string, ...args: unknown[]) => ipcRenderer.invoke(channel, ...args)

const api = {
  customers: {
    list: () => invoke('customers:list'),
    search: (q: string) => invoke('customers:search', q),
    create: (c: unknown) => invoke('customers:create', c),
    remove: (id: number) => invoke('customers:delete', id)
  },
  orders: {
    intake: (o: unknown) => invoke('orders:intake', o),
    saveDetails: (d: unknown) => invoke('orders:saveDetails', d),
    list: (status: string, from?: string, to?: string) => invoke('orders:list', status, from, to),
    get: (id: number) => invoke('orders:get', id),
    advanceStatus: (id: number, from: string) => invoke('orders:advanceStatus', id, from),
    remove: (id: number) => invoke('orders:delete', id)
  },
  expenses: {
    createMany: (xs: unknown[]) => invoke('expenses:createMany', xs),
    list: (monthPrefix: string) => invoke('expenses:list', monthPrefix),
    update: (x: unknown) => invoke('expenses:update', x),
    remove: (id: number) => invoke('expenses:delete', id)
  },
  garments: { types: () => invoke('garments:types') },
  services: {
    list: () => invoke('services:list'),
    updatePrice: (p: unknown) => invoke('services:updatePrice', p)
  },
  settings: { get: (key: string) => invoke('settings:get', key) },
  reports: {
    range: (from: string, to: string) => invoke('reports:range', from, to),
    export: (from: string, to: string): Promise<string | null> => invoke('reports:export', from, to) as Promise<string | null>
  },
  data: {
    export: (kind: string): Promise<string | null> => invoke('data:export', kind) as Promise<string | null>,
    import: (kind: string): Promise<{ inserted: number; updated: number; skipped: number } | null> =>
      invoke('data:import', kind) as Promise<{ inserted: number; updated: number; skipped: number } | null>
  },
  home: { today: () => invoke('home:today') },
  backup: { run: () => invoke('backup:run'), openFolder: () => invoke('backup:openFolder') }
}

contextBridge.exposeInMainWorld('api', api)
export type Api = typeof api
