import { relations } from 'drizzle-orm';
import {
  integer,
  jsonb,
  pgTable,
  serial,
  text,
  timestamp,
} from 'drizzle-orm/pg-core';
import type { CategoryId, OrderStatus, PaymentMethod, PetSpecies, StockMovementType, UserRole } from '../types.ts';

export const users = pgTable('users', {
  id: serial('id').primaryKey(),
  uid: text('uid').notNull().unique(),
  email: text('email').notNull(),
  displayName: text('display_name').notNull().default(''),
  role: text('role').$type<UserRole>().notNull().default('customer'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const suppliers = pgTable('suppliers', {
  id: serial('id').primaryKey(),
  name: text('name').notNull(),
  contactPerson: text('contact_person').notNull(),
  phone: text('phone').notNull(),
  email: text('email').notNull(),
  city: text('city').notNull(),
  leadTimeDays: integer('lead_time_days').notNull().default(2),
  categories: jsonb('categories').$type<CategoryId[]>().notNull(),
  notes: text('notes').notNull().default(''),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const products = pgTable('products', {
  id: serial('id').primaryKey(),
  sku: text('sku').notNull().unique(),
  name: text('name').notNull(),
  category: text('category').$type<CategoryId>().notNull(),
  species: text('species').$type<PetSpecies>().notNull(),
  supplierId: integer('supplier_id')
    .references(() => suppliers.id)
    .notNull(),
  price: integer('price').notNull(),
  purchasePrice: integer('purchase_price').notNull(),
  stock: integer('stock').notNull().default(0),
  minStock: integer('min_stock').notNull().default(5),
  unit: text('unit').notNull().default('шт'),
  description: text('description').notNull().default(''),
  specs: text('specs').notNull().default(''),
  imageUrl: text('image_url').notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const orders = pgTable('orders', {
  id: serial('id').primaryKey(),
  orderNumber: text('order_number').notNull().unique(),
  userUid: text('user_uid')
    .references(() => users.uid)
    .notNull(),
  customerName: text('customer_name').notNull(),
  customerPhone: text('customer_phone').notNull(),
  deliveryAddress: text('delivery_address').notNull(),
  paymentMethod: text('payment_method').$type<PaymentMethod>().notNull(),
  status: text('status').$type<OrderStatus>().notNull().default('В обработке'),
  totalAmount: integer('total_amount').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const orderItems = pgTable('order_items', {
  id: serial('id').primaryKey(),
  orderId: integer('order_id')
    .references(() => orders.id, { onDelete: 'cascade' })
    .notNull(),
  productId: integer('product_id')
    .references(() => products.id)
    .notNull(),
  sku: text('sku').notNull(),
  productName: text('product_name').notNull(),
  category: text('category').$type<CategoryId>().notNull(),
  quantity: integer('quantity').notNull(),
  unitPrice: integer('unit_price').notNull(),
  subtotal: integer('subtotal').notNull(),
});

export const stockMovements = pgTable('stock_movements', {
  id: serial('id').primaryKey(),
  productId: integer('product_id')
    .references(() => products.id)
    .notNull(),
  productName: text('product_name').notNull(),
  sku: text('sku').notNull(),
  type: text('type').$type<StockMovementType>().notNull(),
  delta: integer('delta').notNull(),
  balanceAfter: integer('balance_after').notNull(),
  supplierId: integer('supplier_id').references(() => suppliers.id),
  supplierName: text('supplier_name'),
  note: text('note').notNull().default(''),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const usersRelations = relations(users, ({ many }) => ({
  orders: many(orders),
}));

export const suppliersRelations = relations(suppliers, ({ many }) => ({
  products: many(products),
  stockMovements: many(stockMovements),
}));

export const productsRelations = relations(products, ({ one, many }) => ({
  supplier: one(suppliers, {
    fields: [products.supplierId],
    references: [suppliers.id],
  }),
  orderItems: many(orderItems),
  stockMovements: many(stockMovements),
}));

export const ordersRelations = relations(orders, ({ one, many }) => ({
  user: one(users, {
    fields: [orders.userUid],
    references: [users.uid],
  }),
  items: many(orderItems),
}));

export const orderItemsRelations = relations(orderItems, ({ one }) => ({
  order: one(orders, {
    fields: [orderItems.orderId],
    references: [orders.id],
  }),
  product: one(products, {
    fields: [orderItems.productId],
    references: [products.id],
  }),
}));

export const stockMovementsRelations = relations(stockMovements, ({ one }) => ({
  product: one(products, {
    fields: [stockMovements.productId],
    references: [products.id],
  }),
  supplier: one(suppliers, {
    fields: [stockMovements.supplierId],
    references: [suppliers.id],
  }),
}));
