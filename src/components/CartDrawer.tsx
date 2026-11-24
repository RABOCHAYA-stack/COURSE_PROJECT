import { useEffect, useState } from 'react';
import { X, Plus, Minus, Trash2, CheckCircle2, ArrowRight, LogIn } from 'lucide-react';
import type { Order, PaymentMethod, Product } from '../types';
import { CATEGORY_LABELS } from '../types';
import { formatRub } from '../utils/format';
import { ResilientImage } from './ResilientImage';

export interface CartEntry {
  product: Product;
  quantity: number;
}

interface CartDrawerProps {
  open: boolean;
  items: CartEntry[];
  isAuthenticated: boolean;
  isAdmin: boolean;
  defaultCustomerName?: string;
  authBusy: boolean;
  onSignIn: () => Promise<void>;
  onClose: () => void;
  onUpdateQty: (productId: number, nextQty: number) => void;
  onRemove: (productId: number) => void;
  onSubmitOrder: (payload: {
    customerName: string;
    customerPhone: string;
    deliveryAddress: string;
    paymentMethod: PaymentMethod;
  }) => Promise<Order>;
  onGoToOrders: () => void;
}

const PAYMENT_OPTIONS: PaymentMethod[] = [
  'Картой при получении',
  'Онлайн-оплата',
  'Наличными курьеру',
];

