import 'dotenv/config';
import express from 'express';
import path from 'node:path';
import { hashPassword, issueSessionToken, verifyPassword } from './lib/auth.js';
import { optionalAuth, requireAdmin, requireAuth } from './middleware/auth.js';
import {
  adjustProductStock,
  authenticateUser,
  createOrder,
  createProduct,
  createSupplier,
  deleteProduct,
  deleteSupplier,
  hasAdminUser,
  listAllUsers,
  listOrders,
  listOrdersByUser,
  listProducts,
  listStockMovements,
  listSuppliers,
  registerUser,
  updateOrderStatus,
  updateProduct,
  updateSupplier,
  updateUserRole,
} from './lib/db.js';

const PORT =
  Number.isInteger(Number(process.env.PORT)) && Number(process.env.PORT) > 0
    ? Number(process.env.PORT)
    : 3000;

const VALID_CATEGORIES = new Set([
  'animals',
  'supplies',
  'food',
  'care',
  'treats',
  'medicine',
]);
const VALID_SPECIES = new Set(['Кошки', 'Собаки', 'Птицы', 'Грызуны', 'Рыбки']);
const VALID_ORDER_STATUSES = new Set([
  'В обработке',
  'Выполнен',
  'Доставлен',
  'Отменён',
]);
const VALID_PAYMENT_METHODS = new Set([
  'Картой при получении',
  'Наличными курьеру',
  'Онлайн-оплата',
]);
const VALID_ROLES = new Set(['admin', 'customer']);

const DEFAULT_CATEGORY_IMAGES = {
  animals: '/images/cat_animals_companion_1795537999424.jpg',
  supplies: '/images/cat_pet_accessories_1795537998453.jpg',
  food: '/images/cat_food_premium_1795537996961.jpg',
  care: '/images/cat_care_grooming_1795537998190.jpg',
  treats: '/images/cat_treats_snacks_1795537998259.jpg',
  medicine: '/images/cat_medicine_vet_1795537998705.jpg',
};

function sanitizeText(value, maxLen = 400) {
  if (typeof value !== 'string') return '';
  return value.trim().slice(0, maxLen);
}

function isSafeImagePath(url) {
  return url.startsWith('/images/') || url.startsWith('https://');
}

function parsePositiveInt(value) {
  const num = Number(value);
  if (!Number.isInteger(num) || num <= 0) return null;
  return num;
}

const app = express();
app.disable('x-powered-by');
app.use((_req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  next();
});
app.use(express.json({ limit: '1mb' }));

// Static frontend assets (pure HTML, CSS, JS, images)
app.use(express.static(path.resolve(process.cwd(), 'public')));

// --- API: Health & Local Authentication ---
app.get('/api/health', (_req, res) => {
  res.json({
    ok: true,
    service: 'lapa-i-dom',
    storage: 'sqlite',
    timestamp: new Date().toISOString(),
  });
});

function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

app.post('/api/auth/register', async (req, res) => {
  const email = sanitizeText(req.body?.email, 120).toLowerCase();
  const displayName = sanitizeText(req.body?.displayName, 80);
  const password = typeof req.body?.password === 'string' ? req.body.password : '';

  if (!displayName || displayName.length < 2) {
    res.status(400).json({ error: 'Укажите имя (не короче 2 символов).' });
    return;
  }
  if (!email || !isValidEmail(email)) {
    res.status(400).json({ error: 'Укажите корректный email.' });
    return;
  }
  if (password.length < 6 || password.length > 128) {
    res.status(400).json({ error: 'Пароль должен содержать от 6 до 128 символов.' });
    return;
  }

  try {
    const passwordHash = hashPassword(password);
    const account = await registerUser({ email, displayName, passwordHash });
    const token = issueSessionToken(account);
    res.status(201).json({ token, account });
  } catch (err) {
    if (err instanceof Error && err.message === 'EMAIL_EXISTS') {
      res.status(409).json({ error: 'Пользователь с таким email уже зарегистрирован.' });
      return;
    }
    res.status(500).json({
      error: err instanceof Error ? err.message : 'Не удалось зарегистрировать аккаунт.',
    });
  }
});

