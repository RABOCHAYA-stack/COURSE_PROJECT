import express from 'express';
import path from 'node:path';
import {
  optionalAuth,
  requireAdmin,
  requireAuth,
  type AuthRequest,
} from './src/middleware/auth.ts';
import { listAllUsers, updateUserRole } from './src/db/users.ts';
import {
  adjustProductStock,
  createOrder,
  createProduct,
  createSupplier,
  listOrders,
  listProducts,
  listStockMovements,
  listSuppliers,
  updateOrderStatus,
  updateSupplier,
} from './src/db/repository.ts';
import type {
  CategoryId,
  OrderStatus,
  PaymentMethod,
  PetSpecies,
  StockMovementType,
  UserRole,
} from './src/types.ts';

const PORT = 3000;

const VALID_CATEGORIES: ReadonlySet<CategoryId> = new Set([
  'animals',
  'supplies',
  'food',
  'care',
  'treats',
  'medicine',
]);
const VALID_SPECIES: ReadonlySet<PetSpecies> = new Set([
  'Кошки',
  'Собаки',
  'Птицы',
  'Грызуны',
  'Рыбки',
]);
const VALID_ORDER_STATUSES: ReadonlySet<OrderStatus> = new Set([
  'В обработке',
  'Выполнен',
  'Доставлен',
  'Отменён',
]);
const VALID_PAYMENT_METHODS: ReadonlySet<PaymentMethod> = new Set([
  'Картой при получении',
  'Наличными курьеру',
  'Онлайн-оплата',
]);
const VALID_ROLES: ReadonlySet<UserRole> = new Set(['admin', 'customer']);

const DEFAULT_CATEGORY_IMAGES: Record<CategoryId, string> = {
  animals: '/src/assets/images/cat_animals_companion_1795537999424.jpg',
  supplies: '/src/assets/images/cat_pet_accessories_1795537998453.jpg',
  food: '/src/assets/images/cat_food_premium_1795537996961.jpg',
  care: '/src/assets/images/cat_care_grooming_1795537998190.jpg',
  treats: '/src/assets/images/cat_treats_snacks_1795537998259.jpg',
  medicine: '/src/assets/images/cat_medicine_vet_1795537998705.jpg',
};

function sanitizeText(value: unknown, maxLen = 400): string {
  if (typeof value !== 'string') return '';
  return value.trim().slice(0, maxLen);
}

function isSafeImagePath(url: string): boolean {
  return url.startsWith('/src/assets/images/') || url.startsWith('https://');
}

function parsePositiveInt(value: unknown): number | null {
  const num = Number(value);
  if (!Number.isInteger(num) || num <= 0) return null;
  return num;
}

