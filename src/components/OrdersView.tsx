import { useMemo, useState } from 'react';
import { Search, RotateCcw, ChevronDown, ChevronUp } from 'lucide-react';
import type { Order, OrderStatus } from '../types';
import { CATEGORY_LABELS } from '../types';
import { formatDateRu, formatRub } from '../utils/format';

interface OrdersViewProps {
  orders: Order[];
  onUpdateStatus: (orderId: number, nextStatus: OrderStatus) => Promise<void>;
  onRepeatOrder: (order: Order) => void;
}

const ORDER_STATUSES: OrderStatus[] = [
  'В обработке',
  'Выполнен',
  'Доставлен',
  'Отменён',
];

export function OrdersView({
  orders,
  onUpdateStatus,
  onRepeatOrder,
}: OrdersViewProps) {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | OrderStatus>('all');
  const [expandedId, setExpandedId] = useState<number | null>(orders[0]?.id ?? null);
  const [updatingId, setUpdatingId] = useState<number | null>(null);
  const [statusError, setStatusError] = useState<string | null>(null);

  const filteredOrders = useMemo(() => {
    const q = search.trim().toLowerCase();
    return orders.filter((order) => {
      if (statusFilter !== 'all' && order.status !== statusFilter) return false;
      if (q) {
        const itemsText = order.items.map((i) => `${i.productName} ${i.sku}`).join(' ');
        const hay = `${order.orderNumber} ${order.customerName} ${order.customerPhone} ${itemsText}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [orders, statusFilter, search]);

  const metrics = useMemo(() => {
    const activeOrders = orders.filter((o) => o.status !== 'Отменён');
    const revenue = activeOrders.reduce((sum, o) => sum + o.totalAmount, 0);
    const avgCheck = activeOrders.length > 0 ? revenue / activeOrders.length : 0;
    const processing = orders.filter((o) => o.status === 'В обработке').length;
    return { total: orders.length, revenue, avgCheck, processing };
  }, [orders]);

  async function handleStatusChange(orderId: number, nextStatus: OrderStatus) {
    setStatusError(null);
    setUpdatingId(orderId);
    try {
      await onUpdateStatus(orderId, nextStatus);
    } catch (err) {
      setStatusError(err instanceof Error ? err.message : 'Не удалось изменить статус');
    } finally {
      setUpdatingId(null);
    }
  }

  return (
    <div className="space-y-10">
      <div className="border-b border-zinc-200 pb-6">
        <h1 className="font-display text-2xl sm:text-3xl font-semibold text-zinc-900">
          История покупок и заказов
        </h1>
        <p className="mt-1 text-sm text-zinc-600">
          Все оформленные покупки, товарные чеки, управление статусами доставки и быстрый повтор заказа.
        </p>
      </div>

      {/* Metrics Strip */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-6 border-b border-zinc-200 pb-8">
        <div>
          <div className="text-xs text-zinc-500">Всего заказов</div>
          <div className="mt-1 font-display text-2xl font-semibold tabular-nums text-zinc-900">
            {metrics.total}
          </div>
        </div>
        <div>
          <div className="text-xs text-zinc-500">Общая выручка</div>
          <div className="mt-1 font-display text-2xl font-semibold tabular-nums text-zinc-900">
            {formatRub(metrics.revenue)}
          </div>
        </div>
        <div>
          <div className="text-xs text-zinc-500">Средний чек</div>
          <div className="mt-1 font-display text-2xl font-semibold tabular-nums text-zinc-900">
            {formatRub(metrics.avgCheck)}
          </div>
        </div>
        <div>
          <div className="text-xs text-zinc-500">Ожидают сборки</div>
          <div className="mt-1 font-display text-2xl font-semibold tabular-nums text-amber-700">
            {metrics.processing}
          </div>
        </div>
      </div>

      {statusError && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          {statusError}
        </div>
      )}

      {/* Filter & Search Bar */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="inline-flex flex-wrap items-center gap-1 bg-zinc-200/70 p-1 rounded-lg w-fit">
          <button
            type="button"
            onClick={() => setStatusFilter('all')}
            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
              statusFilter === 'all'
                ? 'bg-white text-zinc-900 shadow-sm'
                : 'text-zinc-600 hover:text-zinc-900'
            }`}
          >
            Все
          </button>
          {ORDER_STATUSES.map((st) => (
            <button
              key={st}
              type="button"
              onClick={() => setStatusFilter(st)}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
                statusFilter === st
                  ? 'bg-white text-zinc-900 shadow-sm'
                  : 'text-zinc-600 hover:text-zinc-900'
              }`}
            >
              {st}
            </button>
          ))}
        </div>

        <div className="relative w-full lg:w-80">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Номер заказа, клиент, товар..."
            className="w-full rounded-lg border border-zinc-300 bg-white pl-9 pr-3 py-2 text-sm text-zinc-900 placeholder:text-zinc-400 focus:border-emerald-900 focus:outline-none"
          />
        </div>
      </div>

      {/* Orders List */}
      {filteredOrders.length === 0 ? (
        <div className="rounded-xl border border-zinc-200 bg-white p-12 text-center space-y-2">
          <p className="font-display text-base font-medium text-zinc-900">
            Заказы не найдены
          </p>
          <p className="text-sm text-zinc-500">
            Попробуйте изменить фильтр статуса или поисковый запрос.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {filteredOrders.map((order) => {
            const isExpanded = expandedId === order.id;
            const statusColor =
              order.status === 'Доставлен' || order.status === 'Выполнен'
                ? 'text-emerald-800'
                : order.status === 'В обработке'
                  ? 'text-amber-700'
                  : 'text-red-700';

            return (
              <article
                key={order.id}
                className="rounded-xl border border-zinc-200 bg-white overflow-hidden"
              >
                <div className="p-5 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                  <div className="space-y-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2 text-xs text-zinc-500">
                      <span className="font-mono font-semibold text-zinc-900">
                        {order.orderNumber}
                      </span>
                      <span aria-hidden="true">·</span>
                      <span className="tabular-nums">{formatDateRu(order.createdAt)}</span>
                      <span aria-hidden="true">·</span>
                      <span className={`font-medium ${statusColor}`}>{order.status}</span>
                    </div>
                    <div className="font-display text-base font-semibold text-zinc-900">
                      {order.customerName}
                      <span className="font-sans text-sm font-normal text-zinc-500 ml-2">
                        {order.customerPhone}
                      </span>
                    </div>
                    <div className="text-xs text-zinc-500 truncate">
                      {order.deliveryAddress} · {order.paymentMethod}
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-3 shrink-0">
                    <div className="text-right mr-2">
                      <div className="font-mono tabular-nums text-lg font-semibold text-zinc-900">
                        {formatRub(order.totalAmount)}
                      </div>
                      <div className="text-xs text-zinc-500 tabular-nums">
                        Позиций: {order.items.reduce((s, i) => s + i.quantity, 0)}
                      </div>
                    </div>

                    <select
                      aria-label={`Статус заказа ${order.orderNumber}`}
                      value={order.status}
                      disabled={updatingId === order.id}
                      onChange={(e) =>
                        handleStatusChange(order.id, e.target.value as OrderStatus)
                      }
                      className="rounded-lg border border-zinc-300 bg-white px-3 py-2 text-xs font-medium text-zinc-800 focus:border-emerald-900 focus:outline-none"
                    >
                      {ORDER_STATUSES.map((st) => (
                        <option key={st} value={st}>
                          {st}
                        </option>
                      ))}
                    </select>

                    <button
                      type="button"
                      onClick={() => onRepeatOrder(order)}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-300 bg-white px-3 py-2 text-xs font-medium text-zinc-800 hover:bg-zinc-50 transition-colors whitespace-nowrap"
                    >
                      <RotateCcw className="h-3.5 w-3.5" />
                      <span>Повторить</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setExpandedId(isExpanded ? null : order.id)}
                      className="inline-flex items-center gap-1 rounded-lg border border-zinc-200 px-3 py-2 text-xs font-medium text-zinc-600 hover:bg-zinc-50 transition-colors whitespace-nowrap"
                    >
                      <span>Состав</span>
                      {isExpanded ? (
                        <ChevronUp className="h-3.5 w-3.5" />
                      ) : (
                        <ChevronDown className="h-3.5 w-3.5" />
                      )}
                    </button>
                  </div>
                </div>

                {isExpanded && (
                  <div className="border-t border-zinc-200 bg-zinc-50/60 px-5 py-4">
                    <table className="w-full text-left text-xs border-collapse">
                      <thead>
                        <tr className="border-b border-zinc-200 text-zinc-500">
                          <th className="py-2 pr-4 font-medium">Артикул</th>
                          <th className="py-2 pr-4 font-medium">Наименование</th>
                          <th className="py-2 pr-4 font-medium">Категория</th>
                          <th className="py-2 pr-4 text-right font-medium">Кол-во</th>
                          <th className="py-2 pr-4 text-right font-medium">Цена</th>
                          <th className="py-2 text-right font-medium">Сумма</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-zinc-200/80">
                        {order.items.map((item) => (
                          <tr key={item.productId}>
                            <td className="py-2.5 pr-4 font-mono text-zinc-500 whitespace-nowrap">
                              {item.sku}
                            </td>
                            <td className="py-2.5 pr-4 font-medium text-zinc-900">
                              {item.productName}
                            </td>
                            <td className="py-2.5 pr-4 text-zinc-600 whitespace-nowrap">
                              {CATEGORY_LABELS[item.category]}
                            </td>
                            <td className="py-2.5 pr-4 text-right font-mono tabular-nums text-zinc-800">
                              {item.quantity}
                            </td>
                            <td className="py-2.5 pr-4 text-right font-mono tabular-nums text-zinc-600">
                              {formatRub(item.unitPrice)}
                            </td>
                            <td className="py-2.5 text-right font-mono tabular-nums font-semibold text-zinc-900">
                              {formatRub(item.subtotal)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