app.post('/api/auth/login', async (req, res) => {
  const email = sanitizeText(req.body?.email, 120).toLowerCase();
  const password = typeof req.body?.password === 'string' ? req.body.password : '';

  if (!email || !password) {
    res.status(400).json({ error: 'Введите email и пароль.' });
    return;
  }

  try {
    const record = await authenticateUser(email);
    if (!record || !verifyPassword(password, record.passwordHash)) {
      res.status(401).json({ error: 'Неверный email или пароль.' });
      return;
    }
    const token = issueSessionToken(record.user);
    res.json({ token, account: record.user });
  } catch (err) {
    res.status(500).json({
      error: err instanceof Error ? err.message : 'Не удалось выполнить вход.',
    });
  }
});

app.get('/api/auth/me', requireAuth, (req, res) => {
  res.json({ account: req.account });
});

app.get('/api/users', requireAuth, requireAdmin, async (_req, res) => {
  try {
    const users = await listAllUsers();
    res.json(users);
  } catch (err) {
    res.status(500).json({
      error: err instanceof Error ? err.message : 'Ошибка загрузки пользователей.',
    });
  }
});

app.patch('/api/users/:id/role', requireAuth, requireAdmin, async (req, res) => {
  const userId = parsePositiveInt(req.params.id);
  const role = sanitizeText(req.body?.role, 20);

  if (!userId) {
    res.status(400).json({ error: 'Некорректный идентификатор пользователя.' });
    return;
  }
  if (!VALID_ROLES.has(role)) {
    res.status(400).json({ error: 'Недопустимая роль пользователя.' });
    return;
  }

  try {
    const updated = await updateUserRole(userId, role, req.account.uid);
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
app.get('/api/store', optionalAuth, async (req, res) => {
  try {
    const isAdmin = req.account?.role === 'admin';
    const [catalogProducts, adminExists] = await Promise.all([
      listProducts(isAdmin),
      hasAdminUser(),
    ]);

    if (isAdmin) {
      const [allSuppliers, allOrders, myOrders, allMovements, allUsers] = await Promise.all([
        listSuppliers(),
        listOrders(),
        listOrdersByUser(req.account.uid),
        listStockMovements(),
        listAllUsers(),
      ]);
      res.json({
        account: req.account,
        needsAdminSetup: !adminExists,
        products: catalogProducts,
        suppliers: allSuppliers,
        orders: allOrders,
        myOrders,
        stockMovements: allMovements,
        users: allUsers,
      });
      return;
    }

    const myOrders = req.account ? await listOrdersByUser(req.account.uid) : [];
    res.json({
      account: req.account ?? null,
      needsAdminSetup: !adminExists,
      products: catalogProducts,
      suppliers: [],
      orders: [],
      myOrders,
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
app.get('/api/products', optionalAuth, async (req, res) => {
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

app.post('/api/products', requireAuth, requireAdmin, async (req, res) => {
  const body = req.body || {};
  const name = sanitizeText(body.name, 140);
  const sku = sanitizeText(body.sku, 32).toUpperCase();
  const category = sanitizeText(body.category, 32);
  const species = sanitizeText(body.species, 32);
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

app.put('/api/products/:id', requireAuth, requireAdmin, async (req, res) => {
  const productId = parsePositiveInt(req.params.id);
  if (!productId) {
    res.status(400).json({ error: 'Некорректный идентификатор товара.' });
    return;
  }

  const body = req.body || {};
  const name = sanitizeText(body.name, 140);
  const sku = sanitizeText(body.sku, 32).toUpperCase();
  const category = sanitizeText(body.category, 32);
  const species = sanitizeText(body.species, 32);
  const supplierId = parsePositiveInt(body.supplierId);
  const unit = sanitizeText(body.unit, 40) || 'шт';
  const description = sanitizeText(body.description, 800);
  const specs = sanitizeText(body.specs, 180);
  const rawImage = sanitizeText(body.imageUrl, 300);

  const price = Number(body.price);
  const purchasePrice = Number(body.purchasePrice ?? Math.round(price * 0.65));
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
  if (!Number.isFinite(minStock) || minStock < 0) {
    res.status(400).json({ error: 'Минимальный порог не может быть отрицательным.' });
    return;
  }

  const imageUrl = isSafeImagePath(rawImage)
    ? rawImage
    : DEFAULT_CATEGORY_IMAGES[category];

  try {
    const updated = await updateProduct(productId, {
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
      minStock,
      unit,
      description,
      specs,
      imageUrl,
    });
    if (!updated) {
      res.status(404).json({ error: 'Товар не найден.' });
      return;
    }
    res.json(updated);
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
      error: err instanceof Error ? err.message : 'Не удалось обновить товар.',
    });
  }
});

app.delete('/api/products/:id', requireAuth, requireAdmin, async (req, res) => {
  const productId = parsePositiveInt(req.params.id);
  if (!productId) {
    res.status(400).json({ error: 'Некорректный идентификатор товара.' });
    return;
  }

  try {
    const removed = await deleteProduct(productId);
    if (!removed) {
      res.status(404).json({ error: 'Товар не найден.' });
      return;
    }
    res.json({ deleted: true, id: productId });
  } catch (err) {
    if (err instanceof Error && err.message === 'PRODUCT_IN_ORDERS') {
      res.status(409).json({
        error: 'Нельзя удалить товар, который уже фигурирует в оформленных заказах. Спишите остаток до 0.',
      });
      return;
    }
    res.status(500).json({
      error: err instanceof Error ? err.message : 'Не удалось удалить товар.',
    });
  }
});

app.patch('/api/products/:id/stock', requireAuth, requireAdmin, async (req, res) => {
  const productId = parsePositiveInt(req.params.id);
  if (!productId) {
    res.status(400).json({ error: 'Некорректный идентификатор товара.' });
    return;
  }

  const body = req.body || {};
  const delta = Math.trunc(Number(body.delta));
  const type = sanitizeText(body.type, 40);
  const supplierId = body.supplierId ? parsePositiveInt(body.supplierId) ?? undefined : undefined;
  const note = sanitizeText(body.note, 240);

  if (!Number.isFinite(delta) || delta === 0) {
    res.status(400).json({
      error: 'Количество изменения остатка должно быть ненулевым целым числом.',
    });
    return;
  }

  const allowedTypes = new Set([
    'Приход от поставщика',
    'Корректировка',
    'Списание',
  ]);
  const movementType = allowedTypes.has(type)
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
app.get('/api/suppliers', requireAuth, requireAdmin, async (_req, res) => {
  try {
    const data = await listSuppliers();
    res.json(data);
  } catch (err) {
    res.status(500).json({
      error: err instanceof Error ? err.message : 'Ошибка загрузки поставщиков.',
    });
  }
});

app.post('/api/suppliers', requireAuth, requireAdmin, async (req, res) => {
  const body = req.body || {};
  const name = sanitizeText(body.name, 140);
  const contactPerson = sanitizeText(body.contactPerson, 100);
  const phone = sanitizeText(body.phone, 40);
  const email = sanitizeText(body.email, 120);
  const city = sanitizeText(body.city, 80);
  const notes = sanitizeText(body.notes, 400);
  const leadTimeDays = Math.max(1, Math.min(60, Math.floor(Number(body.leadTimeDays ?? 2))));
  const rawCats = Array.isArray(body.categories) ? body.categories : [];
  const categories = rawCats
    .map((c) => sanitizeText(c, 32))
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

app.put('/api/suppliers/:id', requireAuth, requireAdmin, async (req, res) => {
  const id = parsePositiveInt(req.params.id);
  if (!id) {
    res.status(400).json({ error: 'Некорректный идентификатор поставщика.' });
    return;
  }

  const body = req.body || {};
  const name = sanitizeText(body.name, 140);
  const contactPerson = sanitizeText(body.contactPerson, 100);
  const phone = sanitizeText(body.phone, 40);
  const email = sanitizeText(body.email, 120);
  const city = sanitizeText(body.city, 80);
  const notes = sanitizeText(body.notes, 400);
  const leadTimeDays = Math.max(1, Math.min(60, Math.floor(Number(body.leadTimeDays ?? 2))));
  const rawCats = Array.isArray(body.categories) ? body.categories : [];
  const categories = rawCats
    .map((c) => sanitizeText(c, 32))
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

app.delete('/api/suppliers/:id', requireAuth, requireAdmin, async (req, res) => {
  const id = parsePositiveInt(req.params.id);
  if (!id) {
    res.status(400).json({ error: 'Некорректный идентификатор поставщика.' });
    return;
  }

  try {
    const removed = await deleteSupplier(id);
    if (!removed) {
      res.status(404).json({ error: 'Поставщик не найден.' });
      return;
    }
    res.json({ deleted: true, id });
  } catch (err) {
    if (err instanceof Error && err.message === 'SUPPLIER_IN_USE') {
      res.status(409).json({
        error: 'Нельзя удалить поставщика, к которому привязаны товары в каталоге.',
      });
      return;
    }
    res.status(500).json({
      error: err instanceof Error ? err.message : 'Ошибка удаления поставщика.',
    });
  }
});

// --- API: Orders & Purchase History ---
app.get('/api/orders/my', requireAuth, async (req, res) => {
  try {
    const data = await listOrdersByUser(req.account.uid);
    res.json(data);
  } catch (err) {
    res.status(500).json({
      error: err instanceof Error ? err.message : 'Ошибка загрузки ваших заказов.',
    });
  }
});

app.get('/api/orders', requireAuth, requireAdmin, async (_req, res) => {
  try {
    const data = await listOrders();
    res.json(data);
  } catch (err) {
    res.status(500).json({
      error: err instanceof Error ? err.message : 'Ошибка загрузки истории покупок.',
    });
  }
});

app.post('/api/orders', requireAuth, async (req, res) => {
  const body = req.body || {};
  const customerName = sanitizeText(body.customerName, 120);
  const customerPhone = sanitizeText(body.customerPhone, 40);
  const deliveryAddress = sanitizeText(body.deliveryAddress, 240);
  const paymentMethod = sanitizeText(body.paymentMethod, 60);
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

  const requestedMap = new Map();
  for (const raw of rawItems) {
    if (!raw || typeof raw !== 'object') continue;
    const productId = parsePositiveInt(raw.productId);
    const qty = Math.floor(Number(raw.quantity));
    if (!productId || !Number.isFinite(qty) || qty <= 0) {
      res.status(400).json({ error: 'Некорректное количество товара в заказе.' });
      return;
    }
    requestedMap.set(productId, (requestedMap.get(productId) || 0) + qty);
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
      userUid: req.account.uid,
      customerName,
      customerPhone,
      deliveryAddress,
      paymentMethod,
      items,
    });

    const isAdmin = req.account.role === 'admin';
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

app.patch('/api/orders/:id/status', requireAuth, requireAdmin, async (req, res) => {
  const orderId = parsePositiveInt(req.params.id);
  if (!orderId) {
    res.status(400).json({ error: 'Некорректный номер заказа.' });
    return;
  }

  const nextStatus = sanitizeText(req.body?.status, 40);
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
app.get('/api/stock-movements', requireAuth, requireAdmin, async (_req, res) => {
  try {
    const data = await listStockMovements();
    res.json(data);
  } catch (err) {
    res.status(500).json({
      error: err instanceof Error ? err.message : 'Ошибка загрузки журнала движения.',
    });
  }
});

// 404 for unknown API routes
app.use('/api', (_req, res) => {
  res.status(404).json({ error: 'API-маршрут не найден.' });
});

// Fallback to index.html for SPA routes
app.get('*', (_req, res) => {
  res.sendFile(path.resolve(process.cwd(), 'public/index.html'));
});

// JSON parse and fallback error middleware
app.use((err, _req, res, _next) => {
  if (err && err.type === 'entity.parse.failed') {
    res.status(400).json({ error: 'Некорректный формат JSON в теле запроса.' });
    return;
  }
  console.error('Unhandled server error:', err);
  res.status(500).json({ error: 'Внутренняя ошибка сервера.' });
});

const server = app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server listening on http://localhost:${PORT}`);
});

server.on('error', (err) => {
  if (err && err.code === 'EADDRINUSE') {
    console.error(`Порт ${PORT} уже занят. Укажите другой порт: start.bat --port ${PORT + 1}`);
  } else {
    console.error('Ошибка запуска HTTP-сервера:', err instanceof Error ? err.message : String(err));
  }
  process.exit(1);
});