async function startServer() {
  const app = express();
  app.disable('x-powered-by');
  app.use(express.json({ limit: '1mb' }));

  // --- API: Auth & User Accounts ---
  app.get('/api/auth/me', requireAuth, (req: AuthRequest, res) => {
    res.json({ account: req.account });
  });

  app.get('/api/users', requireAuth, requireAdmin, async (_req: AuthRequest, res) => {
    try {
      const users = await listAllUsers();
      res.json(users);
    } catch (err) {
      res.status(500).json({
        error: err instanceof Error ? err.message : 'Ошибка загрузки пользователей.',
      });
    }
  });

  app.patch('/api/users/:id/role', requireAuth, requireAdmin, async (req: AuthRequest, res) => {
    const userId = parsePositiveInt(req.params.id);
    const body = req.body as Record<string, unknown>;
    const role = sanitizeText(body.role, 20) as UserRole;

    if (!userId) {
      res.status(400).json({ error: 'Некорректный идентификатор пользователя.' });
      return;
    }
    if (!VALID_ROLES.has(role)) {
      res.status(400).json({ error: 'Недопустимая роль пользователя.' });
      return;
    }

    try {
      const updated = await updateUserRole(userId, role, req.account!.uid);
      if (!updated) {
        res.status(404).json({ error: 'Пользователь не найден.' });
        return;
      }
      res.json(updated);
    } catch (err) {
      if (err instanceof Error && err.message === 'SELF_DEMOTION') {
        res.status(400).json({
          error: 'Нельзя снять права администратора с собственной активной учётной записи.',
        });
        return;
      }
      res.status(500).json({
        error: err instanceof Error ? err.message : 'Не удалось изменить роль.',
      });
    }
  });

  // --- API: Store Bootstrap (Role-Scoped) ---
  app.get('/api/store', optionalAuth, async (req: AuthRequest, res) => {
    try {
      const isAdmin = req.account?.role === 'admin';
      const catalogProducts = await listProducts(isAdmin);

      if (isAdmin) {
        const [allSuppliers, allOrders, allMovements, allUsers] = await Promise.all([
          listSuppliers(),
          listOrders(),
          listStockMovements(),
          listAllUsers(),
        ]);
        res.json({
          account: req.account,
          products: catalogProducts,
          suppliers: allSuppliers,
          orders: allOrders,
          stockMovements: allMovements,
          users: allUsers,
        });
        return;
      }

      res.json({
        account: req.account ?? null,
        products: catalogProducts,
        suppliers: [],
        orders: [],
        stockMovements: [],
        users: [],
      });
    } catch (err) {
      res.status(500).json({
        error: err instanceof Error ? err.message : 'Ошибка загрузки данных магазина.',
      });
    }
  });

  // --- API: Products & Inventory ---
  app.get('/api/products', optionalAuth, async (req: AuthRequest, res) => {
    try {
      const isAdmin = req.account?.role === 'admin';
      const all = await listProducts(isAdmin);
      const category = sanitizeText(req.query.category, 32);
      const species = sanitizeText(req.query.species, 32);
      const q = sanitizeText(req.query.q, 120).toLowerCase();

      const filtered = all.filter((p) => {
        if (category && category !== 'all' && p.category !== category) return false;
        if (species && species !== 'Все' && p.species !== species) return false;
        if (q) {
          const hay = `${p.name} ${p.sku} ${p.description} ${p.specs}`.toLowerCase();
          if (!hay.includes(q)) return false;
        }
        return true;
      });
      res.json(filtered);
    } catch (err) {
      res.status(500).json({
        error: err instanceof Error ? err.message : 'Ошибка загрузки товаров.',
      });
    }
  });

  app.post('/api/products', requireAuth, requireAdmin, async (req: AuthRequest, res) => {
    const body = req.body as Record<string, unknown>;
    const name = sanitizeText(body.name, 140);
    const sku = sanitizeText(body.sku, 32).toUpperCase();
    const category = sanitizeText(body.category, 32) as CategoryId;
    const species = sanitizeText(body.species, 32) as PetSpecies;
    const supplierId = parsePositiveInt(body.supplierId);
    const unit = sanitizeText(body.unit, 40) || 'шт';
    const description = sanitizeText(body.description, 800);
    const specs = sanitizeText(body.specs, 180);
    const rawImage = sanitizeText(body.imageUrl, 300);

    const price = Number(body.price);
    const purchasePrice = Number(body.purchasePrice ?? Math.round(price * 0.65));
    const stock = Math.floor(Number(body.stock ?? 0));
    const minStock = Math.floor(Number(body.minStock ?? 5));

    if (!name || !sku) {
      res.status(400).json({ error: 'Укажите название и артикул товара.' });
      return;
    }
    if (!VALID_CATEGORIES.has(category)) {
      res.status(400).json({ error: 'Выбрана недопустимая категория.' });
      return;
    }
    if (!VALID_SPECIES.has(species)) {
      res.status(400).json({ error: 'Укажите вид животного.' });
      return;
    }
    if (!supplierId) {
      res.status(400).json({ error: 'Выберите поставщика.' });
      return;
    }
    if (!Number.isFinite(price) || price <= 0) {
      res.status(400).json({ error: 'Цена должна быть положительным числом.' });
      return;
    }
    if (!Number.isFinite(stock) || stock < 0 || !Number.isFinite(minStock) || minStock < 0) {
      res.status(400).json({ error: 'Остаток не может быть отрицательным.' });
      return;
    }

    const imageUrl = isSafeImagePath(rawImage)
      ? rawImage
      : DEFAULT_CATEGORY_IMAGES[category];

    try {
      const created = await createProduct({
        sku,
        name,
        category,
        species,
        supplierId,
        price: Math.round(price),
        purchasePrice:
          Number.isFinite(purchasePrice) && purchasePrice >= 0
            ? Math.round(purchasePrice)
            : 0,
        stock,
        minStock,
        unit,
        description,
        specs,
        imageUrl,
      });
      res.status(201).json(created);
    } catch (err) {
      if (err instanceof Error && err.message === 'SUPPLIER_NOT_FOUND') {
        res.status(400).json({ error: 'Указанный поставщик не найден.' });
        return;
      }
      if (err instanceof Error && err.message === 'DUPLICATE_SKU') {
        res.status(409).json({ error: `Товар с артикулом ${sku} уже существует.` });
        return;
      }
      res.status(500).json({
        error: err instanceof Error ? err.message : 'Не удалось добавить товар.',
      });
    }
  });

  app.patch('/api/products/:id/stock', requireAuth, requireAdmin, async (req: AuthRequest, res) => {
    const productId = parsePositiveInt(req.params.id);
    if (!productId) {
      res.status(400).json({ error: 'Некорректный идентификатор товара.' });
      return;
    }

    const body = req.body as Record<string, unknown>;
    const delta = Math.trunc(Number(body.delta));
    const type = sanitizeText(body.type, 40) as StockMovementType;
    const supplierId = body.supplierId ? parsePositiveInt(body.supplierId) ?? undefined : undefined;
    const note = sanitizeText(body.note, 240);

    if (!Number.isFinite(delta) || delta === 0) {
      res.status(400).json({
        error: 'Количество изменения остатка должно быть ненулевым целым числом.',
      });
      return;
    }

    const allowedTypes: ReadonlySet<StockMovementType> = new Set([
      'Приход от поставщика',
      'Корректировка',
      'Списание',
    ]);
    const movementType: StockMovementType = allowedTypes.has(type)
      ? type
      : delta > 0
        ? 'Приход от поставщика'
        : 'Списание';

    try {
      const result = await adjustProductStock({
        productId,
        delta,
        type: movementType,
        supplierId,
        note,
      });
      res.json(result);
    } catch (err) {
      if (err instanceof Error && err.message === 'PRODUCT_NOT_FOUND') {
        res.status(404).json({ error: 'Товар не найден.' });
        return;
      }
      if (err instanceof Error && err.message.startsWith('INSUFFICIENT_STOCK:')) {
        const [, stockStr, unit] = err.message.split(':');
        res.status(409).json({
          error: `Нельзя списать больше, чем числится на складе (доступно ${stockStr} ${unit}).`,
        });
        return;
      }
      res.status(500).json({
        error: err instanceof Error ? err.message : 'Ошибка обновления остатка.',
      });
    }
  });

  // --- API: Suppliers (Admin Only) ---
  app.get('/api/suppliers', requireAuth, requireAdmin, async (_req: AuthRequest, res) => {
    try {
      const data = await listSuppliers();
      res.json(data);
    } catch (err) {
      res.status(500).json({
        error: err instanceof Error ? err.message : 'Ошибка загрузки поставщиков.',
      });
    }
  });

  app.post('/api/suppliers', requireAuth, requireAdmin, async (req: AuthRequest, res) => {
    const body = req.body as Record<string, unknown>;
    const name = sanitizeText(body.name, 140);
    const contactPerson = sanitizeText(body.contactPerson, 100);
    const phone = sanitizeText(body.phone, 40);
    const email = sanitizeText(body.email, 120);
    const city = sanitizeText(body.city, 80);
    const notes = sanitizeText(body.notes, 400);
    const leadTimeDays = Math.max(1, Math.min(60, Math.floor(Number(body.leadTimeDays ?? 2))));
    const rawCats = Array.isArray(body.categories) ? body.categories : [];
    const categories = rawCats
      .map((c) => sanitizeText(c, 32) as CategoryId)
      .filter((c) => VALID_CATEGORIES.has(c));

    if (!name || !contactPerson || !phone) {
      res.status(400).json({
        error: 'Заполните название компании, контактное лицо и телефон.',
      });
      return;
    }

    try {
      const created = await createSupplier({
        name,
        contactPerson,
        phone,
        email: email || 'info@supplier.ru',
        city: city || 'Москва',
        leadTimeDays: Number.isFinite(leadTimeDays) ? leadTimeDays : 2,
        categories: categories.length > 0 ? categories : ['supplies'],
        notes,
      });
      res.status(201).json(created);
    } catch (err) {
      res.status(500).json({
        error: err instanceof Error ? err.message : 'Не удалось создать поставщика.',
      });
    }
  });

  app.put('/api/suppliers/:id', requireAuth, requireAdmin, async (req: AuthRequest, res) => {
    const id = parsePositiveInt(req.params.id);
    if (!id) {
      res.status(400).json({ error: 'Некорректный идентификатор поставщика.' });
      return;
    }

    const body = req.body as Record<string, unknown>;
    const name = sanitizeText(body.name, 140);
    const contactPerson = sanitizeText(body.contactPerson, 100);
    const phone = sanitizeText(body.phone, 40);
    const email = sanitizeText(body.email, 120);
    const city = sanitizeText(body.city, 80);
    const notes = sanitizeText(body.notes, 400);
    const leadTimeDays = Math.max(1, Math.min(60, Math.floor(Number(body.leadTimeDays ?? 2))));
    const rawCats = Array.isArray(body.categories) ? body.categories : [];
    const categories = rawCats
      .map((c) => sanitizeText(c, 32) as CategoryId)
      .filter((c) => VALID_CATEGORIES.has(c));

    if (!name || !contactPerson || !phone) {
      res.status(400).json({ error: 'Название, контактное лицо и телефон обязательны.' });
      return;
    }

    try {
      const updated = await updateSupplier(id, {
        name,
        contactPerson,
        phone,
        email: email || 'info@supplier.ru',
        city: city || 'Москва',
        leadTimeDays: Number.isFinite(leadTimeDays) ? leadTimeDays : 2,
        categories: categories.length > 0 ? categories : ['supplies'],
        notes,
      });
      if (!updated) {
        res.status(404).json({ error: 'Поставщик не найден.' });
        return;
      }
      res.json(updated);
    } catch (err) {
      res.status(500).json({
        error: err instanceof Error ? err.message : 'Ошибка обновления поставщика.',
      });
    }
  });

  // --- API: Orders & Purchase History ---
  app.get('/api/orders', requireAuth, requireAdmin, async (_req: AuthRequest, res) => {
    try {
      const data = await listOrders();
      res.json(data);
    } catch (err) {
      res.status(500).json({
        error: err instanceof Error ? err.message : 'Ошибка загрузки истории покупок.',
      });
    }
  });

  app.post('/api/orders', requireAuth, async (req: AuthRequest, res) => {
    const body = req.body as Record<string, unknown>;
    const customerName = sanitizeText(body.customerName, 120);
    const customerPhone = sanitizeText(body.customerPhone, 40);
    const deliveryAddress = sanitizeText(body.deliveryAddress, 240);
    const paymentMethod = sanitizeText(body.paymentMethod, 60) as PaymentMethod;
    const rawItems = Array.isArray(body.items) ? body.items : [];

    if (!customerName || !customerPhone || !deliveryAddress) {
      res.status(400).json({ error: 'Укажите имя, телефон и адрес доставки.' });
      return;
    }
    if (!VALID_PAYMENT_METHODS.has(paymentMethod)) {
      res.status(400).json({ error: 'Выберите корректный способ оплаты.' });
      return;
    }
    if (rawItems.length === 0) {
      res.status(400).json({ error: 'Корзина пуста.' });
      return;
    }

    const requestedMap = new Map<number, number>();
    for (const raw of rawItems) {
      if (!raw || typeof raw !== 'object') continue;
      const r = raw as Record<string, unknown>;
      const productId = parsePositiveInt(r.productId);
      const qty = Math.floor(Number(r.quantity));
      if (!productId || !Number.isFinite(qty) || qty <= 0) {
        res.status(400).json({ error: 'Некорректное количество товара в заказе.' });
        return;
      }
      requestedMap.set(productId, (requestedMap.get(productId) ?? 0) + qty);
    }

    if (requestedMap.size === 0) {
      res.status(400).json({ error: 'Корзина пуста.' });
      return;
    }

    const items = Array.from(requestedMap.entries()).map(([productId, quantity]) => ({
      productId,
      quantity,
    }));

    try {
      const order = await createOrder({
        userUid: req.account!.uid,
        customerName,
        customerPhone,
        deliveryAddress,
        paymentMethod,
        items,
      });

      const isAdmin = req.account!.role === 'admin';
      const updatedProducts = await listProducts(isAdmin);
      const updatedMovements = isAdmin ? await listStockMovements() : [];

      res.status(201).json({
        order,
        products: updatedProducts,
        stockMovements: updatedMovements,
      });
    } catch (err) {
      if (err instanceof Error && err.message.startsWith('PRODUCT_NOT_FOUND:')) {
        res.status(404).json({ error: 'Один из товаров не найден в каталоге.' });
        return;
      }
      if (err instanceof Error && err.message.startsWith('INSUFFICIENT_STOCK:')) {
        const [, prodName, avail, unit, reqQty] = err.message.split(':');
        res.status(409).json({
          error: `Недостаточно товара «${prodName}»: доступно ${avail} ${unit}, запрошено ${reqQty}.`,
        });
        return;
      }
      res.status(500).json({
        error: err instanceof Error ? err.message : 'Не удалось оформить заказ.',
      });
    }
  });

  app.patch('/api/orders/:id/status', requireAuth, requireAdmin, async (req: AuthRequest, res) => {
    const orderId = parsePositiveInt(req.params.id);
    if (!orderId) {
      res.status(400).json({ error: 'Некорректный номер заказа.' });
      return;
    }

    const body = req.body as Record<string, unknown>;
    const nextStatus = sanitizeText(body.status, 40) as OrderStatus;
    if (!VALID_ORDER_STATUSES.has(nextStatus)) {
      res.status(400).json({ error: 'Недопустимый статус заказа.' });
      return;
    }

    try {
      const order = await updateOrderStatus(orderId, nextStatus);
      if (!order) {
        res.status(404).json({ error: 'Заказ не найден.' });
        return;
      }
      const [updatedProducts, updatedMovements] = await Promise.all([
        listProducts(true),
        listStockMovements(),
      ]);
      res.json({
        order,
        products: updatedProducts,
        stockMovements: updatedMovements,
      });
    } catch (err) {
      if (err instanceof Error && err.message.startsWith('INSUFFICIENT_RESUME:')) {
        const [, prodName] = err.message.split(':');
        res.status(409).json({
          error: `Невозможно возобновить заказ: недостаточно остатка для «${prodName}».`,
        });
        return;
      }
      res.status(500).json({
        error: err instanceof Error ? err.message : 'Не удалось изменить статус заказа.',
      });
    }
  });

  // --- API: Stock Movements (Admin Only) ---
  app.get('/api/stock-movements', requireAuth, requireAdmin, async (_req: AuthRequest, res) => {
    try {
      const data = await listStockMovements();
      res.json(data);
    } catch (err) {
      res.status(500).json({
        error: err instanceof Error ? err.message : 'Ошибка загрузки журнала движения.',
      });
    }
  });

  // --- Vite Middleware (Dev) or Static Assets (Prod) ---
  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(process.cwd(), 'dist');
    app.use(express.static(distDir));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distDir, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server listening on http://localhost:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
