-- Схема локальной базы данных SQLite для зоомагазина «Лапа и Дом»
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  uid TEXT NOT NULL UNIQUE,
  email TEXT NOT NULL UNIQUE,
  display_name TEXT NOT NULL DEFAULT '',
  password_hash TEXT NOT NULL DEFAULT '',
  role TEXT NOT NULL DEFAULT 'customer' CHECK (role IN ('admin', 'customer')),
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS suppliers (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  contact_person TEXT NOT NULL,
  phone TEXT NOT NULL,
  email TEXT NOT NULL,
  city TEXT NOT NULL,
  lead_time_days INTEGER NOT NULL DEFAULT 2,
  categories TEXT NOT NULL,
  notes TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS products (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  sku TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  category TEXT NOT NULL CHECK (category IN ('animals', 'supplies', 'food', 'care', 'treats', 'medicine')),
  species TEXT NOT NULL CHECK (species IN ('Кошки', 'Собаки', 'Птицы', 'Грызуны', 'Рыбки')),
  supplier_id INTEGER NOT NULL REFERENCES suppliers(id),
  price INTEGER NOT NULL CHECK (price > 0),
  purchase_price INTEGER NOT NULL CHECK (purchase_price >= 0),
  stock INTEGER NOT NULL DEFAULT 0 CHECK (stock >= 0),
  min_stock INTEGER NOT NULL DEFAULT 5 CHECK (min_stock >= 0),
  unit TEXT NOT NULL DEFAULT 'шт',
  description TEXT NOT NULL DEFAULT '',
  specs TEXT NOT NULL DEFAULT '',
  image_url TEXT NOT NULL,
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS orders (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  order_number TEXT NOT NULL UNIQUE,
  user_uid TEXT NOT NULL REFERENCES users(uid),
  customer_name TEXT NOT NULL,
  customer_phone TEXT NOT NULL,
  delivery_address TEXT NOT NULL,
  payment_method TEXT NOT NULL,
  payment_status TEXT NOT NULL DEFAULT 'Ожидает оплаты' CHECK (payment_status IN ('Ожидает оплаты', 'Оплачен клиентом', 'Оплата при получении')),
  payment_confirmed_at TEXT,
  status TEXT NOT NULL DEFAULT 'В обработке' CHECK (status IN ('В обработке', 'Выполнен', 'Доставлен', 'Отменён')),
  total_amount INTEGER NOT NULL CHECK (total_amount >= 0),
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS order_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  order_id INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  product_id INTEGER NOT NULL REFERENCES products(id),
  sku TEXT NOT NULL,
  product_name TEXT NOT NULL,
  category TEXT NOT NULL,
  quantity INTEGER NOT NULL CHECK (quantity > 0),
  unit_price INTEGER NOT NULL CHECK (unit_price >= 0),
  subtotal INTEGER NOT NULL CHECK (subtotal >= 0)
);

CREATE TABLE IF NOT EXISTS stock_movements (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  product_id INTEGER NOT NULL REFERENCES products(id),
  product_name TEXT NOT NULL,
  sku TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('Приход от поставщика', 'Продажа', 'Корректировка', 'Списание')),
  delta INTEGER NOT NULL,
  balance_after INTEGER NOT NULL CHECK (balance_after >= 0),
  supplier_id INTEGER REFERENCES suppliers(id),
  supplier_name TEXT,
  note TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
