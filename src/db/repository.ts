import { desc, eq, inArray, sql } from 'drizzle-orm';
import { db } from './index.ts';
import {
  orderItems,
  orders,
  products,
  stockMovements,
  suppliers,
  users,
} from './schema.ts';
import type {
  CategoryId,
  Order,
  OrderStatus,
  PaymentMethod,
  PetSpecies,
  Product,
  StockMovement,
  StockMovementType,
  Supplier,
} from '../types.ts';

function toSupplier(row: typeof suppliers.$inferSelect): Supplier {
  return {
    id: row.id,
    name: row.name,
    contactPerson: row.contactPerson,
    phone: row.phone,
    email: row.email,
    city: row.city,
    leadTimeDays: row.leadTimeDays,
    categories: row.categories,
    notes: row.notes,
    createdAt: row.createdAt.toISOString(),
  };
}

function toProduct(
  row: typeof products.$inferSelect,
  supplierName?: string,
  includeWholesale = true,
): Product {
  return {
    id: row.id,
    sku: row.sku,
    name: row.name,
    category: row.category,
    species: row.species,
    supplierId: row.supplierId,
    supplierName,
    price: row.price,
    purchasePrice: includeWholesale ? row.purchasePrice : 0,
    stock: row.stock,
    minStock: row.minStock,
    unit: row.unit,
    description: row.description,
    specs: row.specs,
    imageUrl: row.imageUrl,
    updatedAt: row.updatedAt.toISOString(),
  };
}

function toMovement(row: typeof stockMovements.$inferSelect): StockMovement {
  return {
    id: row.id,
    productId: row.productId,
    productName: row.productName,
    sku: row.sku,
    type: row.type,
    delta: row.delta,
    balanceAfter: row.balanceAfter,
    supplierId: row.supplierId,
    supplierName: row.supplierName,
    note: row.note,
    createdAt: row.createdAt.toISOString(),
  };
}

let seedPromise: Promise<void> | null = null;

export async function ensureSeeded(): Promise<void> {
  if (!seedPromise) {
    seedPromise = runSeed().catch((err) => {
      seedPromise = null;
      throw err;
    });
  }
  await seedPromise;
}

