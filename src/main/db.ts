import Database from 'better-sqlite3'

export function openDb(path: string): Database.Database {
  const db = new Database(path)
  db.pragma('journal_mode = WAL')
  db.pragma('foreign_keys = ON')

  db.exec(`
    CREATE TABLE IF NOT EXISTS customers (
      id INTEGER PRIMARY KEY,
      name TEXT NOT NULL,
      location TEXT,
      contact TEXT,
      notes TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now','localtime'))
    );
    CREATE TABLE IF NOT EXISTS services (
      id INTEGER PRIMARY KEY,
      key TEXT NOT NULL UNIQUE,
      unit TEXT NOT NULL,
      pricing TEXT NOT NULL,
      default_price REAL,
      active INTEGER NOT NULL DEFAULT 1
    );
    CREATE TABLE IF NOT EXISTS orders (
      id INTEGER PRIMARY KEY,
      customer_id INTEGER REFERENCES customers(id) ON DELETE SET NULL,
      customer_name TEXT NOT NULL,
      customer_location TEXT,
      customer_contact TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now','localtime')),
      status TEXT NOT NULL DEFAULT 'waiting_input',
      is_delivery INTEGER NOT NULL DEFAULT 0,
      total REAL NOT NULL DEFAULT 0,
      notes TEXT
    );
    CREATE TABLE IF NOT EXISTS order_items (
      id INTEGER PRIMARY KEY,
      order_id INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
      service_id INTEGER NOT NULL REFERENCES services(id),
      quantity REAL,
      unit_price REAL,
      total REAL
    );
    CREATE TABLE IF NOT EXISTS order_garments (
      id INTEGER PRIMARY KEY,
      order_id INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
      garment TEXT NOT NULL,
      quantity INTEGER NOT NULL DEFAULT 1,
      special_care INTEGER NOT NULL DEFAULT 0,
      wearer TEXT NOT NULL DEFAULT 'female'
    );
    CREATE TABLE IF NOT EXISTS expenses (
      id INTEGER PRIMARY KEY,
      date TEXT NOT NULL,
      category TEXT NOT NULL,
      description TEXT,
      amount REAL NOT NULL
    );
    CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT);
  `)

  // v1.0.0 databases used phone columns; contact is free text now
  const renameColumn = (table: string, from: string, to: string): void => {
    const cols = db.pragma(`table_info(${table})`) as { name: string }[]
    if (cols.some((c) => c.name === from)) db.exec(`ALTER TABLE ${table} RENAME COLUMN ${from} TO ${to}`)
  }
  renameColumn('customers', 'phone', 'contact')
  renameColumn('orders', 'customer_phone', 'customer_contact')

  // v1.0.3 added per-garment wearer (male/female/child) for sorting
  const addColumn = (table: string, col: string, def: string): void => {
    const cols = db.pragma(`table_info(${table})`) as { name: string }[]
    if (!cols.some((c) => c.name === col)) db.exec(`ALTER TABLE ${table} ADD COLUMN ${def}`)
  }
  addColumn('order_garments', 'wearer', "wearer TEXT NOT NULL DEFAULT 'female'")

  const seed = db.transaction(() => {
    const ins = db.prepare(
      'INSERT OR IGNORE INTO services (key, unit, pricing, default_price) VALUES (?, ?, ?, ?)'
    )
    ins.run('wash_dry_fold', 'kg', 'fixed', 150)
    ins.run('wash_dry_fold_iron', 'kg', 'fixed', 200)
    ins.run('iron', 'item', 'custom', null)
    ins.run('dry_clean', 'item', 'custom', null)
  })
  seed()
  return db
}
