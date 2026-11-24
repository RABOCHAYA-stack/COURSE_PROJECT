export type CategoryId =
  | 'animals'
  | 'supplies'
  | 'food'
  | 'care'
  | 'treats'
  | 'medicine';

export type AnimalSpecies =
  | 'Все'
  | 'Кошки'
  | 'Собаки'
  | 'Птицы'
  | 'Грызуны'
  | 'Рыбки';

export type PetSpecies = Exclude<AnimalSpecies, 'Все'>;

export type UserRole = 'admin' | 'customer';

export interface UserAccount {
  id: number;
  uid: string;
  email: string;
  displayName: string;
  role: UserRole;
  createdAt: string;
}

export interface CategoryMeta {
  id: CategoryId;
  label: string;
  description: string;
}

export const CATEGORIES: CategoryMeta[] = [
  {
    id: 'animals',
    label: 'Животные',
    description: 'Здоровые питомцы с ветпаспортом и рекомендациями по содержанию',
  },
  {
    id: 'supplies',
    label: 'Товары для животных',
    description: 'Лежанки, переноски, когтеточки, миски, игрушки и амуниция',
  },
  {
    id: 'food',
    label: 'Корма',
    description: 'Сбалансированные сухие и влажные рационы класса холистик и супер-премиум',
  },
  {
    id: 'care',
    label: 'Средства для ухода',
    description: 'Шампуни, расчески, гигиенические наполнители и уход за шерстью',
  },
  {
    id: 'treats',
    label: 'Лакомства',
    description: 'Натуральные сушеные снеки, косточки и поощрение для дрессировки',
  },
  {
    id: 'medicine',
    label: 'Лекарства',
    description: 'Ветеринарная аптека: витамины, пробиотики, защита от паразитов',
  },
];

export const CATEGORY_LABELS: Record<CategoryId, string> = {
  animals: 'Животные',
  supplies: 'Товары для животных',
  food: 'Корма',
  care: 'Средства для ухода',
  treats: 'Лакомства',
  medicine: 'Лекарства',
};

export interface Supplier {
  id: number;
  name: string;
  contactPerson: string;
  phone: string;
  email: string;
  city: string;
  leadTimeDays: number;
  categories: CategoryId[];
  notes: string;
  createdAt: string;
}

export interface Product {
  id: number;
  sku: string;
  name: string;
  category: CategoryId;
  species: PetSpecies;
  supplierId: number;
  supplierName?: string;
  price: number;
  purchasePrice: number;
  stock: number;
  minStock: number;
  unit: string;
  description: string;
  specs: string;
  imageUrl: string;
  updatedAt: string;
}

export type OrderStatus = 'В обработке' | 'Выполнен' | 'Доставлен' | 'Отменён';

export type PaymentMethod =
  | 'Картой при получении'
  | 'Наличными курьеру'
  | 'Онлайн-оплата';

export interface OrderItem {
  id?: number;
  productId: number;
  sku: string;
  productName: string;
  category: CategoryId;
  quantity: number;
  unitPrice: number;
  subtotal: number;
}

export interface Order {
  id: number;
  orderNumber: string;
  userUid: string;
  customerName: string;
  customerPhone: string;
  deliveryAddress: string;
  paymentMethod: PaymentMethod;
  status: OrderStatus;
  items: OrderItem[];
  totalAmount: number;
  createdAt: string;
}

export type StockMovementType =
  | 'Приход от поставщика'
  | 'Продажа'
  | 'Корректировка'
  | 'Списание';

export interface StockMovement {
  id: number;
  productId: number;
  productName: string;
  sku: string;
  type: StockMovementType;
  delta: number;
  balanceAfter: number;
  supplierId?: number | null;
  supplierName?: string | null;
  note: string;
  createdAt: string;
}