async function runSeed(): Promise<void> {
  const existingSuppliers = await db.select({ id: suppliers.id }).from(suppliers).limit(1);
  if (existingSuppliers.length > 0) {
    return;
  }

  await db.transaction(async (tx) => {
    const doubleCheck = await tx.select({ id: suppliers.id }).from(suppliers).limit(1);
    if (doubleCheck.length > 0) return;

    const insertedSuppliers = await tx
      .insert(suppliers)
      .values([
        {
          name: 'ООО «ЗооПитание Русь»',
          contactPerson: 'Алексей Морозов',
          phone: '+7 (495) 612-40-18',
          email: 'orders@zoopitanie.ru',
          city: 'Москва',
          leadTimeDays: 2,
          categories: ['food', 'treats'],
          notes: 'Основной дистрибьютор сухих кормов холистик и натуральных сушёных лакомств.',
        },
        {
          name: 'АО «ВетФарм Групп»',
          contactPerson: 'Елена Соколова',
          phone: '+7 (812) 407-89-33',
          email: 'b2b@vetpharm-group.ru',
          city: 'Санкт-Петербург',
          leadTimeDays: 3,
          categories: ['medicine', 'care'],
          notes: 'Сертифицированные ветпрепараты, пробиотики, витаминные комплексы и дерматологические шампуни.',
        },
        {
          name: 'ТД «Лапа и Комфорт»',
          contactPerson: 'Дмитрий Волков',
          phone: '+7 (495) 788-25-90',
          email: 'supply@lapakomfort.ru',
          city: 'Москва',
          leadTimeDays: 4,
          categories: ['supplies', 'care'],
          notes: 'Поставщик льняных лежанок, деревянных когтеточек, керамических мисок и аксессуаров.',
        },
        {
          name: 'Питомник «Северный Птичник и Ко»',
          contactPerson: 'Ирина Белова',
          phone: '+7 (926) 514-77-04',
          email: 'kennel@severbird.ru',
          city: 'Подольск',
          leadTimeDays: 1,
          categories: ['animals'],
          notes: 'Лицензированный питомник декоративных кроликов, волнистых попугаев, грызунов и аквариумных рыбок.',
        },
      ])
      .returning();

    const [sup1, sup2, sup3, sup4] = insertedSuppliers;

    const insertedProducts = await tx
      .insert(products)
      .values([
        {
          sku: 'FD-1001',
          name: 'Холистик корм «Северный Луг» индейка и батат',
          category: 'food',
          species: 'Собаки',
          supplierId: sup1.id,
          price: 3490,
          purchasePrice: 2250,
          stock: 24,
          minStock: 8,
          unit: 'уп. 2.5 кг',
          description:
            'Беззерновой полнорационный сухой корм для взрослых собак всех пород. Содержит 68% дегидрированного мяса индейки, батат, пребиотики и масло лосося.',
          specs: 'Беззерновой · Индейка 68% · 2.5 кг',
          imageUrl: '/src/assets/images/cat_food_premium_1795537996961.jpg',
        },
        {
          sku: 'FD-1002',
          name: 'Сухой корм «Фьорд Кэт» для стерилизованных кошек',
          category: 'food',
          species: 'Кошки',
          supplierId: sup1.id,
          price: 2890,
          purchasePrice: 1840,
          stock: 6,
          minStock: 10,
          unit: 'уп. 2 кг',
          description:
            'Формула с форелью и клюквой для профилактики мочекаменной болезни и поддержания оптимального веса у домашних кошек.',
          specs: 'Форель и клюква · Контроль pH · 2 кг',
          imageUrl: '/src/assets/images/cat_food_premium_1795537996961.jpg',
        },
        {
          sku: 'TR-2001',
          name: 'Сублимированные кубики говядины и печёное печенье',
          category: 'treats',
          species: 'Собаки',
          supplierId: sup1.id,
          price: 780,
          purchasePrice: 440,
          stock: 32,
          minStock: 12,
          unit: 'банка 180 г',
          description:
            'Натуральное лакомство бережной сублимационной сушки без соли, красителей и консервантов. Идеально для дрессировки и поощрения.',
          specs: '100% мясо · Сублимация · 180 г',
          imageUrl: '/src/assets/images/cat_treats_snacks_1795537998259.jpg',
        },
        {
          sku: 'TR-2002',
          name: 'Хрустящие подушечки с уткой и кошачьей мятой',
          category: 'treats',
          species: 'Кошки',
          supplierId: sup1.id,
          price: 420,
          purchasePrice: 230,
          stock: 19,
          minStock: 10,
          unit: 'уп. 90 г',
          description:
            'Подушечки с нежным паштетом из утки и экстрактом кошачьей мяты способствуют выведению шерсти и очищению зубов.',
          specs: 'Утка + таурин · Выведение шерсти · 90 г',
          imageUrl: '/src/assets/images/cat_treats_snacks_1795537998259.jpg',
        },
        {
          sku: 'CR-3001',
          name: 'Ботанический шампунь с ромашкой и овсяным молочком',
          category: 'care',
          species: 'Собаки',
          supplierId: sup2.id,
          price: 1290,
          purchasePrice: 790,
          stock: 15,
          minStock: 6,
          unit: 'фл. 250 мл',
          description:
            'Мягкий бессульфатный шампунь с нейтральным pH для чувствительной кожи. Успокаивает раздражения и облегчает расчёсывание.',
          specs: 'Без SLS · pH 6.8 · 250 мл',
          imageUrl: '/src/assets/images/cat_care_grooming_1795537998190.jpg',
        },
        {
          sku: 'CR-3002',
          name: 'Буковая щётка для деликатного вычёсывания подшёрстка',
          category: 'care',
          species: 'Кошки',
          supplierId: sup3.id,
          price: 1450,
          purchasePrice: 860,
          stock: 4,
          minStock: 6,
          unit: 'шт',
          description:
            'Эргономичная щётка из массива бука с натуральной щетиной кабана равномерно распределяет кожные липиды и придаёт шерсти блеск.',
          specs: 'Массив бука · Натуральная щетина · 19 см',
          imageUrl: '/src/assets/images/cat_care_grooming_1795537998190.jpg',
        },
        {
          sku: 'MD-4001',
          name: 'Витаминно-минеральный комплекс «ВетВелл» в каплях',
          category: 'medicine',
          species: 'Собаки',
          supplierId: sup2.id,
          price: 1680,
          purchasePrice: 1090,
          stock: 14,
          minStock: 5,
          unit: 'фл. 30 мл',
          description:
            'Концентрированный комплекс витаминов A, D3, E, группы B и хелатных минералов для укрепления иммунитета, суставов и связок.',
          specs: 'Капли 30 мл · Иммунитет и суставы · СГР',
          imageUrl: '/src/assets/images/cat_medicine_vet_1795537998705.jpg',
        },
        {
          sku: 'MD-4002',
          name: 'Пробиотик для микрофлоры ЖКТ «ПауБиотикс»',
          category: 'medicine',
          species: 'Кошки',
          supplierId: sup2.id,
          price: 1950,
          purchasePrice: 1280,
          stock: 9,
          minStock: 5,
          unit: 'банка 60 г',
          description:
            'Мультиштаммовый синбиотик в порошке для быстрого восстановления пищеварения после антибиотиков и при смене рациона.',
          specs: '6 штаммов · 60 г · Мерная ложка в комплекте',
          imageUrl: '/src/assets/images/cat_medicine_vet_1795537998705.jpg',
        },
        {
          sku: 'SP-5001',
          name: 'Льняная лежанка на дубовом основании «Сканди»',
          category: 'supplies',
          species: 'Собаки',
          supplierId: sup3.id,
          price: 6800,
          purchasePrice: 4300,
          stock: 5,
          minStock: 3,
          unit: 'шт',
          description:
            'Ортопедическая лежанка со съёмным чехлом из плотного небелёного льна и бортиками с гипоаллергенным наполнителем.',
          specs: '75 × 55 см · Дуб и лён · Съёмный чехол',
          imageUrl: '/src/assets/images/cat_pet_accessories_1795537998453.jpg',
        },
        {
          sku: 'SP-5002',
          name: 'Ошейник из мягкой телячьей кожи с латунной пряжкой',
          category: 'supplies',
          species: 'Собаки',
          supplierId: sup3.id,
          price: 2350,
          purchasePrice: 1420,
          stock: 11,
          minStock: 4,
          unit: 'шт',
          description:
            'Прочный ошейник ручной прошивки с литой латунной фурнитурой, не натирает шею и устойчив к влаге.',
          specs: 'Размер M (35–45 см) · Натуральная кожа',
          imageUrl: '/src/assets/images/cat_pet_accessories_1795537998453.jpg',
        },
        {
          sku: 'AN-6001',
          name: 'Карликовый вислоухий кролик «Минор» (кремовый)',
          category: 'animals',
          species: 'Грызуны',
          supplierId: sup4.id,
          price: 5900,
          purchasePrice: 3400,
          stock: 3,
          minStock: 2,
          unit: 'особь',
          description:
            'Ручной декоративный кролик из сертифицированного питомника. Приучен к лотку и поилке, в комплекте ветеринарный паспорт с отметками о вакцинации.',
          specs: 'Возраст 2.5 мес · Ветпаспорт · Привит',
          imageUrl: '/src/assets/images/cat_animals_companion_1795537999424.jpg',
        },
        {
          sku: 'AN-6002',
          name: 'Волнистый попугай (небесно-голубой окрас)',
          category: 'animals',
          species: 'Птицы',
          supplierId: sup4.id,
          price: 2600,
          purchasePrice: 1350,
          stock: 7,
          minStock: 3,
          unit: 'особь',
          description:
            'Молодой активный попугай домашнего разведения, прошёл карантин и осмотр орнитолога. Легко идёт на контакт и быстро обучается речи.',
          specs: 'Возраст 3 мес · Осмотр орнитолога · Окольцован',
          imageUrl: '/src/assets/images/cat_animals_companion_1795537999424.jpg',
        },
      ])
      .returning();

    // Seed sample customer profile for historical orders (role = customer so first real login still gets admin)
    await tx
      .insert(users)
      .values({
        uid: 'seed-customer-demo',
        email: 'customer.demo@lapadom.ru',
        displayName: 'Марина Кузнецова',
        role: 'customer',
      })
      .onConflictDoNothing();

    const p1 = insertedProducts[0];
    const p2 = insertedProducts[1];
    const p3 = insertedProducts[2];
    const p8 = insertedProducts[7];
    const p9 = insertedProducts[8];

    const insertedOrders = await tx
      .insert(orders)
      .values([
        {
          orderNumber: 'ЗМ-1041',
          userUid: 'seed-customer-demo',
          customerName: 'Марина Кузнецова',
          customerPhone: '+7 (916) 442-19-08',
          deliveryAddress: 'г. Москва, ул. Покровка, д. 28, кв. 14',
          paymentMethod: 'Онлайн-оплата',
          status: 'Доставлен',
          totalAmount: 5050,
        },
        {
          orderNumber: 'ЗМ-1042',
          userUid: 'seed-customer-demo',
          customerName: 'Артём Соловьёв',
          customerPhone: '+7 (903) 781-55-20',
          deliveryAddress: 'г. Москва, Ленинградский пр-т, д. 62, кв. 89',
          paymentMethod: 'Картой при получении',
          status: 'Выполнен',
          totalAmount: 4840,
        },
      ])
      .returning();

    await tx.insert(orderItems).values([
      {
        orderId: insertedOrders[0].id,
        productId: p1.id,
        sku: p1.sku,
        productName: p1.name,
        category: p1.category,
        quantity: 1,
        unitPrice: p1.price,
        subtotal: p1.price,
      },
      {
        orderId: insertedOrders[0].id,
        productId: p3.id,
        sku: p3.sku,
        productName: p3.name,
        category: p3.category,
        quantity: 2,
        unitPrice: p3.price,
        subtotal: p3.price * 2,
      },
      {
        orderId: insertedOrders[1].id,
        productId: p2.id,
        sku: p2.sku,
        productName: p2.name,
        category: p2.category,
        quantity: 1,
        unitPrice: p2.price,
        subtotal: p2.price,
      },
      {
        orderId: insertedOrders[1].id,
        productId: p8.id,
        sku: p8.sku,
        productName: p8.name,
        category: p8.category,
        quantity: 1,
        unitPrice: p8.price,
        subtotal: p8.price,
      },
    ]);

    await tx.insert(stockMovements).values([
      {
        productId: p1.id,
        productName: p1.name,
        sku: p1.sku,
        type: 'Приход от поставщика',
        delta: 25,
        balanceAfter: 25,
        supplierId: sup1.id,
        supplierName: sup1.name,
        note: 'Плановая поставка по накладной №412',
      },
      {
        productId: p1.id,
        productName: p1.name,
        sku: p1.sku,
        type: 'Продажа',
        delta: -1,
        balanceAfter: 24,
        note: 'Заказ ЗМ-1041 (Марина Кузнецова)',
      },
      {
        productId: p2.id,
        productName: p2.name,
        sku: p2.sku,
        type: 'Продажа',
        delta: -1,
        balanceAfter: 6,
        note: 'Заказ ЗМ-1042 (Артём Соловьёв)',
      },
      {
        productId: p9.id,
        productName: p9.name,
        sku: p9.sku,
        type: 'Приход от поставщика',
        delta: 5,
        balanceAfter: 5,
        supplierId: sup3.id,
        supplierName: sup3.name,
        note: 'Первичная приёмка коллекции «Сканди»',
      },
    ]);
  });
}

