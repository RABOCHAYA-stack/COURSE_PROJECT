import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import initSqlJs from 'sql.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '..');

function resolveDbPath() {
  const configured = process.env.SQLITE_DB_PATH?.trim();
  const target = configured
    ? path.resolve(ROOT_DIR, configured)
    : path.join(ROOT_DIR, 'data', 'petshop.sqlite');
  const rel = path.relative(ROOT_DIR, target);
  if (rel.startsWith('..') || path.isAbsolute(rel)) {
    throw new Error('SQLITE_DB_PATH должен указывать на файл внутри каталога проекта.');
  }
  return target;
}

const DB_PATH = resolveDbPath();

let dbPromise = null;
let seedPromise = null;
let writeChain = Promise.resolve();

function withWriteLock(fn) {
  const next = writeChain.then(fn, fn);
  writeChain = next.catch(() => {});
  return next;
}

function persistDatabase(db) {
  const dir = path.dirname(DB_PATH);
  fs.mkdirSync(dir, { recursive: true });
  const tempPath = `${DB_PATH}.tmp.${process.pid}`;
  const data = Buffer.from(db.export());
  fs.writeFileSync(tempPath, data);
  fs.renameSync(tempPath, DB_PATH);
}

function queryAll(db, sql, params = []) {
  const stmt = db.prepare(sql);
  try {
    stmt.bind(params);
    const rows = [];
    while (stmt.step()) {
      rows.push(stmt.getAsObject());
    }
    return rows;
  } finally {
    stmt.free();
  }
}

function queryOne(db, sql, params = []) {
  const rows = queryAll(db, sql, params);
  return rows.length > 0 ? rows[0] : null;
}

function runStmt(db, sql, params = []) {
  const stmt = db.prepare(sql);
  try {
    stmt.run(params);
  } finally {
    stmt.free();
  }
  return queryOne(db, 'SELECT last_insert_rowid() AS id, changes() AS changes');
}

function runTransaction(db, work) {
  db.run('BEGIN TRANSACTION');
  try {
    const result = work();
    db.run('COMMIT');
    persistDatabase(db);
    return result;
  } catch (err) {
    try {
      db.run('ROLLBACK');
    } catch {
      // Ignore rollback error if transaction already closed
    }
    throw err;
  }
}

async function getDb() {
  if (!dbPromise) {
    dbPromise = (async () => {
      const SQL = await initSqlJs({
        locateFile: (file) => path.join(ROOT_DIR, 'node_modules', 'sql.js', 'dist', file),
      });

      let db;
      if (fs.existsSync(DB_PATH)) {
        const fileBuf = fs.readFileSync(DB_PATH);
        db = new SQL.Database(fileBuf);
      } else {
        db = new SQL.Database();
      }

      db.run('PRAGMA foreign_keys = ON;');
      const schemaSql = fs.readFileSync(path.join(ROOT_DIR, 'sql', 'schema.sql'), 'utf8');
      db.exec(schemaSql);

      if (!fs.existsSync(DB_PATH)) {
        persistDatabase(db);
      }
      return db;
    })().catch((err) => {
      dbPromise = null;
      throw err;
    });
  }
  return dbPromise;
}

