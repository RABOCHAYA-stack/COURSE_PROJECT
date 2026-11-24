import pg from 'pg';

const { Pool } = pg;

function getPool() {
  if (!globalThis._postgresPool) {
    globalThis._postgresPool = new Pool({
      host: process.env.SQL_HOST,
      user: process.env.SQL_USER,
      password: process.env.SQL_PASSWORD,
      database: process.env.SQL_DB_NAME,
      max: 10,
      connectionTimeoutMillis: 15000,
    });

    globalThis._postgresPool.on('error', (err) => {
      console.error('Unexpected error on idle SQL pool client:', err);
    });
  }
  return globalThis._postgresPool;
}

const pool = getPool();

let seedPromise = null;

export async function ensureSeeded() {
  if (!seedPromise) {
    seedPromise = runSeed().catch((err) => {
      seedPromise = null;
      throw err;
    });
  }
  await seedPromise;
}

async function ensureSchema() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      uid TEXT NOT NULL UNIQUE,
      email TEXT NOT NULL,
      display_name TEXT NOT NULL DEFAULT '',
      role TEXT NOT NULL DEFAULT 'customer' CHECK (role IN ('admin', 'customer')),
      created_at TIMESTAMP NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS suppliers (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL,
      contact_person TEXT NOT NULL,
      phone TEXT NOT NULL,
      email TEXT NOT NULL,
      city TEXT NOT NULL,
      lead_time_days INTEGER NOT NULL DEFAULT 2,
      categories JSONB NOT NULL,
      notes TEXT NOT NULL DEFAULT '',
      created_at TIMESTAMP NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS products (
      id SERIAL PRIMARY KEY,
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
      updated_at TIMESTAMP NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS orders (
      id SERIAL PRIMARY KEY,
      order_number TEXT NOT NULL UNIQUE,
      user_uid TEXT NOT NULL REFERENCES users(uid),
      customer_name TEXT NOT NULL,
      customer_phone TEXT NOT NULL,
      delivery_address TEXT NOT NULL,
      payment_method TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'В обработке' CHECK (status IN ('В обработке', 'Выполнен', 'Доставлен', 'Отменён')),
      total_amount INTEGER NOT NULL CHECK (total_amount >= 0),
      created_at TIMESTAMP NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS order_items (
      id SERIAL PRIMARY KEY,
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
      id SERIAL PRIMARY KEY,
      product_id INTEGER NOT NULL REFERENCES products(id),
      product_name TEXT NOT NULL,
      sku TEXT NOT NULL,
      type TEXT NOT NULL CHECK (type IN ('Приход от поставщика', 'Продажа', 'Корректировка', 'Списание')),
      delta INTEGER NOT NULL,
      balance_after INTEGER NOT NULL CHECK (balance_after >= 0),
      supplier_id INTEGER REFERENCES suppliers(id),
      supplier_name TEXT,
      note TEXT NOT NULL DEFAULT '',
      created_at TIMESTAMP NOT NULL DEFAULT NOW()
    );
  `);
}

async function runSeed() {
  let existing;
  try {
    existing = await pool.query('SELECT id FROM suppliers LIMIT 1');
  } catch (err) {
    if (err && err.code === '42P01') {
      await ensureSchema();
      existing = await pool.query('SELECT id FROM suppliers LIMIT 1');
    } else {
      throw err;
    }
  }
  if (existing.rows.length > 0) return;

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const check = await client.query('SELECT id FROM suppliers LIMIT 1');
    if (check.rows.length > 0) {
      await client.query('COMMIT');
      return;
    }

    const supRes = await client.query(
      `INSERT INTO suppliers (name, contact_person, phone, email, city, lead_time_days, categories, notes)
       VALUES
         ($1, $2, $3, $4, $5, $6, $7::jsonb, $8),
         ($9, $10, $11, $12, $13, $14, $15::jsonb, $16),
         ($17, $18, $19, $20, $21, $22, $23::jsonb, $24),
         ($25, $26, $27, $28, $29, $30, $31::jsonb, $32)
       RETURNING id, name`,
      [
        'ООО «ЗооПитание Русь»', 'Алексей Морозов', '+7 (495) 612-40-18', 'orders@zoopitanie.ru', 'Москва', 2, JSON.stringify(['food', 'treats']), 'Основной дистрибьютор сухих кормов холистик и натуральных сушёных лакомств.',
        'АО «ВетФарм Групп»', 'Елена Соколова', '+7 (812) 407-89-33', 'b2b@vetpharm-group.ru', 'Санкт-Петербург', 3, JSON.stringify(['medicine', 'care']), 'Сертифицированные ветпрепараты, пробиотики, витаминные комплексы и дерматологические шампуни.',
        'ТД «Лапа и Комфорт»', 'Дмитрий Волков', '+7 (495) 788-25-90', 'supply@lapakomfort.ru', 'Москва', 4, JSON.stringify(['supplies', 'care']), 'Поставщик льняных лежанок, деревянных когтеточек, керамических мисок и аксессуаров.',
        'Питомник «Северный Птичник и Ко»', 'Ирина Белова', '+7 (926) 514-77-04', 'kennel@severbird.ru', 'Подольск', 1, JSON.stringify(['animals']), 'Лицензированный питомник декоративных кроликов, волнистых попугаев, грызунов и аквариумных рыбок.',
      ],
    );

    const [sup1, sup2, sup3, sup4] = supRes.rows;

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
      const res = await client.query(
        `INSERT INTO products (sku, name, category, species, supplier_id, price, purchase_price, stock, min_stock, unit, description, specs, image_url)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
         RETURNING id, sku, name, category, price, stock`,
        row,
      );
      insertedProducts.push(res.rows[0]);
    }

    await client.query(
      `INSERT INTO users (uid, email, display_name, role)
       VALUES ($1, $2, $3, 'customer')
       ON CONFLICT (uid) DO NOTHING`,
      ['seed-customer-demo', 'customer.demo@lapadom.ru', 'Марина Кузнецова'],
    );

    const [p1, p2, p3, , , , , p8, p9] = insertedProducts;

    const ord1 = await client.query(
      `INSERT INTO orders (order_number, user_uid, customer_name, customer_phone, delivery_address, payment_method, status, total_amount)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING id`,
      ['ЗМ-1041', 'seed-customer-demo', 'Марина Кузнецова', '+7 (916) 442-19-08', 'г. Москва, ул. Покровка, д. 28, кв. 14', 'Онлайн-оплата', 'Доставлен', 5050],
    );

    const ord2 = await client.query(
      `INSERT INTO orders (order_number, user_uid, customer_name, customer_phone, delivery_address, payment_method, status, total_amount)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING id`,
      ['ЗМ-1042', 'seed-customer-demo', 'Артём Соловьёв', '+7 (903) 781-55-20', 'г. Москва, Ленинградский пр-т, д. 62, кв. 89', 'Картой при получении', 'Выполнен', 4840],
    );

    await client.query(
      `INSERT INTO order_items (order_id, product_id, sku, product_name, category, quantity, unit_price, subtotal)
       VALUES
         ($1,$2,$3,$4,$5,1,$6,$6),
         ($1,$7,$8,$9,$10,2,$11,$12),
         ($13,$14,$15,$16,$17,1,$18,$18),
         ($13,$19,$20,$21,$22,1,$23,$23)`,
      [
        ord1.rows[0].id, p1.id, p1.sku, p1.name, p1.category, p1.price,
        p3.id, p3.sku, p3.name, p3.category, p3.price, p3.price * 2,
        ord2.rows[0].id, p2.id, p2.sku, p2.name, p2.category, p2.price,
        p8.id, p8.sku, p8.name, p8.category, p8.price,
      ],
    );

    await client.query(
      `INSERT INTO stock_movements (product_id, product_name, sku, type, delta, balance_after, supplier_id, supplier_name, note)
       VALUES
         ($1,$2,$3,'Приход от поставщика',25,25,$4,$5,'Плановая поставка по накладной №412'),
         ($1,$2,$3,'Продажа',-1,24,NULL,NULL,'Заказ ЗМ-1041 (Марина Кузнецова)'),
         ($6,$7,$8,'Продажа',-1,6,NULL,NULL,'Заказ ЗМ-1042 (Артём Соловьёв)'),
         ($9,$10,$11,'Приход от поставщика',5,5,$12,$13,'Первичная приёмка коллекции «Сканди»')`,
      [p1.id, p1.name, p1.sku, sup1.id, sup1.name, p2.id, p2.name, p2.sku, p9.id, p9.name, p9.sku, sup3.id, sup3.name],
    );

    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

function mapUserRow(row) {
  return {
    id: row.id,
    uid: row.uid,
    email: row.email,
    displayName: row.display_name,
    role: row.role,
    createdAt: row.created_at instanceof Date ? row.created_at.toISOString() : String(row.created_at),
  };
}

function mapSupplierRow(row) {
  return {
    id: row.id,
    name: row.name,
    contactPerson: row.contact_person,
    phone: row.phone,
    email: row.email,
    city: row.city,
    leadTimeDays: row.lead_time_days,
    categories: Array.isArray(row.categories) ? row.categories : [],
    notes: row.notes,
    createdAt: row.created_at instanceof Date ? row.created_at.toISOString() : String(row.created_at),
  };
}

function mapProductRow(row, includeWholesale = true) {
  return {
    id: row.id,
    sku: row.sku,
    name: row.name,
    category: row.category,
    species: row.species,
    supplierId: row.supplier_id,
    supplierName: row.supplier_name || undefined,
    price: row.price,
    purchasePrice: includeWholesale ? row.purchase_price : 0,
    stock: row.stock,
    minStock: row.min_stock,
    unit: row.unit,
    description: row.description,
    specs: row.specs,
    imageUrl: row.image_url,
    updatedAt: row.updated_at instanceof Date ? row.updated_at.toISOString() : String(row.updated_at),
  };
}

function mapMovementRow(row) {
  return {
    id: row.id,
    productId: row.product_id,
    productName: row.product_name,
    sku: row.sku,
    type: row.type,
    delta: row.delta,
    balanceAfter: row.balance_after,
    supplierId: row.supplier_id,
    supplierName: row.supplier_name,
    note: row.note,
    createdAt: row.created_at instanceof Date ? row.created_at.toISOString() : String(row.created_at),
  };
}

export async function getOrCreateUser(uid, email, displayName = '') {
  try {
    await ensureSeeded();
    const existing = await pool.query(
      'SELECT id, uid, email, display_name, role, created_at FROM users WHERE uid = $1 LIMIT 1',
      [uid],
    );
    if (existing.rows.length > 0) {
      const updated = await pool.query(
        `UPDATE users
         SET email = $1, display_name = CASE WHEN $2 <> '' THEN $2 ELSE display_name END
         WHERE uid = $3
         RETURNING id, uid, email, display_name, role, created_at`,
        [email, displayName, uid],
      );
      return mapUserRow(updated.rows[0]);
    }

    const adminCheck = await pool.query(
      "SELECT id FROM users WHERE role = 'admin' LIMIT 1",
    );
    const envAdmin = process.env.ADMIN_EMAIL ? process.env.ADMIN_EMAIL.trim().toLowerCase() : '';
    const initialRole =
      adminCheck.rows.length === 0 || (envAdmin && email.toLowerCase() === envAdmin)
        ? 'admin'
        : 'customer';

    const inserted = await pool.query(
      `INSERT INTO users (uid, email, display_name, role)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (uid) DO UPDATE SET email = EXCLUDED.email, display_name = EXCLUDED.display_name
       RETURNING id, uid, email, display_name, role, created_at`,
      [uid, email, displayName, initialRole],
    );
    return mapUserRow(inserted.rows[0]);
  } catch (error) {
    console.error('Database query failed in getOrCreateUser:', error);
    throw new Error('Не удалось загрузить профиль пользователя.', { cause: error });
  }
}

export async function listAllUsers() {
  try {
    const res = await pool.query(
      'SELECT id, uid, email, display_name, role, created_at FROM users ORDER BY created_at DESC',
    );
    return res.rows.map(mapUserRow);
  } catch (error) {
    console.error('Database query failed in listAllUsers:', error);
    throw new Error('Не удалось получить список пользователей.', { cause: error });
  }
}

export async function updateUserRole(userId, role, actingUid) {
  try {
    const existing = await pool.query(
      'SELECT id, uid FROM users WHERE id = $1 LIMIT 1',
      [userId],
    );
    if (existing.rows.length === 0) return null;
    if (existing.rows[0].uid === actingUid && role !== 'admin') {
      throw new Error('SELF_DEMOTION');
    }
    const updated = await pool.query(
      `UPDATE users SET role = $1 WHERE id = $2
       RETURNING id, uid, email, display_name, role, created_at`,
      [role, userId],
    );
    return mapUserRow(updated.rows[0]);
  } catch (error) {
    if (error instanceof Error && error.message === 'SELF_DEMOTION') throw error;
    console.error('Database query failed in updateUserRole:', error);
    throw new Error('Не удалось обновить роль пользователя.', { cause: error });
  }
}

export async function listProducts(includeWholesale) {
  try {
    await ensureSeeded();
    const res = await pool.query(
      `SELECT p.*, s.name AS supplier_name
       FROM products p
       LEFT JOIN suppliers s ON p.supplier_id = s.id
       ORDER BY p.id DESC`,
    );
    return res.rows.map((row) => mapProductRow(row, includeWholesale));
  } catch (error) {
    console.error('Database query failed in listProducts:', error);
    throw new Error('Не удалось загрузить каталог товаров.', { cause: error });
  }
}

export async function createProduct(input) {
  const client = await pool.connect();
  try {
    await ensureSeeded();
    await client.query('BEGIN');

    const supRes = await client.query(
      'SELECT id, name FROM suppliers WHERE id = $1 LIMIT 1',
      [input.supplierId],
    );
    if (supRes.rows.length === 0) throw new Error('SUPPLIER_NOT_FOUND');
    const supplier = supRes.rows[0];

    const skuCheck = await client.query(
      'SELECT id FROM products WHERE LOWER(sku) = LOWER($1) LIMIT 1',
      [input.sku],
    );
    if (skuCheck.rows.length > 0) throw new Error('DUPLICATE_SKU');

    const insRes = await client.query(
      `INSERT INTO products (sku, name, category, species, supplier_id, price, purchase_price, stock, min_stock, unit, description, specs, image_url)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
       RETURNING *`,
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
    const created = insRes.rows[0];

    if (input.stock > 0) {
      await client.query(
        `INSERT INTO stock_movements (product_id, product_name, sku, type, delta, balance_after, supplier_id, supplier_name, note)
         VALUES ($1,$2,$3,'Приход от поставщика',$4,$4,$5,$6,'Первичная приёмка товара на склад')`,
        [created.id, created.name, created.sku, input.stock, supplier.id, supplier.name],
      );
    }

    await client.query('COMMIT');
    return mapProductRow({ ...created, supplier_name: supplier.name }, true);
  } catch (error) {
    await client.query('ROLLBACK');
    if (
      error instanceof Error &&
      (error.message === 'SUPPLIER_NOT_FOUND' || error.message === 'DUPLICATE_SKU')
    ) {
      throw error;
    }
    console.error('Database query failed in createProduct:', error);
    throw new Error('Не удалось добавить товар в базу данных.', { cause: error });
  } finally {
    client.release();
  }
}

export async function updateProduct(id, input) {
  const client = await pool.connect();
  try {
    await ensureSeeded();
    await client.query('BEGIN');

    const existingRes = await client.query('SELECT * FROM products WHERE id = $1 FOR UPDATE', [id]);
    if (existingRes.rows.length === 0) {
      await client.query('COMMIT');
      return null;
    }

    const supRes = await client.query('SELECT id, name FROM suppliers WHERE id = $1 LIMIT 1', [
      input.supplierId,
    ]);
    if (supRes.rows.length === 0) throw new Error('SUPPLIER_NOT_FOUND');
    const supplier = supRes.rows[0];

    const skuCheck = await client.query(
      'SELECT id FROM products WHERE LOWER(sku) = LOWER($1) AND id <> $2 LIMIT 1',
      [input.sku, id],
    );
    if (skuCheck.rows.length > 0) throw new Error('DUPLICATE_SKU');

    const updRes = await client.query(
      `UPDATE products
       SET sku = $1,
           name = $2,
           category = $3,
           species = $4,
           supplier_id = $5,
           price = $6,
           purchase_price = $7,
           min_stock = $8,
           unit = $9,
           description = $10,
           specs = $11,
           image_url = $12,
           updated_at = NOW()
       WHERE id = $13
       RETURNING *`,
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

    await client.query('COMMIT');
    return mapProductRow({ ...updRes.rows[0], supplier_name: supplier.name }, true);
  } catch (error) {
    await client.query('ROLLBACK');
    if (
      error instanceof Error &&
      (error.message === 'SUPPLIER_NOT_FOUND' || error.message === 'DUPLICATE_SKU')
    ) {
      throw error;
    }
    console.error('Database query failed in updateProduct:', error);
    throw new Error('Не удалось обновить карточку товара.', { cause: error });
  } finally {
    client.release();
  }
}

export async function deleteProduct(id) {
  const client = await pool.connect();
  try {
    await ensureSeeded();
    await client.query('BEGIN');

    const prodRes = await client.query('SELECT id FROM products WHERE id = $1 FOR UPDATE', [id]);
    if (prodRes.rows.length === 0) {
      await client.query('COMMIT');
      return false;
    }

    const orderRef = await client.query(
      'SELECT id FROM order_items WHERE product_id = $1 LIMIT 1',
      [id],
    );
    if (orderRef.rows.length > 0) {
      throw new Error('PRODUCT_IN_ORDERS');
    }

    await client.query('DELETE FROM stock_movements WHERE product_id = $1', [id]);
    await client.query('DELETE FROM products WHERE id = $1', [id]);
    await client.query('COMMIT');
    return true;
  } catch (error) {
    await client.query('ROLLBACK');
    if (error instanceof Error && error.message === 'PRODUCT_IN_ORDERS') {
      throw error;
    }
    console.error('Database query failed in deleteProduct:', error);
    throw new Error('Не удалось удалить товар.', { cause: error });
  } finally {
    client.release();
  }
}

export async function adjustProductStock(input) {
  const client = await pool.connect();
  try {
    await ensureSeeded();
    await client.query('BEGIN');

    const prodRes = await client.query(
      'SELECT * FROM products WHERE id = $1 FOR UPDATE',
      [input.productId],
    );
    if (prodRes.rows.length === 0) throw new Error('PRODUCT_NOT_FOUND');
    const prod = prodRes.rows[0];

    const nextStock = prod.stock + input.delta;
    if (nextStock < 0) {
      throw new Error(`INSUFFICIENT_STOCK:${prod.stock}:${prod.unit}`);
    }

    const targetSupplierId = input.supplierId ?? prod.supplier_id;
    const supRes = await client.query(
      'SELECT id, name FROM suppliers WHERE id = $1 LIMIT 1',
      [targetSupplierId],
    );
    const supplier = supRes.rows[0] || null;

    const updRes = await client.query(
      'UPDATE products SET stock = $1, updated_at = NOW() WHERE id = $2 RETURNING *',
      [nextStock, prod.id],
    );

    const movRes = await client.query(
      `INSERT INTO stock_movements (product_id, product_name, sku, type, delta, balance_after, supplier_id, supplier_name, note)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
       RETURNING *`,
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

    const prodSup = await client.query(
      'SELECT name FROM suppliers WHERE id = $1 LIMIT 1',
      [updRes.rows[0].supplier_id],
    );

    await client.query('COMMIT');
    return {
      product: mapProductRow(
        { ...updRes.rows[0], supplier_name: prodSup.rows[0]?.name },
        true,
      ),
      movement: mapMovementRow(movRes.rows[0]),
    };
  } catch (error) {
    await client.query('ROLLBACK');
    if (
      error instanceof Error &&
      (error.message === 'PRODUCT_NOT_FOUND' ||
        error.message.startsWith('INSUFFICIENT_STOCK:'))
    ) {
      throw error;
    }
    console.error('Database query failed in adjustProductStock:', error);
    throw new Error('Не удалось обновить остаток товара.', { cause: error });
  } finally {
    client.release();
  }
}

export async function listSuppliers() {
  try {
    await ensureSeeded();
    const res = await pool.query('SELECT * FROM suppliers ORDER BY id DESC');
    return res.rows.map(mapSupplierRow);
  } catch (error) {
    console.error('Database query failed in listSuppliers:', error);
    throw new Error('Не удалось загрузить список поставщиков.', { cause: error });
  }
}

export async function createSupplier(input) {
  try {
    await ensureSeeded();
    const res = await pool.query(
      `INSERT INTO suppliers (name, contact_person, phone, email, city, lead_time_days, categories, notes)
       VALUES ($1,$2,$3,$4,$5,$6,$7::jsonb,$8)
       RETURNING *`,
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
    return mapSupplierRow(res.rows[0]);
  } catch (error) {
    console.error('Database query failed in createSupplier:', error);
    throw new Error('Не удалось создать поставщика.', { cause: error });
  }
}

export async function updateSupplier(id, input) {
  try {
    await ensureSeeded();
    const res = await pool.query(
      `UPDATE suppliers
       SET name = $1, contact_person = $2, phone = $3, email = $4, city = $5,
           lead_time_days = $6, categories = $7::jsonb, notes = $8
       WHERE id = $9
       RETURNING *`,
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
    return res.rows.length > 0 ? mapSupplierRow(res.rows[0]) : null;
  } catch (error) {
    console.error('Database query failed in updateSupplier:', error);
    throw new Error('Не удалось обновить поставщика.', { cause: error });
  }
}

export async function deleteSupplier(id) {
  const client = await pool.connect();
  try {
    await ensureSeeded();
    await client.query('BEGIN');

    const supRes = await client.query('SELECT id FROM suppliers WHERE id = $1 FOR UPDATE', [id]);
    if (supRes.rows.length === 0) {
      await client.query('COMMIT');
      return false;
    }

    const prodRef = await client.query(
      'SELECT id FROM products WHERE supplier_id = $1 LIMIT 1',
      [id],
    );
    if (prodRef.rows.length > 0) {
      throw new Error('SUPPLIER_IN_USE');
    }

    await client.query('UPDATE stock_movements SET supplier_id = NULL WHERE supplier_id = $1', [
      id,
    ]);
    await client.query('DELETE FROM suppliers WHERE id = $1', [id]);
    await client.query('COMMIT');
    return true;
  } catch (error) {
    await client.query('ROLLBACK');
    if (error instanceof Error && error.message === 'SUPPLIER_IN_USE') {
      throw error;
    }
    console.error('Database query failed in deleteSupplier:', error);
    throw new Error('Не удалось удалить поставщика.', { cause: error });
  } finally {
    client.release();
  }
}

async function hydrateOrders(ordRows) {
  if (ordRows.length === 0) return [];
  const orderIds = ordRows.map((o) => o.id);
  const itemsRes = await pool.query(
    'SELECT * FROM order_items WHERE order_id = ANY($1::int[]) ORDER BY id ASC',
    [orderIds],
  );

  const itemsByOrder = new Map();
  for (const row of itemsRes.rows) {
    const list = itemsByOrder.get(row.order_id) || [];
    list.push({
      id: row.id,
      productId: row.product_id,
      sku: row.sku,
      productName: row.product_name,
      category: row.category,
      quantity: row.quantity,
      unitPrice: row.unit_price,
      subtotal: row.subtotal,
    });
    itemsByOrder.set(row.order_id, list);
  }

  return ordRows.map((o) => ({
    id: o.id,
    orderNumber: o.order_number,
    userUid: o.user_uid,
    customerName: o.customer_name,
    customerPhone: o.customer_phone,
    deliveryAddress: o.delivery_address,
    paymentMethod: o.payment_method,
    status: o.status,
    totalAmount: o.total_amount,
    createdAt: o.created_at instanceof Date ? o.created_at.toISOString() : String(o.created_at),
    items: itemsByOrder.get(o.id) || [],
  }));
}

export async function listOrders() {
  try {
    await ensureSeeded();
    const ordRes = await pool.query('SELECT * FROM orders ORDER BY id DESC');
    return await hydrateOrders(ordRes.rows);
  } catch (error) {
    console.error('Database query failed in listOrders:', error);
    throw new Error('Не удалось загрузить историю заказов.', { cause: error });
  }
}

export async function listOrdersByUser(userUid) {
  try {
    await ensureSeeded();
    const ordRes = await pool.query(
      'SELECT * FROM orders WHERE user_uid = $1 ORDER BY id DESC',
      [userUid],
    );
    return await hydrateOrders(ordRes.rows);
  } catch (error) {
    console.error('Database query failed in listOrdersByUser:', error);
    throw new Error('Не удалось загрузить ваши заказы.', { cause: error });
  }
}

export async function createOrder(input) {
  const client = await pool.connect();
  try {
    await ensureSeeded();
    await client.query('BEGIN');

    const productIds = input.items.map((i) => i.productId);
    const prodRes = await client.query(
      'SELECT * FROM products WHERE id = ANY($1::int[]) FOR UPDATE',
      [productIds],
    );
    const prodMap = new Map(prodRes.rows.map((p) => [p.id, p]));

    const prepared = [];
    for (const reqItem of input.items) {
      const product = prodMap.get(reqItem.productId);
      if (!product) {
        throw new Error(`PRODUCT_NOT_FOUND:${reqItem.productId}`);
      }
      if (product.stock < reqItem.quantity) {
        throw new Error(
          `INSUFFICIENT_STOCK:${product.name}:${product.stock}:${product.unit}:${reqItem.quantity}`,
        );
      }
      prepared.push({
        product,
        quantity: reqItem.quantity,
        subtotal: product.price * reqItem.quantity,
      });
    }

    const maxRes = await client.query('SELECT COALESCE(MAX(id), 0)::int AS max_id FROM orders');
    const nextNum = 1043 + Number(maxRes.rows[0].max_id || 0);
    const orderNumber = `ЗМ-${nextNum}`;
    const totalAmount = prepared.reduce((s, it) => s + it.subtotal, 0);

    const ordRes = await client.query(
      `INSERT INTO orders (order_number, user_uid, customer_name, customer_phone, delivery_address, payment_method, status, total_amount)
       VALUES ($1,$2,$3,$4,$5,$6,'В обработке',$7)
       RETURNING *`,
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
    const createdOrder = ordRes.rows[0];

    const createdItems = [];
    for (const it of prepared) {
      const itemRes = await client.query(
        `INSERT INTO order_items (order_id, product_id, sku, product_name, category, quantity, unit_price, subtotal)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
         RETURNING *`,
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
      const row = itemRes.rows[0];
      createdItems.push({
        id: row.id,
        productId: row.product_id,
        sku: row.sku,
        productName: row.product_name,
        category: row.category,
        quantity: row.quantity,
        unitPrice: row.unit_price,
        subtotal: row.subtotal,
      });

      const nextStock = it.product.stock - it.quantity;
      await client.query(
        'UPDATE products SET stock = $1, updated_at = NOW() WHERE id = $2',
        [nextStock, it.product.id],
      );
      await client.query(
        `INSERT INTO stock_movements (product_id, product_name, sku, type, delta, balance_after, note)
         VALUES ($1,$2,$3,'Продажа',$4,$5,$6)`,
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

    await client.query('COMMIT');
    return {
      id: createdOrder.id,
      orderNumber: createdOrder.order_number,
      userUid: createdOrder.user_uid,
      customerName: createdOrder.customer_name,
      customerPhone: createdOrder.customer_phone,
      deliveryAddress: createdOrder.delivery_address,
      paymentMethod: createdOrder.payment_method,
      status: createdOrder.status,
      totalAmount: createdOrder.total_amount,
      createdAt:
        createdOrder.created_at instanceof Date
          ? createdOrder.created_at.toISOString()
          : String(createdOrder.created_at),
      items: createdItems,
    };
  } catch (error) {
    await client.query('ROLLBACK');
    if (
      error instanceof Error &&
      (error.message.startsWith('PRODUCT_NOT_FOUND:') ||
        error.message.startsWith('INSUFFICIENT_STOCK:'))
    ) {
      throw error;
    }
    console.error('Database query failed in createOrder:', error);
    throw new Error('Не удалось оформить заказ.', { cause: error });
  } finally {
    client.release();
  }
}

export async function updateOrderStatus(orderId, nextStatus) {
  const client = await pool.connect();
  try {
    await ensureSeeded();
    await client.query('BEGIN');

    const ordRes = await client.query(
      'SELECT * FROM orders WHERE id = $1 FOR UPDATE',
      [orderId],
    );
    if (ordRes.rows.length === 0) {
      await client.query('COMMIT');
      return null;
    }
    const order = ordRes.rows[0];
    const itemsRes = await client.query(
      'SELECT * FROM order_items WHERE order_id = $1 ORDER BY id ASC',
      [order.id],
    );

    const prevStatus = order.status;
    if (prevStatus !== nextStatus) {
      if (nextStatus === 'Отменён' && prevStatus !== 'Отменён') {
        for (const item of itemsRes.rows) {
          const pRes = await client.query(
            'SELECT stock FROM products WHERE id = $1 FOR UPDATE',
            [item.product_id],
          );
          if (pRes.rows.length === 0) continue;
          const nextStock = pRes.rows[0].stock + item.quantity;
          await client.query(
            'UPDATE products SET stock = $1, updated_at = NOW() WHERE id = $2',
            [nextStock, item.product_id],
          );
          await client.query(
            `INSERT INTO stock_movements (product_id, product_name, sku, type, delta, balance_after, note)
             VALUES ($1,$2,$3,'Корректировка',$4,$5,$6)`,
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
        for (const item of itemsRes.rows) {
          const pRes = await client.query(
            'SELECT stock FROM products WHERE id = $1 FOR UPDATE',
            [item.product_id],
          );
          if (pRes.rows.length === 0 || pRes.rows[0].stock < item.quantity) {
            throw new Error(`INSUFFICIENT_RESUME:${item.product_name}`);
          }
        }
        for (const item of itemsRes.rows) {
          const pRes = await client.query(
            'SELECT stock FROM products WHERE id = $1 FOR UPDATE',
            [item.product_id],
          );
          if (pRes.rows.length === 0) continue;
          const nextStock = pRes.rows[0].stock - item.quantity;
          await client.query(
            'UPDATE products SET stock = $1, updated_at = NOW() WHERE id = $2',
            [nextStock, item.product_id],
          );
          await client.query(
            `INSERT INTO stock_movements (product_id, product_name, sku, type, delta, balance_after, note)
             VALUES ($1,$2,$3,'Продажа',$4,$5,$6)`,
            [
              item.product_id,
              item.product_name,
              item.sku,
              -item.quantity,
              nextStock,
              `Повторное проведение заказа ${order.order_number}`,
            ],
          );
        }
      }

      await client.query('UPDATE orders SET status = $1 WHERE id = $2', [
        nextStatus,
        order.id,
      ]);
    }

    await client.query('COMMIT');
    return {
      id: order.id,
      orderNumber: order.order_number,
      userUid: order.user_uid,
      customerName: order.customer_name,
      customerPhone: order.customer_phone,
      deliveryAddress: order.delivery_address,
      paymentMethod: order.payment_method,
      status: nextStatus,
      totalAmount: order.total_amount,
      createdAt:
        order.created_at instanceof Date
          ? order.created_at.toISOString()
          : String(order.created_at),
      items: itemsRes.rows.map((it) => ({
        id: it.id,
        productId: it.product_id,
        sku: it.sku,
        productName: it.product_name,
        category: it.category,
        quantity: it.quantity,
        unitPrice: it.unit_price,
        subtotal: it.subtotal,
      })),
    };
  } catch (error) {
    await client.query('ROLLBACK');
    if (error instanceof Error && error.message.startsWith('INSUFFICIENT_RESUME:')) {
      throw error;
    }
    console.error('Database query failed in updateOrderStatus:', error);
    throw new Error('Не удалось изменить статус заказа.', { cause: error });
  } finally {
    client.release();
  }
}

export async function listStockMovements() {
  try {
    await ensureSeeded();
    const res = await pool.query(
      'SELECT * FROM stock_movements ORDER BY id DESC LIMIT 100',
    );
    return res.rows.map(mapMovementRow);
  } catch (error) {
    console.error('Database query failed in listStockMovements:', error);
    throw new Error('Не удалось загрузить журнал движения товаров.', { cause: error });
  }
}