export async function listProducts(includeWholesale: boolean): Promise<Product[]> {
  try {
    await ensureSeeded();
    const rows = await db
      .select({
        product: products,
        supplierName: suppliers.name,
      })
      .from(products)
      .leftJoin(suppliers, eq(products.supplierId, suppliers.id))
      .orderBy(desc(products.id));

    return rows.map((r) =>
      toProduct(r.product, r.supplierName ?? undefined, includeWholesale),
    );
  } catch (error) {
    console.error('Database query failed in listProducts:', error);
    throw new Error('Не удалось загрузить каталог товаров.', { cause: error });
  }
}

export async function createProduct(input: {
  sku: string;
  name: string;
  category: CategoryId;
  species: PetSpecies;
  supplierId: number;
  price: number;
  purchasePrice: number;
  stock: number;
  minStock: number;
  unit: string;
  description: string;
  specs: string;
  imageUrl: string;
}): Promise<Product> {
  try {
    await ensureSeeded();
    return await db.transaction(async (tx) => {
      const supRows = await tx
        .select()
        .from(suppliers)
        .where(eq(suppliers.id, input.supplierId))
        .limit(1);
      if (supRows.length === 0) {
        throw new Error('SUPPLIER_NOT_FOUND');
      }

      const existingSku = await tx
        .select({ id: products.id })
        .from(products)
        .where(eq(products.sku, input.sku))
        .limit(1);
      if (existingSku.length > 0) {
        throw new Error('DUPLICATE_SKU');
      }

      const supplier = supRows[0];
      const inserted = await tx
        .insert(products)
        .values({
          sku: input.sku,
          name: input.name,
          category: input.category,
          species: input.species,
          supplierId: supplier.id,
          price: input.price,
          purchasePrice: input.purchasePrice,
          stock: input.stock,
          minStock: input.minStock,
          unit: input.unit,
          description: input.description || `${input.name}. Поставка от ${supplier.name}.`,
          specs: input.specs || `${input.species} · ${input.unit}`,
          imageUrl: input.imageUrl,
        })
        .returning();

      const created = inserted[0];

      if (input.stock > 0) {
        await tx.insert(stockMovements).values({
          productId: created.id,
          productName: created.name,
          sku: created.sku,
          type: 'Приход от поставщика',
          delta: input.stock,
          balanceAfter: input.stock,
          supplierId: supplier.id,
          supplierName: supplier.name,
          note: 'Первичная приёмка товара на склад',
        });
      }

      return toProduct(created, supplier.name, true);
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
}

export async function adjustProductStock(input: {
  productId: number;
  delta: number;
  type: StockMovementType;
  supplierId?: number;
  note: string;
}): Promise<{ product: Product; movement: StockMovement }> {
  try {
    await ensureSeeded();
    return await db.transaction(async (tx) => {
      const prodRows = await tx
        .select()
        .from(products)
        .where(eq(products.id, input.productId))
        .limit(1);
      if (prodRows.length === 0) {
        throw new Error('PRODUCT_NOT_FOUND');
      }
      const prod = prodRows[0];
      const nextStock = prod.stock + input.delta;
      if (nextStock < 0) {
        throw new Error(`INSUFFICIENT_STOCK:${prod.stock}:${prod.unit}`);
      }

      const targetSupplierId = input.supplierId ?? prod.supplierId;
      const supRows = await tx
        .select()
        .from(suppliers)
        .where(eq(suppliers.id, targetSupplierId))
        .limit(1);
      const supplier = supRows[0];

      const updatedRows = await tx
        .update(products)
        .set({ stock: nextStock, updatedAt: new Date() })
        .where(eq(products.id, prod.id))
        .returning();

      const movRows = await tx
        .insert(stockMovements)
        .values({
          productId: prod.id,
          productName: prod.name,
          sku: prod.sku,
          type: input.type,
          delta: input.delta,
          balanceAfter: nextStock,
          supplierId: input.type === 'Приход от поставщика' ? supplier?.id : null,
          supplierName: input.type === 'Приход от поставщика' ? supplier?.name : null,
          note:
            input.note ||
            (input.type === 'Приход от поставщика'
              ? `Поставка от ${supplier?.name ?? 'поставщика'}`
              : 'Ручная корректировка остатка'),
        })
        .returning();

      const prodSupplierRows = await tx
        .select({ name: suppliers.name })
        .from(suppliers)
        .where(eq(suppliers.id, updatedRows[0].supplierId))
        .limit(1);

      return {
        product: toProduct(updatedRows[0], prodSupplierRows[0]?.name, true),
        movement: toMovement(movRows[0]),
      };
    });
  } catch (error) {
    if (
      error instanceof Error &&
      (error.message === 'PRODUCT_NOT_FOUND' ||
        error.message.startsWith('INSUFFICIENT_STOCK:'))
    ) {
      throw error;
    }
    console.error('Database query failed in adjustProductStock:', error);
    throw new Error('Не удалось обновить остаток товара.', { cause: error });
  }
}

export async function listSuppliers(): Promise<Supplier[]> {
  try {
    await ensureSeeded();
    const rows = await db.select().from(suppliers).orderBy(desc(suppliers.id));
    return rows.map(toSupplier);
  } catch (error) {
    console.error('Database query failed in listSuppliers:', error);
    throw new Error('Не удалось загрузить список поставщиков.', { cause: error });
  }
}

export async function createSupplier(input: {
  name: string;
  contactPerson: string;
  phone: string;
  email: string;
  city: string;
  leadTimeDays: number;
  categories: CategoryId[];
  notes: string;
}): Promise<Supplier> {
  try {
    await ensureSeeded();
    const inserted = await db
      .insert(suppliers)
      .values({
        name: input.name,
        contactPerson: input.contactPerson,
        phone: input.phone,
        email: input.email,
        city: input.city,
        leadTimeDays: input.leadTimeDays,
        categories: input.categories,
        notes: input.notes,
      })
      .returning();
    return toSupplier(inserted[0]);
  } catch (error) {
    console.error('Database query failed in createSupplier:', error);
    throw new Error('Не удалось создать поставщика.', { cause: error });
  }
}

export async function updateSupplier(
  id: number,
  input: {
    name: string;
    contactPerson: string;
    phone: string;
    email: string;
    city: string;
    leadTimeDays: number;
    categories: CategoryId[];
    notes: string;
  },
): Promise<Supplier | null> {
  try {
    await ensureSeeded();
    const updated = await db
      .update(suppliers)
      .set({
        name: input.name,
        contactPerson: input.contactPerson,
        phone: input.phone,
        email: input.email,
        city: input.city,
        leadTimeDays: input.leadTimeDays,
        categories: input.categories,
        notes: input.notes,
      })
      .where(eq(suppliers.id, id))
      .returning();
    return updated.length > 0 ? toSupplier(updated[0]) : null;
  } catch (error) {
    console.error('Database query failed in updateSupplier:', error);
    throw new Error('Не удалось обновить поставщика.', { cause: error });
  }
}

export async function listOrders(): Promise<Order[]> {
  try {
    await ensureSeeded();
    const orderRows = await db.select().from(orders).orderBy(desc(orders.id));
    if (orderRows.length === 0) return [];

    const orderIds = orderRows.map((o) => o.id);
    const itemsRows = await db
      .select()
      .from(orderItems)
      .where(inArray(orderItems.orderId, orderIds));

    const itemsByOrder = new Map<number, typeof itemsRows>();
    for (const item of itemsRows) {
      const list = itemsByOrder.get(item.orderId) ?? [];
      list.push(item);
      itemsByOrder.set(item.orderId, list);
    }

    return orderRows.map((o) => ({
      id: o.id,
      orderNumber: o.orderNumber,
      userUid: o.userUid,
      customerName: o.customerName,
      customerPhone: o.customerPhone,
      deliveryAddress: o.deliveryAddress,
      paymentMethod: o.paymentMethod,
      status: o.status,
      totalAmount: o.totalAmount,
      createdAt: o.createdAt.toISOString(),
      items: (itemsByOrder.get(o.id) ?? []).map((it) => ({
        id: it.id,
        productId: it.productId,
        sku: it.sku,
        productName: it.productName,
        category: it.category,
        quantity: it.quantity,
        unitPrice: it.unitPrice,
        subtotal: it.subtotal,
      })),
    }));
  } catch (error) {
    console.error('Database query failed in listOrders:', error);
    throw new Error('Не удалось загрузить историю заказов.', { cause: error });
  }
}

export async function createOrder(input: {
  userUid: string;
  customerName: string;
  customerPhone: string;
  deliveryAddress: string;
  paymentMethod: PaymentMethod;
  items: { productId: number; quantity: number }[];
}): Promise<Order> {
  try {
    await ensureSeeded();
    return await db.transaction(async (tx) => {
      const productIds = input.items.map((i) => i.productId);
      const dbProducts = await tx
        .select()
        .from(products)
        .where(inArray(products.id, productIds));

      const prodMap = new Map(dbProducts.map((p) => [p.id, p]));

      const preparedItems: {
        product: typeof products.$inferSelect;
        quantity: number;
        subtotal: number;
      }[] = [];

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
        preparedItems.push({
          product,
          quantity: reqItem.quantity,
          subtotal: product.price * reqItem.quantity,
        });
      }

      const maxIdRows = await tx
        .select({ maxId: sql<number>`coalesce(max(${orders.id}), 0)` })
        .from(orders);
      const nextNum = 1043 + Number(maxIdRows[0]?.maxId ?? 0);
      const orderNumber = `ЗМ-${nextNum}`;
      const totalAmount = preparedItems.reduce((s, it) => s + it.subtotal, 0);

      const insertedOrders = await tx
        .insert(orders)
        .values({
          orderNumber,
          userUid: input.userUid,
          customerName: input.customerName,
          customerPhone: input.customerPhone,
          deliveryAddress: input.deliveryAddress,
          paymentMethod: input.paymentMethod,
          status: 'В обработке',
          totalAmount,
        })
        .returning();

      const createdOrder = insertedOrders[0];

      const insertedItems = await tx
        .insert(orderItems)
        .values(
          preparedItems.map((it) => ({
            orderId: createdOrder.id,
            productId: it.product.id,
            sku: it.product.sku,
            productName: it.product.name,
            category: it.product.category,
            quantity: it.quantity,
            unitPrice: it.product.price,
            subtotal: it.subtotal,
          })),
        )
        .returning();

      for (const it of preparedItems) {
        const nextStock = it.product.stock - it.quantity;
        await tx
          .update(products)
          .set({ stock: nextStock, updatedAt: new Date() })
          .where(eq(products.id, it.product.id));

        await tx.insert(stockMovements).values({
          productId: it.product.id,
          productName: it.product.name,
          sku: it.product.sku,
          type: 'Продажа',
          delta: -it.quantity,
          balanceAfter: nextStock,
          note: `Заказ ${orderNumber} (${input.customerName})`,
        });
      }

      return {
        id: createdOrder.id,
        orderNumber: createdOrder.orderNumber,
        userUid: createdOrder.userUid,
        customerName: createdOrder.customerName,
        customerPhone: createdOrder.customerPhone,
        deliveryAddress: createdOrder.deliveryAddress,
        paymentMethod: createdOrder.paymentMethod,
        status: createdOrder.status,
        totalAmount: createdOrder.totalAmount,
        createdAt: createdOrder.createdAt.toISOString(),
        items: insertedItems.map((it) => ({
          id: it.id,
          productId: it.productId,
          sku: it.sku,
          productName: it.productName,
          category: it.category,
          quantity: it.quantity,
          unitPrice: it.unitPrice,
          subtotal: it.subtotal,
        })),
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
}

export async function updateOrderStatus(
  orderId: number,
  nextStatus: OrderStatus,
): Promise<Order | null> {
  try {
    await ensureSeeded();
    return await db.transaction(async (tx) => {
      const orderRows = await tx
        .select()
        .from(orders)
        .where(eq(orders.id, orderId))
        .limit(1);
      if (orderRows.length === 0) return null;

      const order = orderRows[0];
      const itemsRows = await tx
        .select()
        .from(orderItems)
        .where(eq(orderItems.orderId, order.id));

      const prevStatus = order.status;
      if (prevStatus !== nextStatus) {
        if (nextStatus === 'Отменён' && prevStatus !== 'Отменён') {
          for (const item of itemsRows) {
            const prodRows = await tx
              .select()
              .from(products)
              .where(eq(products.id, item.productId))
              .limit(1);
            if (prodRows.length === 0) continue;
            const nextStock = prodRows[0].stock + item.quantity;
            await tx
              .update(products)
              .set({ stock: nextStock, updatedAt: new Date() })
              .where(eq(products.id, item.productId));

            await tx.insert(stockMovements).values({
              productId: item.productId,
              productName: item.productName,
              sku: item.sku,
              type: 'Корректировка',
              delta: item.quantity,
              balanceAfter: nextStock,
              note: `Возврат на склад по отменённому заказу ${order.orderNumber}`,
            });
          }
        } else if (prevStatus === 'Отменён' && nextStatus !== 'Отменён') {
          for (const item of itemsRows) {
            const prodRows = await tx
              .select()
              .from(products)
              .where(eq(products.id, item.productId))
              .limit(1);
            if (prodRows.length === 0 || prodRows[0].stock < item.quantity) {
              throw new Error(`INSUFFICIENT_RESUME:${item.productName}`);
            }
          }
          for (const item of itemsRows) {
            const prodRows = await tx
              .select()
              .from(products)
              .where(eq(products.id, item.productId))
              .limit(1);
            if (prodRows.length === 0) continue;
            const nextStock = prodRows[0].stock - item.quantity;
            await tx
              .update(products)
              .set({ stock: nextStock, updatedAt: new Date() })
              .where(eq(products.id, item.productId));

            await tx.insert(stockMovements).values({
              productId: item.productId,
              productName: item.productName,
              sku: item.sku,
              type: 'Продажа',
              delta: -item.quantity,
              balanceAfter: nextStock,
              note: `Повторное проведение заказа ${order.orderNumber}`,
            });
          }
        }

        await tx
          .update(orders)
          .set({ status: nextStatus })
          .where(eq(orders.id, order.id));
      }

      return {
        id: order.id,
        orderNumber: order.orderNumber,
        userUid: order.userUid,
        customerName: order.customerName,
        customerPhone: order.customerPhone,
        deliveryAddress: order.deliveryAddress,
        paymentMethod: order.paymentMethod,
        status: nextStatus,
        totalAmount: order.totalAmount,
        createdAt: order.createdAt.toISOString(),
        items: itemsRows.map((it) => ({
          id: it.id,
          productId: it.productId,
          sku: it.sku,
          productName: it.productName,
          category: it.category,
          quantity: it.quantity,
          unitPrice: it.unitPrice,
          subtotal: it.subtotal,
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
}

export async function listStockMovements(): Promise<StockMovement[]> {
  try {
    await ensureSeeded();
    const rows = await db
      .select()
      .from(stockMovements)
      .orderBy(desc(stockMovements.id))
      .limit(100);
    return rows.map(toMovement);
  } catch (error) {
    console.error('Database query failed in listStockMovements:', error);
    throw new Error('Не удалось загрузить журнал движения товаров.', { cause: error });
  }
}