export async function ensureSeeded() {
  if (!seedPromise) {
    seedPromise = withWriteLock(async () => {
      const db = await getDb();
      const existing = queryOne(db, 'SELECT id FROM suppliers LIMIT 1');
      if (existing) return;

      runTransaction(db, () => {
        const check = queryOne(db, 'SELECT id FROM suppliers LIMIT 1');
        if (check) return;

        const seedSql = fs.readFileSync(path.join(ROOT_DIR, 'sql', 'seed.sql'), 'utf8');
        db.exec(seedSql);

        const supRows = queryAll(db, 'SELECT id, name FROM suppliers ORDER BY id ASC');
        const supMap = new Map(supRows.map((s) => [s.id, s]));
        const sup1 = supMap.get(1) || supRows[0];
        const sup2 = supMap.get(2) || supRows[0];
        const sup3 = supMap.get(3) || supRows[0];
        const sup4 = supMap.get(4) || supRows[0];

        const prodRows = [
          ['FD-1001', 'Холистик корм «Северный Луг» индейка и батат', 'food', 'Собаки', sup1.id, 3490, 2250, 24, 8, 'уп. 2.5 кг', 'Беззерновой полнорационный сухой корм для взрослых собак всех пород. Содержит 68% дегидрированного мяса индейки, батат, пребиотики и масло лосося.', 'Беззерновой · Индейка 68% · 2.5 кг', '/images/cat_food_premium_1795537996961.jpg'],
          ['FD-1002', 'Сухой корм «Фьорд Кэт» для стерилизованных кошек', 'food', 'Кошки', sup1.id, 2890, 1840, 6, 10, 'уп. 2 кг', 'Формула с форелью и клюквой для профилактики мочекаменной болезни и поддержания оптимального веса у домашних кошек.', 'Форель и клюква · Контроль pH · 2 кг', '/images/cat_food_premium_1795537996961.jpg'],
          ['TR-2001', 'Сублимированные кубики говядины и печёное печенье', 'treats', 'Собаки', sup1.id, 780, 440, 32, 12, 'банка 180 г', 'Натуральное лакомство бережной сублимационной сушки без соли, красителей и консервантов. Идеально для дрессировки и поощрения.', '100% мясо · Сублимация · 180 г', '/images/cat_treats_snacks_1795537998259.jpg'],
          ['TR-2002', 'Хрустящие подушечки с уткой и кошачьей мятой', 'treats', 'Кошки', sup1.id, 420, 230, 19, 10, 'уп. 90 г', 'Подушечки с нежным паштетом из утки и экстрактом кошачьей мяты способствуют выведению шерсти и очищению зубов.', 'Утка + таурин · Выведение шерсти · 90 г', '/images/cat_treats_snacks_1795537998259.jpg'],
          ['CR-3001', 'Ботанический шампунь с ромашкой и овсяным молочком', 'care', 'Собаки', sup2.id, 1290, 790, 15, 6, 'фл. 250 мл', 'Мягкий бессульфатный шампунь с нейтральным pH для чувствительной кожи. Успокаивает раздражения и облегчает расчёсывание.', 'Без SLS · pH 6.8 · 250 мл', '/images/cat_care_grooming_1795537998190.jpg'],
          ['CR-3002', 'Буковая щётка для деликатного вычёсывания подшёрстка', 'care', 'Кошки', sup3.id, 1450, 860, 4, 6, 'шт', 'Эргономичная щётка из массива бука с натуральной щетиной кабана равномерно распределяет кожные липиды и придаёт шерсти блеск.', 'Массив бука · Натуральная щетина · 19 см', '/images/cat_care_grooming_1795537998190.jpg'],
          ['MD-4001', 'Витаминно-минеральный комплекс «ВетВелл» в каплях', 'medicine', 'Собаки', sup2.id, 1680, 1090, 14, 5, 'фл. 30 мл', 'Концентрированный комплекс витаминов A, D3, E, группы B и хелатных минералов для укрепления иммунитета, суставов и связок.', 'Капли 30 мл · Иммунитет и суставы · СГР', '/images/cat_medicine_vet_1795537998705.jpg'],
          ['MD-4002', 'Пробиотик для микрофлоры ЖКТ «ПауБиотикс»', 'medicine', 'Кошки', sup2.id, 1950, 1280, 9, 5, 'банка 60 г', 'Мультиштаммовый синбиотик в порошке для быстрого восстановления пищеварения после антибиотиков и при смене рациона.', '6 штаммов · 60 г · Мерная ложка в комплекте', '/images/cat_medicine_vet_1795537998705.jpg'],
          ['SP-5001', 'Льняная лежанка на дубовом основании «Сканди»', 'supplies', 'Собаки', sup3.id, 6800, 4300, 5, 3, 'шт', 'Ортопедическая лежанка со съёмным чехлом из плотного небелёного льна и бортиками с гипоаллергенным наполнителем.', '75 × 55 см · Дуб и лён · Съёмный чехол', '/images/cat_pet_accessories_1795537998453.jpg'],
          ['SP-5002', 'Ошейник из мягкой телячьей кожи с латунной пряжкой', 'supplies', 'Собаки', sup3.id, 2350, 1420, 11, 4, 'шт', 'Прочный ошейник ручной прошивки с литой латунной фурнитурой, не натирает шею и устойчив к влаге.', 'Размер M (35–45 см) · Натуральная кожа', '/images/cat_pet_accessories_1795537998453.jpg'],
          ['AN-6001', 'Карликовый вислоухий кролик «Минор» (кремовый)', 'animals', 'Грызуны', sup4.id, 5900, 3400, 3, 2, 'особь', 'Ручной декоративный кролик из сертифицированного питомника. Приучен к лотку и поилке, в комплекте ветеринарный паспорт.', 'Возраст 2.5 мес · Ветпаспорт · Привит', '/images/cat_animals_companion_1795537999424.jpg'],
          ['AN-6002', 'Волнистый попугай (небесно-голубой окрас)', 'animals', 'Птицы', sup4.id, 2600, 1350, 7, 3, 'особь', 'Молодой активный попугай домашнего разведения, прошёл карантин и осмотр орнитолога.', 'Возраст 3 мес · Осмотр орнитолога · Окольцован', '/images/cat_animals_companion_1795537999424.jpg'],
        ];

        const insertedProducts = [];
        for (const row of prodRows) {
          const meta = runStmt(
            db,
            `INSERT INTO products (sku, name, category, species, supplier_id, price, purchase_price, stock, min_stock, unit, description, specs, image_url)
             VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`,
            row,
          );
          insertedProducts.push(
            queryOne(db, 'SELECT id, sku, name, category, price, stock FROM products WHERE id = ?', [
              meta.id,
            ]),
          );
        }

        const [p1, p2, p3, , , , , p8, p9] = insertedProducts;

        const ord1Meta = runStmt(
          db,
          `INSERT INTO orders (order_number, user_uid, customer_name, customer_phone, delivery_address, payment_method, status, total_amount)
           VALUES (?,?,?,?,?,?,?,?)`,
          [
            'ЗМ-1041',
            'seed-customer-demo',
            'Марина Кузнецова',
            '+7 (916) 442-19-08',
            'г. Москва, ул. Покровка, д. 28, кв. 14',
            'Онлайн-оплата',
            'Доставлен',
            5050,
          ],
        );

        const ord2Meta = runStmt(
          db,
          `INSERT INTO orders (order_number, user_uid, customer_name, customer_phone, delivery_address, payment_method, status, total_amount)
           VALUES (?,?,?,?,?,?,?,?)`,
          [
            'ЗМ-1042',
            'seed-customer-demo',
            'Артём Соловьёв',
            '+7 (903) 781-55-20',
            'г. Москва, Ленинградский пр-т, д. 62, кв. 89',
            'Картой при получении',
            'Выполнен',
            4840,
          ],
        );

        const itemSql = `INSERT INTO order_items (order_id, product_id, sku, product_name, category, quantity, unit_price, subtotal)
                         VALUES (?,?,?,?,?,?,?,?)`;
        runStmt(db, itemSql, [ord1Meta.id, p1.id, p1.sku, p1.name, p1.category, 1, p1.price, p1.price]);
        runStmt(db, itemSql, [ord1Meta.id, p3.id, p3.sku, p3.name, p3.category, 2, p3.price, p3.price * 2]);
        runStmt(db, itemSql, [ord2Meta.id, p2.id, p2.sku, p2.name, p2.category, 1, p2.price, p2.price]);
        runStmt(db, itemSql, [ord2Meta.id, p8.id, p8.sku, p8.name, p8.category, 1, p8.price, p8.price]);

        const movSql = `INSERT INTO stock_movements (product_id, product_name, sku, type, delta, balance_after, supplier_id, supplier_name, note)
                        VALUES (?,?,?,?,?,?,?,?,?)`;
        runStmt(db, movSql, [p1.id, p1.name, p1.sku, 'Приход от поставщика', 25, 25, sup1.id, sup1.name, 'Плановая поставка по накладной №412']);
        runStmt(db, movSql, [p1.id, p1.name, p1.sku, 'Продажа', -1, 24, null, null, 'Заказ ЗМ-1041 (Марина Кузнецова)']);
        runStmt(db, movSql, [p2.id, p2.name, p2.sku, 'Продажа', -1, 6, null, null, 'Заказ ЗМ-1042 (Артём Соловьёв)']);
        runStmt(db, movSql, [p9.id, p9.name, p9.sku, 'Приход от поставщика', 5, 5, sup3.id, sup3.name, 'Первичная приёмка коллекции «Сканди»']);
      });
    }).catch((err) => {
      seedPromise = null;
      throw err;
    });
  }
  await seedPromise;
}