export function CartDrawer({
  open,
  items,
  isAuthenticated,
  isAdmin,
  defaultCustomerName = '',
  authBusy,
  onSignIn,
  onClose,
  onUpdateQty,
  onRemove,
  onSubmitOrder,
  onGoToOrders,
}: CartDrawerProps) {
  const [customerName, setCustomerName] = useState(defaultCustomerName);
  const [customerPhone, setCustomerPhone] = useState('');
  const [deliveryAddress, setDeliveryAddress] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('Картой при получении');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [completedOrder, setCompletedOrder] = useState<Order | null>(null);

  useEffect(() => {
    if (defaultCustomerName && !customerName) {
      setCustomerName(defaultCustomerName);
    }
  }, [defaultCustomerName, customerName]);

  if (!open) return null;

  const subtotal = items.reduce(
    (sum, entry) => sum + entry.product.price * entry.quantity,
    0,
  );
  const freeDeliveryThreshold = 3000;
  const remainingForFreeDelivery = Math.max(0, freeDeliveryThreshold - subtotal);

  async function handleCheckout(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const created = await onSubmitOrder({
        customerName,
        customerPhone,
        deliveryAddress,
        paymentMethod,
      });
      setCompletedOrder(created);
      setCustomerPhone('');
      setDeliveryAddress('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось оформить заказ');
    } finally {
      setSubmitting(false);
    }
  }

  function handleCloseDrawer() {
    setCompletedOrder(null);
    setError(null);
    onClose();
  }

  return (
    <div
      className="fixed inset-0 z-50 flex justify-end bg-zinc-950/40 backdrop-blur-[2px]"
      role="dialog"
      aria-modal="true"
      aria-label="Корзина и оформление заказа"
    >
      <div className="absolute inset-0" onClick={handleCloseDrawer} />
      <aside className="relative z-10 flex h-full w-full max-w-lg flex-col bg-white border-l border-zinc-200 shadow-2xl">
        <div className="flex items-center justify-between border-b border-zinc-200 px-6 py-4">
          <h2 className="font-display text-lg font-semibold text-zinc-900">
            {completedOrder ? 'Заказ подтверждён' : 'Корзина покупок'}
          </h2>
          <button
            type="button"
            onClick={handleCloseDrawer}
            className="inline-flex h-10 w-10 items-center justify-center rounded-lg text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900 transition-colors"
            aria-label="Закрыть корзину"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-5">
          {completedOrder ? (
            <div className="space-y-6">
              <div className="border border-emerald-200 bg-emerald-50/60 rounded-xl p-5">
                <div className="flex items-start gap-3">
                  <CheckCircle2 className="h-6 w-6 text-emerald-800 shrink-0 mt-0.5" />
                  <div>
                    <p className="font-display text-base font-semibold text-zinc-900">
                      Заказ <span className="font-mono">{completedOrder.orderNumber}</span> принят в работу
                    </p>
                    <p className="mt-1 text-sm text-zinc-600">
                      Благодарим за покупку! Товары зарезервированы на складе и переданы в сборку.
                    </p>
                  </div>
                </div>
              </div>

              <div className="border border-zinc-200 rounded-xl divide-y divide-zinc-200">
                <div className="p-4 space-y-1 text-sm">
                  <div className="text-zinc-500">Получатель</div>
                  <div className="font-medium text-zinc-900">
                    {completedOrder.customerName} · {completedOrder.customerPhone}
                  </div>
                  <div className="text-zinc-600">{completedOrder.deliveryAddress}</div>
                  <div className="text-xs text-zinc-500 pt-1">
                    Оплата: {completedOrder.paymentMethod}
                  </div>
                </div>
                <div className="p-4 space-y-2.5">
                  {completedOrder.items.map((item) => (
                    <div
                      key={item.productId}
                      className="flex items-center justify-between text-sm gap-4"
                    >
                      <span className="text-zinc-700 truncate">
                        {item.productName}{' '}
                        <span className="text-zinc-400 font-mono">×{item.quantity}</span>
                      </span>
                      <span className="font-mono tabular-nums font-medium text-zinc-900 shrink-0">
                        {formatRub(item.subtotal)}
                      </span>
                    </div>
                  ))}
                </div>
                <div className="p-4 flex items-center justify-between bg-zinc-50 rounded-b-xl">
                  <span className="text-sm font-medium text-zinc-700">Итого к оплате</span>
                  <span className="font-mono tabular-nums text-lg font-semibold text-zinc-900">
                    {formatRub(completedOrder.totalAmount)}
                  </span>
                </div>
              </div>

              <div className="flex flex-col sm:flex-row gap-3">
                {isAdmin && (
                  <button
                    type="button"
                    onClick={() => {
                      handleCloseDrawer();
                      onGoToOrders();
                    }}
                    className="flex-1 inline-flex items-center justify-center gap-2 rounded-lg bg-emerald-900 px-4 py-2.5 text-sm font-medium text-white hover:bg-emerald-800 transition-colors whitespace-nowrap"
                  >
                    <span>Открыть историю покупок</span>
                    <ArrowRight className="h-4 w-4" />
                  </button>
                )}
                <button
                  type="button"
                  onClick={handleCloseDrawer}
                  className="flex-1 inline-flex items-center justify-center rounded-lg border border-zinc-300 px-4 py-2.5 text-sm font-medium text-zinc-700 hover:bg-zinc-50 transition-colors whitespace-nowrap"
                >
                  Вернуться в каталог
                </button>
              </div>
            </div>
          ) : items.length === 0 ? (
            <div className="py-16 text-center space-y-3">
              <p className="font-display text-base font-medium text-zinc-900">
                В корзине пока нет товаров
              </p>
              <p className="text-sm text-zinc-500 max-w-xs mx-auto">
                Выберите корма, лакомства, средства для ухода, ветпрепараты или аксессуары из каталога.
              </p>
            </div>
          ) : (
            <div className="space-y-6">
              <div className="border-b border-zinc-200 pb-3 text-xs text-zinc-600">
                {remainingForFreeDelivery === 0 ? (
                  <span className="text-emerald-800 font-medium">
                    Доставка бесплатно — сумма заказа превышает {formatRub(freeDeliveryThreshold)}
                  </span>
                ) : (
                  <span>
                    До бесплатной доставки добавьте товаров на{' '}
                    <span className="font-mono tabular-nums font-medium text-zinc-900">
                      {formatRub(remainingForFreeDelivery)}
                    </span>
                  </span>
                )}
              </div>

              <ul className="divide-y divide-zinc-200">
                {items.map(({ product, quantity }) => (
                  <li key={product.id} className="py-4 flex gap-4">
                    <ResilientImage
                      src={product.imageUrl}
                      alt={product.name}
                      className="h-20 w-24 rounded-lg object-cover bg-zinc-100 shrink-0"
                    />
                    <div className="flex-1 min-w-0">
                      <div className="text-xs text-zinc-500 truncate">
                        {CATEGORY_LABELS[product.category]} · {product.species}
                      </div>
                      <h3 className="text-sm font-semibold text-zinc-900 truncate mt-0.5">
                        {product.name}
                      </h3>
                      <div className="mt-1 flex items-center justify-between gap-2">
                        <span className="font-mono tabular-nums text-sm font-medium text-zinc-900">
                          {formatRub(product.price * quantity)}
                        </span>
                        <span className="text-xs text-zinc-500 tabular-nums">
                          Остаток: {product.stock}
                        </span>
                      </div>
                      <div className="mt-2.5 flex items-center justify-between">
                        <div className="inline-flex items-center border border-zinc-300 rounded-lg">
                          <button
                            type="button"
                            onClick={() => onUpdateQty(product.id, quantity - 1)}
                            className="inline-flex h-8 w-8 items-center justify-center text-zinc-600 hover:bg-zinc-100 rounded-l-lg transition-colors"
                            aria-label="Уменьшить количество"
                          >
                            <Minus className="h-3.5 w-3.5" />
                          </button>
                          <span className="px-3 text-xs font-mono tabular-nums font-medium text-zinc-900">
                            {quantity}
                          </span>
                          <button
                            type="button"
                            disabled={quantity >= product.stock}
                            onClick={() => onUpdateQty(product.id, quantity + 1)}
                            className="inline-flex h-8 w-8 items-center justify-center text-zinc-600 hover:bg-zinc-100 disabled:opacity-40 disabled:cursor-not-allowed rounded-r-lg transition-colors"
                            aria-label="Увеличить количество"
                          >
                            <Plus className="h-3.5 w-3.5" />
                          </button>
                        </div>
                        <button
                          type="button"
                          onClick={() => onRemove(product.id)}
                          className="inline-flex items-center gap-1 text-xs text-zinc-500 hover:text-red-700 transition-colors"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                          <span>Удалить</span>
                        </button>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>

              {!isAuthenticated ? (
                <div className="border-t border-zinc-200 pt-5 space-y-4">
                  <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-4 space-y-3">
                    <h3 className="font-display text-sm font-semibold text-zinc-900">
                      Войдите в аккаунт для оформления заказа
                    </h3>
                    <p className="text-xs text-zinc-600 leading-relaxed">
                      Выбрано товаров на сумму{' '}
                      <span className="font-mono tabular-nums font-semibold text-zinc-900">
                        {formatRub(subtotal)}
                      </span>
                      . Войдите через Google, чтобы подтвердить заказ и адрес доставки.
                    </p>
                    <button
                      type="button"
                      disabled={authBusy}
                      onClick={() => void onSignIn()}
                      className="w-full inline-flex items-center justify-center gap-2 rounded-lg bg-emerald-900 px-4 py-2.5 text-sm font-medium text-white hover:bg-emerald-800 disabled:opacity-60 transition-colors"
                    >
                      <LogIn className="h-4 w-4" />
                      <span>{authBusy ? 'Выполняется вход...' : 'Войти через Google'}</span>
                    </button>
                  </div>
                </div>
              ) : (
                <form onSubmit={handleCheckout} className="border-t border-zinc-200 pt-5 space-y-4">
                  <h3 className="font-display text-sm font-semibold text-zinc-900">
                    Данные для доставки и оплаты
                  </h3>

                  {error && (
                    <div className="rounded-lg border border-red-200 bg-red-50 px-3.5 py-2.5 text-xs text-red-800">
                      {error}
                    </div>
                  )}

                  <div className="space-y-3">
                    <div>
                      <label className="block text-xs font-medium text-zinc-700 mb-1">
                        Имя и фамилия
                      </label>
                      <input
                        type="text"
                        required
                        value={customerName}
                        onChange={(e) => setCustomerName(e.target.value)}
                        placeholder="Например, Анна Смирнова"
                        className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 focus:border-emerald-900 focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-zinc-700 mb-1">
                        Телефон
                      </label>
                      <input
                        type="tel"
                        required
                        value={customerPhone}
                        onChange={(e) => setCustomerPhone(e.target.value)}
                        placeholder="+7 (999) 123-45-67"
                        className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 focus:border-emerald-900 focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-zinc-700 mb-1">
                        Адрес доставки
                      </label>
                      <input
                        type="text"
                        required
                        value={deliveryAddress}
                        onChange={(e) => setDeliveryAddress(e.target.value)}
                        placeholder="Город, улица, дом, квартира"
                        className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 focus:border-emerald-900 focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-zinc-700 mb-1">
                        Способ оплаты
                      </label>
                      <select
                        value={paymentMethod}
                        onChange={(e) => setPaymentMethod(e.target.value as PaymentMethod)}
                        className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 focus:border-emerald-900 focus:outline-none"
                      >
                        {PAYMENT_OPTIONS.map((opt) => (
                          <option key={opt} value={opt}>
                            {opt}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div className="pt-2 space-y-3">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-zinc-600">Сумма заказа</span>
                      <span className="font-mono tabular-nums text-lg font-semibold text-zinc-900">
                        {formatRub(subtotal)}
                      </span>
                    </div>
                    <button
                      type="submit"
                      disabled={submitting}
                      className="w-full rounded-lg bg-emerald-900 px-4 py-3 text-sm font-medium text-white hover:bg-emerald-800 disabled:opacity-60 transition-colors whitespace-nowrap"
                    >
                      {submitting ? 'Оформление заказа...' : `Оформить заказ · ${formatRub(subtotal)}`}
                    </button>
                  </div>
                </form>
              )}
            </div>
          )}
        </div>
      </aside>
    </div>
  );
}
