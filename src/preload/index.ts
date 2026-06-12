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
    list: (status: string) => invoke('orders:list', status),
    get: (id: number) => invoke('orders:get', id),
    advanceStatus: (id: number, from: string) => invoke('orders:advanceStatus', id, from),
    remove: (id: number) => invoke('orders:delete', id)
  },
  expenses: {
    create: (x: unknown) => invoke('expenses:create', x),
    list: (monthPrefix: string) => invoke('expenses:list', monthPrefix),
    remove: (id: number) => invoke('expenses:delete', id)
  },
  services: {
    list: () => invoke('services:list'),
    updatePrice: (p: unknown) => invoke('services:updatePrice', p)
  },
  settings: { get: (key: string) => invoke('settings:get', key) },
  reports: { monthly: (y: number, m: number) => invoke('reports:monthly', y, m) },
  home: { today: () => invoke('home:today') },
  backup: { run: () => invoke('backup:run'), openFolder: () => invoke('backup:openFolder') }
}

contextBridge.exposeInMainWorld('api', api)
export type Api = typeof api