function toIsoTimestamp(val) {
  if (!val) return new Date().toISOString();
  const s = String(val).trim();
  if (/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(s)) {
    return `${s.replace(' ', 'T')}Z`;
  }
  return s;
}

function parseCategories(raw) {
  if (Array.isArray(raw)) return raw;
  if (typeof raw === 'string') {
    try {
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }
  return [];
}

function mapUserRow(row) {
  return {
    id: Number(row.id),
    uid: row.uid,
    email: row.email,
    displayName: row.display_name,
    role: row.role,
    createdAt: toIsoTimestamp(row.created_at),
  };
}

function mapSupplierRow(row) {
  return {
    id: Number(row.id),
    name: row.name,
    contactPerson: row.contact_person,
    phone: row.phone,
    email: row.email,
    city: row.city,
    leadTimeDays: Number(row.lead_time_days),
    categories: parseCategories(row.categories),
    notes: row.notes,
    createdAt: toIsoTimestamp(row.created_at),
  };
}

function mapProductRow(row, includeWholesale = true) {
  return {
    id: Number(row.id),
    sku: row.sku,
    name: row.name,
    category: row.category,
    species: row.species,
    supplierId: Number(row.supplier_id),
    supplierName: row.supplier_name || undefined,
    price: Number(row.price),
    purchasePrice: includeWholesale ? Number(row.purchase_price) : 0,
    stock: Number(row.stock),
    minStock: Number(row.min_stock),
    unit: row.unit,
    description: row.description,
    specs: row.specs,
    imageUrl: row.image_url,
    updatedAt: toIsoTimestamp(row.updated_at),
  };
}

function mapMovementRow(row) {
  return {
    id: Number(row.id),
    productId: Number(row.product_id),
    productName: row.product_name,
    sku: row.sku,
    type: row.type,
    delta: Number(row.delta),
    balanceAfter: Number(row.balance_after),
    supplierId: row.supplier_id !== null && row.supplier_id !== undefined ? Number(row.supplier_id) : null,
    supplierName: row.supplier_name ?? null,
    note: row.note,
    createdAt: toIsoTimestamp(row.created_at),
  };
}

export async function hasAdminUser() {
  await ensureSeeded();
  const db = await getDb();
  const row = queryOne(db, "SELECT id FROM users WHERE role = 'admin' LIMIT 1");
  return Boolean(row);
}

export async function getUserByUid(uid) {
  await ensureSeeded();
  const db = await getDb();
  const row = queryOne(
    db,
    'SELECT id, uid, email, display_name, role, created_at FROM users WHERE uid = ? LIMIT 1',
    [uid],
  );
  return row ? mapUserRow(row) : null;
}

export async function registerUser({ email, displayName, passwordHash }) {
  await ensureSeeded();
  return withWriteLock(async () => {
    const db = await getDb();
    const normalizedEmail = email.trim().toLowerCase();
    return runTransaction(db, () => {
      const existing = queryOne(
        db,
        'SELECT id FROM users WHERE LOWER(email) = LOWER(?) LIMIT 1',
        [normalizedEmail],
      );
      if (existing) {
        throw new Error('EMAIL_EXISTS');
      }

      const adminRow = queryOne(db, "SELECT COUNT(*) AS cnt FROM users WHERE role = 'admin'");
      const initialRole = Number(adminRow?.cnt || 0) === 0 ? 'admin' : 'customer';
      const uid = `usr_${crypto.randomUUID()}`;

      const meta = runStmt(
        db,
        `INSERT INTO users (uid, email, display_name, password_hash, role)
         VALUES (?,?,?,?,?)`,
        [uid, normalizedEmail, displayName, passwordHash, initialRole],
      );

      const created = queryOne(
        db,
        'SELECT id, uid, email, display_name, role, created_at FROM users WHERE id = ?',
        [meta.id],
      );
      return mapUserRow(created);
    });
  });
}

export async function authenticateUser(email) {
  await ensureSeeded();
  const db = await getDb();
  const normalizedEmail = email.trim().toLowerCase();
  const row = queryOne(
    db,
    'SELECT id, uid, email, display_name, password_hash, role, created_at FROM users WHERE LOWER(email) = LOWER(?) LIMIT 1',
    [normalizedEmail],
  );
  if (!row) return null;
  return {
    user: mapUserRow(row),
    passwordHash: row.password_hash,
  };
}

export async function listAllUsers() {
  try {
    await ensureSeeded();
    const db = await getDb();
    const rows = queryAll(
      db,
      'SELECT id, uid, email, display_name, role, created_at FROM users ORDER BY created_at DESC, id DESC',
    );
    return rows.map(mapUserRow);
  } catch (error) {
    console.error('Database query failed in listAllUsers:', error);
    throw new Error('Не удалось получить список пользователей.', { cause: error });
  }
}

export async function updateUserRole(userId, role, actingUid) {
  await ensureSeeded();
  return withWriteLock(async () => {
    try {
      const db = await getDb();
      return runTransaction(db, () => {
        const existing = queryOne(db, 'SELECT id, uid FROM users WHERE id = ? LIMIT 1', [userId]);
        if (!existing) return null;
        if (existing.uid === actingUid && role !== 'admin') {
          throw new Error('SELF_DEMOTION');
        }
        runStmt(db, 'UPDATE users SET role = ? WHERE id = ?', [role, userId]);
        const updated = queryOne(
          db,
          'SELECT id, uid, email, display_name, role, created_at FROM users WHERE id = ?',
          [userId],
        );
        return mapUserRow(updated);
      });
    } catch (error) {
      if (error instanceof Error && error.message === 'SELF_DEMOTION') throw error;
      console.error('Database query failed in updateUserRole:', error);
      throw new Error('Не удалось обновить роль пользователя.', { cause: error });
    }
  });
}

export async function listProducts(includeWholesale) {
  try {
    await ensureSeeded();
    const db = await getDb();
    const rows = queryAll(
      db,
      `SELECT p.*, s.name AS supplier_name
       FROM products p
       LEFT JOIN suppliers s ON p.supplier_id = s.id
       ORDER BY p.id DESC`,
    );
    return rows.map((row) => mapProductRow(row, includeWholesale));
  } catch (error) {
    console.error('Database query failed in listProducts:', error);
    throw new Error('Не удалось загрузить каталог товаров.', { cause: error });
  }
}

export async function createProduct(input) {
  await ensureSeeded();
  return withWriteLock(async () => {
    try {
      const db = await getDb();
      return runTransaction(db, () => {
        const supplier = queryOne(db, 'SELECT id, name FROM suppliers WHERE id = ? LIMIT 1', [
          input.supplierId,
        ]);
        if (!supplier) throw new Error('SUPPLIER_NOT_FOUND');

        const skuCheck = queryOne(db, 'SELECT id FROM products WHERE LOWER(sku) = LOWER(?) LIMIT 1', [
          input.sku,
        ]);
        if (skuCheck) throw new Error('DUPLICATE_SKU');

        const meta = runStmt(
          db,
          `INSERT INTO products (sku, name, category, species, supplier_id, price, purchase_price, stock, min_stock, unit, description, specs, image_url)
           VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`,
          [
            input.sku,
            input.name,
            input.category,
            input.species,
            supplier.id,
            input.price,
            input.purchasePrice,
            input.stock,
            input.minStock,
            input.unit,
            input.description || `${input.name}. Поставка от ${supplier.name}.`,
            input.specs || `${input.species} · ${input.unit}`,
            input.imageUrl,
          ],
        );
        const created = queryOne(db, 'SELECT * FROM products WHERE id = ?', [meta.id]);

        if (input.stock > 0) {
          runStmt(
            db,
            `INSERT INTO stock_movements (product_id, product_name, sku, type, delta, balance_after, supplier_id, supplier_name, note)
             VALUES (?,?,?,'Приход от поставщика',?,?,?,?,'Первичная приёмка товара на склад')`,
            [created.id, created.name, created.sku, input.stock, input.stock, supplier.id, supplier.name],
          );
        }

        return mapProductRow({ ...created, supplier_name: supplier.name }, true);
      });
    } catch (error) {
      if (
        error instanceof Error &&
        (error.message === 'SUPPLIER_NOT_FOUND' || error.message === 'DUPLICATE_SKU')
      ) {
        throw error;
      }
      console.error('Database query failed in createProduct:', error);
      throw new Error('Не удалось добавить товар в базу данных.', { cause: error });
    }
  });
}

export async function updateProduct(id, input) {
  await ensureSeeded();
  return withWriteLock(async () => {
    try {
      const db = await getDb();
      return runTransaction(db, () => {
        const existing = queryOne(db, 'SELECT * FROM products WHERE id = ? LIMIT 1', [id]);
        if (!existing) return null;

        const supplier = queryOne(db, 'SELECT id, name FROM suppliers WHERE id = ? LIMIT 1', [
          input.supplierId,
        ]);
        if (!supplier) throw new Error('SUPPLIER_NOT_FOUND');

        const skuCheck = queryOne(
          db,
          'SELECT id FROM products WHERE LOWER(sku) = LOWER(?) AND id <> ? LIMIT 1',
          [input.sku, id],
        );
        if (skuCheck) throw new Error('DUPLICATE_SKU');

        runStmt(
          db,
          `UPDATE products
           SET sku = ?,
               name = ?,
               category = ?,
               species = ?,
               supplier_id = ?,
               price = ?,
               purchase_price = ?,
               min_stock = ?,
               unit = ?,
               description = ?,
               specs = ?,
               image_url = ?,
               updated_at = datetime('now')
           WHERE id = ?`,
          [
            input.sku,
            input.name,
            input.category,
            input.species,
            supplier.id,
            input.price,
            input.purchasePrice,
            input.minStock,
            input.unit,
            input.description || `${input.name}. Поставка от ${supplier.name}.`,
            input.specs || `${input.species} · ${input.unit}`,
            input.imageUrl,
            id,
          ],
        );

        const updated = queryOne(db, 'SELECT * FROM products WHERE id = ?', [id]);
        return mapProductRow({ ...updated, supplier_name: supplier.name }, true);
      });
    } catch (error) {
      if (
        error instanceof Error &&
        (error.message === 'SUPPLIER_NOT_FOUND' || error.message === 'DUPLICATE_SKU')
      ) {
        throw error;
      }
      console.error('Database query failed in updateProduct:', error);
      throw new Error('Не удалось обновить карточку товара.', { cause: error });
    }
  });
}

export async function deleteProduct(id) {
  await ensureSeeded();
  return withWriteLock(async () => {
    try {
      const db = await getDb();
      return runTransaction(db, () => {
        const prod = queryOne(db, 'SELECT id FROM products WHERE id = ? LIMIT 1', [id]);
        if (!prod) return false;

        const orderRef = queryOne(db, 'SELECT id FROM order_items WHERE product_id = ? LIMIT 1', [id]);
        if (orderRef) throw new Error('PRODUCT_IN_ORDERS');

        runStmt(db, 'DELETE FROM stock_movements WHERE product_id = ?', [id]);
        runStmt(db, 'DELETE FROM products WHERE id = ?', [id]);
        return true;
      });
    } catch (error) {
      if (error instanceof Error && error.message === 'PRODUCT_IN_ORDERS') throw error;
      console.error('Database query failed in deleteProduct:', error);
      throw new Error('Не удалось удалить товар.', { cause: error });
    }
  });
}

export async function adjustProductStock(input) {
  await ensureSeeded();
  return withWriteLock(async () => {
    try {
      const db = await getDb();
      return runTransaction(db, () => {
        const prod = queryOne(db, 'SELECT * FROM products WHERE id = ? LIMIT 1', [input.productId]);
        if (!prod) throw new Error('PRODUCT_NOT_FOUND');

        const nextStock = Number(prod.stock) + input.delta;
        if (nextStock < 0) {
          throw new Error(`INSUFFICIENT_STOCK:${prod.stock}:${prod.unit}`);
        }

        const targetSupplierId = input.supplierId ?? prod.supplier_id;
        const supplier = queryOne(db, 'SELECT id, name FROM suppliers WHERE id = ? LIMIT 1', [
          targetSupplierId,
        ]);

        runStmt(db, "UPDATE products SET stock = ?, updated_at = datetime('now') WHERE id = ?", [
          nextStock,
          prod.id,
        ]);
        const updatedProd = queryOne(db, 'SELECT * FROM products WHERE id = ?', [prod.id]);

        const movMeta = runStmt(
          db,
          `INSERT INTO stock_movements (product_id, product_name, sku, type, delta, balance_after, supplier_id, supplier_name, note)
           VALUES (?,?,?,?,?,?,?,?,?)`,
          [
            prod.id,
            prod.name,
            prod.sku,
            input.type,
            input.delta,
            nextStock,
            input.type === 'Приход от поставщика' && supplier ? supplier.id : null,
            input.type === 'Приход от поставщика' && supplier ? supplier.name : null,
            input.note ||
              (input.type === 'Приход от поставщика'
                ? `Поставка от ${supplier ? supplier.name : 'поставщика'}`
                : 'Ручная корректировка остатка'),
          ],
        );
        const createdMov = queryOne(db, 'SELECT * FROM stock_movements WHERE id = ?', [movMeta.id]);
        const prodSup = queryOne(db, 'SELECT name FROM suppliers WHERE id = ? LIMIT 1', [
          updatedProd.supplier_id,
        ]);

        return {
          product: mapProductRow({ ...updatedProd, supplier_name: prodSup?.name }, true),
          movement: mapMovementRow(createdMov),
        };
      });
    } catch (error) {
      if (
        error instanceof Error &&
        (error.message === 'PRODUCT_NOT_FOUND' || error.message.startsWith('INSUFFICIENT_STOCK:'))
      ) {
        throw error;
      }
      console.error('Database query failed in adjustProductStock:', error);
      throw new Error('Не удалось обновить остаток товара.', { cause: error });
    }
  });
}

export async function listSuppliers() {
  try {
    await ensureSeeded();
    const db = await getDb();
    const rows = queryAll(db, 'SELECT * FROM suppliers ORDER BY id DESC');
    return rows.map(mapSupplierRow);
  } catch (error) {
    console.error('Database query failed in listSuppliers:', error);
    throw new Error('Не удалось загрузить список поставщиков.', { cause: error });
  }
}

export async function createSupplier(input) {
  await ensureSeeded();
  return withWriteLock(async () => {
    try {
      const db = await getDb();
      return runTransaction(db, () => {
        const meta = runStmt(
          db,
          `INSERT INTO suppliers (name, contact_person, phone, email, city, lead_time_days, categories, notes)
           VALUES (?,?,?,?,?,?,?,?)`,
          [
            input.name,
            input.contactPerson,
            input.phone,
            input.email,
            input.city,
            input.leadTimeDays,
            JSON.stringify(input.categories),
            input.notes,
          ],
        );
        const row = queryOne(db, 'SELECT * FROM suppliers WHERE id = ?', [meta.id]);
        return mapSupplierRow(row);
      });
    } catch (error) {
      console.error('Database query failed in createSupplier:', error);
      throw new Error('Не удалось создать поставщика.', { cause: error });
    }
  });
}

export async function updateSupplier(id, input) {
  await ensureSeeded();
  return withWriteLock(async () => {
    try {
      const db = await getDb();
      return runTransaction(db, () => {
        const existing = queryOne(db, 'SELECT id FROM suppliers WHERE id = ? LIMIT 1', [id]);
        if (!existing) return null;

        runStmt(
          db,
          `UPDATE suppliers
           SET name = ?, contact_person = ?, phone = ?, email = ?, city = ?,
               lead_time_days = ?, categories = ?, notes = ?
           WHERE id = ?`,
          [
            input.name,
            input.contactPerson,
            input.phone,
            input.email,
            input.city,
            input.leadTimeDays,
            JSON.stringify(input.categories),
            input.notes,
            id,
          ],
        );
        const updated = queryOne(db, 'SELECT * FROM suppliers WHERE id = ?', [id]);
        return mapSupplierRow(updated);
      });
    } catch (error) {
      console.error('Database query failed in updateSupplier:', error);
      throw new Error('Не удалось обновить поставщика.', { cause: error });
    }
  });
}

export async function deleteSupplier(id) {
  await ensureSeeded();
  return withWriteLock(async () => {
    try {
      const db = await getDb();
      return runTransaction(db, () => {
        const sup = queryOne(db, 'SELECT id FROM suppliers WHERE id = ? LIMIT 1', [id]);
        if (!sup) return false;

        const prodRef = queryOne(db, 'SELECT id FROM products WHERE supplier_id = ? LIMIT 1', [id]);
        if (prodRef) throw new Error('SUPPLIER_IN_USE');

        runStmt(db, 'UPDATE stock_movements SET supplier_id = NULL WHERE supplier_id = ?', [id]);
        runStmt(db, 'DELETE FROM suppliers WHERE id = ?', [id]);
        return true;
      });
    } catch (error) {
      if (error instanceof Error && error.message === 'SUPPLIER_IN_USE') throw error;
      console.error('Database query failed in deleteSupplier:', error);
      throw new Error('Не удалось удалить поставщика.', { cause: error });
    }
  });
}

function hydrateOrders(db, ordRows) {
  if (ordRows.length === 0) return [];
  const orderIds = ordRows.map((o) => Number(o.id));
  const placeholders = orderIds.map(() => '?').join(',');
  const itemRows = queryAll(
    db,
    `SELECT * FROM order_items WHERE order_id IN (${placeholders}) ORDER BY id ASC`,
    orderIds,
  );

  const itemsByOrder = new Map();
  for (const row of itemRows) {
    const oid = Number(row.order_id);
    const list = itemsByOrder.get(oid) || [];
    list.push({
      id: Number(row.id),
      productId: Number(row.product_id),
      sku: row.sku,
      productName: row.product_name,
      category: row.category,
      quantity: Number(row.quantity),
      unitPrice: Number(row.unit_price),
      subtotal: Number(row.subtotal),
    });
    itemsByOrder.set(oid, list);
  }

  return ordRows.map((o) => ({
    id: Number(o.id),
    orderNumber: o.order_number,
    userUid: o.user_uid,
    customerName: o.customer_name,
    customerPhone: o.customer_phone,
    deliveryAddress: o.delivery_address,
    paymentMethod: o.payment_method,
    status: o.status,
    totalAmount: Number(o.total_amount),
    createdAt: toIsoTimestamp(o.created_at),
    items: itemsByOrder.get(Number(o.id)) || [],
  }));
}

export async function listOrders() {
  try {
    await ensureSeeded();
    const db = await getDb();
    const ordRows = queryAll(db, 'SELECT * FROM orders ORDER BY id DESC');
    return hydrateOrders(db, ordRows);
  } catch (error) {
    console.error('Database query failed in listOrders:', error);
    throw new Error('Не удалось загрузить историю заказов.', { cause: error });
  }
}

export async function listOrdersByUser(userUid) {
  try {
    await ensureSeeded();
    const db = await getDb();
    const ordRows = queryAll(db, 'SELECT * FROM orders WHERE user_uid = ? ORDER BY id DESC', [
      userUid,
    ]);
    return hydrateOrders(db, ordRows);
  } catch (error) {
    console.error('Database query failed in listOrdersByUser:', error);
    throw new Error('Не удалось загрузить ваши заказы.', { cause: error });
  }
}

export async function createOrder(input) {
  await ensureSeeded();
  return withWriteLock(async () => {
    try {
      const db = await getDb();
      return runTransaction(db, () => {
        const productIds = input.items.map((i) => i.productId);
        const placeholders = productIds.map(() => '?').join(',');
        const prodRows = queryAll(
          db,
          `SELECT * FROM products WHERE id IN (${placeholders})`,
          productIds,
        );
        const prodMap = new Map(prodRows.map((p) => [Number(p.id), p]));

        const prepared = [];
        for (const reqItem of input.items) {
          const product = prodMap.get(reqItem.productId);
          if (!product) {
            throw new Error(`PRODUCT_NOT_FOUND:${reqItem.productId}`);
          }
          if (Number(product.stock) < reqItem.quantity) {
            throw new Error(
              `INSUFFICIENT_STOCK:${product.name}:${product.stock}:${product.unit}:${reqItem.quantity}`,
            );
          }
          prepared.push({
            product,
            quantity: reqItem.quantity,
            subtotal: Number(product.price) * reqItem.quantity,
          });
        }

        const maxRow = queryOne(db, 'SELECT COALESCE(MAX(id), 0) AS max_id FROM orders');
        const nextNum = 1043 + Number(maxRow?.max_id || 0);
        const orderNumber = `ЗМ-${nextNum}`;
        const totalAmount = prepared.reduce((s, it) => s + it.subtotal, 0);

        const ordMeta = runStmt(
          db,
          `INSERT INTO orders (order_number, user_uid, customer_name, customer_phone, delivery_address, payment_method, status, total_amount)
           VALUES (?,?,?,?,?,?,'В обработке',?)`,
          [
            orderNumber,
            input.userUid,
            input.customerName,
            input.customerPhone,
            input.deliveryAddress,
            input.paymentMethod,
            totalAmount,
          ],
        );
        const createdOrder = queryOne(db, 'SELECT * FROM orders WHERE id = ?', [ordMeta.id]);

        const createdItems = [];
        for (const it of prepared) {
          const itemMeta = runStmt(
            db,
            `INSERT INTO order_items (order_id, product_id, sku, product_name, category, quantity, unit_price, subtotal)
             VALUES (?,?,?,?,?,?,?,?)`,
            [
              createdOrder.id,
              it.product.id,
              it.product.sku,
              it.product.name,
              it.product.category,
              it.quantity,
              it.product.price,
              it.subtotal,
            ],
          );
          const row = queryOne(db, 'SELECT * FROM order_items WHERE id = ?', [itemMeta.id]);
          createdItems.push({
            id: Number(row.id),
            productId: Number(row.product_id),
            sku: row.sku,
            productName: row.product_name,
            category: row.category,
            quantity: Number(row.quantity),
            unitPrice: Number(row.unit_price),
            subtotal: Number(row.subtotal),
          });

          const nextStock = Number(it.product.stock) - it.quantity;
          runStmt(db, "UPDATE products SET stock = ?, updated_at = datetime('now') WHERE id = ?", [
            nextStock,
            it.product.id,
          ]);
          runStmt(
            db,
            `INSERT INTO stock_movements (product_id, product_name, sku, type, delta, balance_after, note)
             VALUES (?,?,?,'Продажа',?,?,?)`,
            [
              it.product.id,
              it.product.name,
              it.product.sku,
              -it.quantity,
              nextStock,
              `Заказ ${orderNumber} (${input.customerName})`,
            ],
          );
        }

        return {
          id: Number(createdOrder.id),
          orderNumber: createdOrder.order_number,
          userUid: createdOrder.user_uid,
          customerName: createdOrder.customer_name,
          customerPhone: createdOrder.customer_phone,
          deliveryAddress: createdOrder.delivery_address,
          paymentMethod: createdOrder.payment_method,
          status: createdOrder.status,
          totalAmount: Number(createdOrder.total_amount),
          createdAt: toIsoTimestamp(createdOrder.created_at),
          items: createdItems,
        };
      });
    } catch (error) {
      if (
        error instanceof Error &&
        (error.message.startsWith('PRODUCT_NOT_FOUND:') ||
          error.message.startsWith('INSUFFICIENT_STOCK:'))
      ) {
        throw error;
      }
      console.error('Database query failed in createOrder:', error);
      throw new Error('Не удалось оформить заказ.', { cause: error });
    }
  });
}

export async function updateOrderStatus(orderId, nextStatus) {
  await ensureSeeded();
  return withWriteLock(async () => {
    try {
      const db = await getDb();
      return runTransaction(db, () => {
        const order = queryOne(db, 'SELECT * FROM orders WHERE id = ? LIMIT 1', [orderId]);
        if (!order) return null;

        const itemRows = queryAll(db, 'SELECT * FROM order_items WHERE order_id = ? ORDER BY id ASC', [
          order.id,
        ]);

        const prevStatus = order.status;
        if (prevStatus !== nextStatus) {
          if (nextStatus === 'Отменён' && prevStatus !== 'Отменён') {
            for (const item of itemRows) {
              const p = queryOne(db, 'SELECT stock FROM products WHERE id = ? LIMIT 1', [
                item.product_id,
              ]);
              if (!p) continue;
              const nextStock = Number(p.stock) + Number(item.quantity);
              runStmt(db, "UPDATE products SET stock = ?, updated_at = datetime('now') WHERE id = ?", [
                nextStock,
                item.product_id,
              ]);
              runStmt(
                db,
                `INSERT INTO stock_movements (product_id, product_name, sku, type, delta, balance_after, note)
                 VALUES (?,?,?,'Корректировка',?,?,?)`,
                [
                  item.product_id,
                  item.product_name,
                  item.sku,
                  item.quantity,
                  nextStock,
                  `Возврат на склад по отменённому заказу ${order.order_number}`,
                ],
              );
            }
          } else if (prevStatus === 'Отменён' && nextStatus !== 'Отменён') {
            for (const item of itemRows) {
              const p = queryOne(db, 'SELECT stock FROM products WHERE id = ? LIMIT 1', [
                item.product_id,
              ]);
              if (!p || Number(p.stock) < Number(item.quantity)) {
                throw new Error(`INSUFFICIENT_RESUME:${item.product_name}`);
              }
            }
            for (const item of itemRows) {
              const p = queryOne(db, 'SELECT stock FROM products WHERE id = ? LIMIT 1', [
                item.product_id,
              ]);
              if (!p) continue;
              const nextStock = Number(p.stock) - Number(item.quantity);
              runStmt(db, "UPDATE products SET stock = ?, updated_at = datetime('now') WHERE id = ?", [
                nextStock,
                item.product_id,
              ]);
              runStmt(
                db,
                `INSERT INTO stock_movements (product_id, product_name, sku, type, delta, balance_after, note)
                 VALUES (?,?,?,'Продажа',?,?,?)`,
                [
                  item.product_id,
                  item.product_name,
                  item.sku,
                  -Number(item.quantity),
                  nextStock,
                  `Повторное проведение заказа ${order.order_number}`,
                ],
              );
            }
          }

          runStmt(db, 'UPDATE orders SET status = ? WHERE id = ?', [nextStatus, order.id]);
        }

        return {
          id: Number(order.id),
          orderNumber: order.order_number,
          userUid: order.user_uid,
          customerName: order.customer_name,
          customerPhone: order.customer_phone,
          deliveryAddress: order.delivery_address,
          paymentMethod: order.payment_method,
          status: nextStatus,
          totalAmount: Number(order.total_amount),
          createdAt: toIsoTimestamp(order.created_at),
          items: itemRows.map((it) => ({
            id: Number(it.id),
            productId: Number(it.product_id),
            sku: it.sku,
            productName: it.product_name,
            category: it.category,
            quantity: Number(it.quantity),
            unitPrice: Number(it.unit_price),
            subtotal: Number(it.subtotal),
          })),
        };
      });
    } catch (error) {
      if (error instanceof Error && error.message.startsWith('INSUFFICIENT_RESUME:')) {
        throw error;
      }
      console.error('Database query failed in updateOrderStatus:', error);
      throw new Error('Не удалось изменить статус заказа.', { cause: error });
    }
  });
}

export async function listStockMovements() {
  try {
    await ensureSeeded();
    const db = await getDb();
    const rows = queryAll(db, 'SELECT * FROM stock_movements ORDER BY id DESC LIMIT 100');
    return rows.map(mapMovementRow);
  } catch (error) {
    console.error('Database query failed in listStockMovements:', error);
    throw new Error('Не удалось загрузить журнал движения товаров.', { cause: error });
  }
}
