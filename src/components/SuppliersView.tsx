import { useMemo, useState } from 'react';
import { Plus, Search, X, Truck, Pencil } from 'lucide-react';
import type { CategoryId, Product, StockMovementType, Supplier } from '../types';
import { CATEGORIES, CATEGORY_LABELS } from '../types';

interface SuppliersViewProps {
  suppliers: Supplier[];
  products: Product[];
  onCreateSupplier: (payload: Omit<Supplier, 'id' | 'createdAt'>) => Promise<void>;
  onUpdateSupplier: (id: number, payload: Omit<Supplier, 'id' | 'createdAt'>) => Promise<void>;
  onRestockProduct: (payload: {
    productId: number;
    delta: number;
    type: StockMovementType;
    supplierId?: number;
    note: string;
  }) => Promise<void>;
}

export function SuppliersView({
  suppliers,
  products,
  onCreateSupplier,
  onUpdateSupplier,
  onRestockProduct,
}: SuppliersViewProps) {
  const [search, setSearch] = useState('');
  const [editingSupplier, setEditingSupplier] = useState<Supplier | null>(null);
  const [showSupplierModal, setShowSupplierModal] = useState(false);

  const [name, setName] = useState('');
  const [contactPerson, setContactPerson] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [city, setCity] = useState('Москва');
  const [leadTimeDays, setLeadTimeDays] = useState('2');
  const [selectedCats, setSelectedCats] = useState<CategoryId[]>(['food']);
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const [restockSupplier, setRestockSupplier] = useState<Supplier | null>(null);
  const [restockProductId, setRestockProductId] = useState<number>(0);
  const [restockQty, setRestockQty] = useState('10');
  const [restockNote, setRestockNote] = useState('');
  const [restockSubmitting, setRestockSubmitting] = useState(false);
  const [restockError, setRestockError] = useState<string | null>(null);

  const productsBySupplier = useMemo(() => {
    const map = new Map<number, Product[]>();
    for (const p of products) {
      const list = map.get(p.supplierId) ?? [];
      list.push(p);
      map.set(p.supplierId, list);
    }
    return map;
  }, [products]);

  const filteredSuppliers = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return suppliers;
    return suppliers.filter((s) => {
      const catsText = s.categories.map((c) => CATEGORY_LABELS[c]).join(' ');
      return `${s.name} ${s.contactPerson} ${s.city} ${catsText}`.toLowerCase().includes(q);
    });
  }, [suppliers, search]);

  function openNewSupplierModal() {
    setEditingSupplier(null);
    setName('');
    setContactPerson('');
    setPhone('');
    setEmail('');
    setCity('Москва');
    setLeadTimeDays('2');
    setSelectedCats(['food']);
    setNotes('');
    setFormError(null);
    setShowSupplierModal(true);
  }

  function openEditSupplierModal(supplier: Supplier) {
    setEditingSupplier(supplier);
    setName(supplier.name);
    setContactPerson(supplier.contactPerson);
    setPhone(supplier.phone);
    setEmail(supplier.email);
    setCity(supplier.city);
    setLeadTimeDays(String(supplier.leadTimeDays));
    setSelectedCats(supplier.categories);
    setNotes(supplier.notes);
    setFormError(null);
    setShowSupplierModal(true);
  }

  function toggleCat(cat: CategoryId) {
    setSelectedCats((prev) =>
      prev.includes(cat) ? (prev.length > 1 ? prev.filter((c) => c !== cat) : prev) : [...prev, cat],
    );
  }

  async function submitSupplierForm(e: React.FormEvent) {
    e.preventDefault();
    setFormError(null);
    setSubmitting(true);
    try {
      const payload = {
        name,
        contactPerson,
        phone,
        email,
        city,
        leadTimeDays: Number(leadTimeDays),
        categories: selectedCats,
        notes,
      };
      if (editingSupplier) {
        await onUpdateSupplier(editingSupplier.id, payload);
      } else {
        await onCreateSupplier(payload);
      }
      setShowSupplierModal(false);
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Ошибка сохранения поставщика');
    } finally {
      setSubmitting(false);
    }
  }

  function openRestockModal(supplier: Supplier) {
    const linked = productsBySupplier.get(supplier.id) ?? products;
    setRestockSupplier(supplier);
    setRestockProductId(linked[0]?.id ?? 0);
    setRestockQty('12');
    setRestockNote(`Поставка от ${supplier.name}`);
    setRestockError(null);
  }

  async function submitRestock(e: React.FormEvent) {
    e.preventDefault();
    if (!restockSupplier || !restockProductId) return;
    const qty = Math.trunc(Number(restockQty));
    if (!Number.isFinite(qty) || qty <= 0) {
      setRestockError('Введите положительное количество.');
      return;
    }
    setRestockSubmitting(true);
    setRestockError(null);
    try {
      await onRestockProduct({
        productId: restockProductId,
        delta: qty,
        type: 'Приход от поставщика',
        supplierId: restockSupplier.id,
        note: restockNote.trim() || `Поставка от ${restockSupplier.name}`,
      });
      setRestockSupplier(null);
    } catch (err) {
      setRestockError(err instanceof Error ? err.message : 'Не удалось принять поставку');
    } finally {
      setRestockSubmitting(false);
    }
  }

  return (
    <div className="space-y-10">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 border-b border-zinc-200 pb-6">
        <div>
          <h1 className="font-display text-2xl sm:text-3xl font-semibold text-zinc-900">
            Поставщики и закупки
          </h1>
          <p className="mt-1 text-sm text-zinc-600">
            База партнёров по кормам, питомникам, ветеринарной аптеке и аксессуарам с оформлением поставок.
          </p>
        </div>

        <button
          type="button"
          onClick={openNewSupplierModal}
          className="inline-flex items-center gap-2 rounded-lg bg-emerald-900 px-4 py-2.5 text-sm font-medium text-white hover:bg-emerald-800 transition-colors whitespace-nowrap shrink-0"
        >
          <Plus className="h-4 w-4" />
          <span>Новый поставщик</span>
        </button>
      </div>

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="text-sm text-zinc-600 tabular-nums">
          Активных партнёров: <span className="font-semibold text-zinc-900">{suppliers.length}</span>
        </div>

        <div className="relative w-full sm:w-80">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Поиск по названию, городу, категории..."
            className="w-full rounded-lg border border-zinc-300 bg-white pl-9 pr-3 py-2 text-sm text-zinc-900 placeholder:text-zinc-400 focus:border-emerald-900 focus:outline-none"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {filteredSuppliers.map((supplier) => {
          const linkedProducts = productsBySupplier.get(supplier.id) ?? [];
          const lowCount = linkedProducts.filter((p) => p.stock <= p.minStock).length;

          return (
            <article
              key={supplier.id}
              className="rounded-xl border border-zinc-200 bg-white p-6 flex flex-col justify-between space-y-5"
            >
              <div className="space-y-4">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <div className="text-xs text-zinc-500">
                      {supplier.city} · Срок поставки {supplier.leadTimeDays} дн.
                    </div>
                    <h2 className="mt-1 font-display text-lg font-semibold text-zinc-900">
                      {supplier.name}
                    </h2>
                  </div>

                  <button
                    type="button"
                    onClick={() => openEditSupplierModal(supplier)}
                    className="inline-flex items-center gap-1 rounded-lg border border-zinc-200 px-2.5 py-1.5 text-xs font-medium text-zinc-600 hover:bg-zinc-50 hover:text-zinc-900 transition-colors shrink-0"
                  >
                    <Pencil className="h-3.5 w-3.5" />
                    <span>Изменить</span>
                  </button>
                </div>

                <div className="text-xs text-zinc-600">
                  Категории:{' '}
                  <span className="font-medium text-zinc-900">
                    {supplier.categories.map((c) => CATEGORY_LABELS[c]).join(' · ')}
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs border-t border-zinc-100 pt-3">
                  <div>
                    <span className="text-zinc-500 block">Контактное лицо</span>
                    <span className="font-medium text-zinc-900">{supplier.contactPerson}</span>
                  </div>
                  <div>
                    <span className="text-zinc-500 block">Телефон и почта</span>
                    <span className="font-mono text-zinc-900 block">{supplier.phone}</span>
                    <span className="text-zinc-600">{supplier.email}</span>
                  </div>
                </div>

                {supplier.notes && (
                  <p className="text-xs text-zinc-600 leading-relaxed">{supplier.notes}</p>
                )}

                <div className="border-t border-zinc-100 pt-3">
                  <div className="flex items-center justify-between text-xs mb-2">
                    <span className="font-medium text-zinc-700">
                      Позиции в каталоге ({linkedProducts.length})
                    </span>
                    {lowCount > 0 && (
                      <span className="text-amber-700 font-medium">
                        Требуют дозаказа: {lowCount}
                      </span>
                    )}
                  </div>
                  {linkedProducts.length === 0 ? (
                    <p className="text-xs text-zinc-400">Товары ещё не привязаны.</p>
                  ) : (
                    <ul className="space-y-1 text-xs">
                      {linkedProducts.slice(0, 4).map((p) => (
                        <li key={p.id} className="flex items-center justify-between gap-3">
                          <span className="text-zinc-700 truncate">{p.name}</span>
                          <span
                            className={`font-mono tabular-nums shrink-0 ${
                              p.stock <= p.minStock ? 'text-amber-700 font-medium' : 'text-zinc-500'
                            }`}
                          >
                            {p.stock} {p.unit}
                          </span>
                        </li>
                      ))}
                      {linkedProducts.length > 4 && (
                        <li className="text-zinc-400">
                          и ещё {linkedProducts.length - 4} поз.
                        </li>
                      )}
                    </ul>
                  )}
                </div>
              </div>

              <div className="border-t border-zinc-100 pt-4 flex items-center justify-end">
                <button
                  type="button"
                  onClick={() => openRestockModal(supplier)}
                  className="inline-flex items-center gap-2 rounded-lg bg-emerald-900 px-4 py-2 text-xs font-medium text-white hover:bg-emerald-800 transition-colors whitespace-nowrap"
                >
                  <Truck className="h-3.5 w-3.5" />
                  <span>Оформить поставку на склад</span>
                </button>
              </div>
            </article>
          );
        })}
      </div>

      {/* Add/Edit Supplier Modal */}
      {showSupplierModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-zinc-950/45 backdrop-blur-[2px]"
          role="dialog"
          aria-modal="true"
          aria-label="Карточка поставщика"
        >
          <div className="absolute inset-0" onClick={() => setShowSupplierModal(false)} />
          <div className="relative z-10 w-full max-w-lg rounded-xl border border-zinc-200 bg-white p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-display text-lg font-semibold text-zinc-900">
                {editingSupplier ? 'Редактирование поставщика' : 'Новый поставщик'}
              </h3>
              <button
                type="button"
                onClick={() => setShowSupplierModal(false)}
                className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-zinc-500 hover:bg-zinc-100"
                aria-label="Закрыть форму"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {formError && (
              <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-800">
                {formError}
              </div>
            )}

            <form onSubmit={submitSupplierForm} className="space-y-3.5">
              <div>
                <label className="block text-xs font-medium text-zinc-700 mb-1">
                  Название компании или питомника
                </label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="ООО «ЗооЛогистика»"
                  className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm text-zinc-900 focus:border-emerald-900 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-zinc-700 mb-1">
                    Контактное лицо
                  </label>
                  <input
                    type="text"
                    required
                    value={contactPerson}
                    onChange={(e) => setContactPerson(e.target.value)}
                    placeholder="Иван Петров"
                    className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm text-zinc-900 focus:border-emerald-900 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-zinc-700 mb-1">Телефон</label>
                  <input
                    type="tel"
                    required
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="+7 (495) 000-00-00"
                    className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm text-zinc-900 focus:border-emerald-900 focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="sm:col-span-1">
                  <label className="block text-xs font-medium text-zinc-700 mb-1">Город</label>
                  <input
                    type="text"
                    value={city}
                    onChange={(e) => setCity(e.target.value)}
                    className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm text-zinc-900 focus:border-emerald-900 focus:outline-none"
                  />
                </div>
                <div className="sm:col-span-1">
                  <label className="block text-xs font-medium text-zinc-700 mb-1">
                    Срок (дней)
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={60}
                    value={leadTimeDays}
                    onChange={(e) => setLeadTimeDays(e.target.value)}
                    className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm font-mono tabular-nums text-zinc-900 focus:border-emerald-900 focus:outline-none"
                  />
                </div>
                <div className="sm:col-span-1">
                  <label className="block text-xs font-medium text-zinc-700 mb-1">Email</label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="b2b@company.ru"
                    className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm text-zinc-900 focus:border-emerald-900 focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <span className="block text-xs font-medium text-zinc-700 mb-1.5">
                  Поставляемые категории
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {CATEGORIES.map((cat) => {
                    const active = selectedCats.includes(cat.id);
                    return (
                      <button
                        key={cat.id}
                        type="button"
                        onClick={() => toggleCat(cat.id)}
                        className={`px-2.5 py-1 text-xs rounded-md border transition-colors ${
                          active
                            ? 'border-emerald-900 bg-emerald-900 text-white font-medium'
                            : 'border-zinc-300 bg-white text-zinc-700 hover:bg-zinc-50'
                        }`}
                      >
                        {cat.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-zinc-700 mb-1">Примечания</label>
                <textarea
                  rows={2}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Условия оплаты, минимальная партия, график отгрузок"
                  className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm text-zinc-900 focus:border-emerald-900 focus:outline-none"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowSupplierModal(false)}
                  className="rounded-lg border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50"
                >
                  Отмена
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="rounded-lg bg-emerald-900 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-800 disabled:opacity-60"
                >
                  {submitting ? 'Сохранение...' : 'Сохранить'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Restock Modal */}
      {restockSupplier && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-zinc-950/45 backdrop-blur-[2px]"
          role="dialog"
          aria-modal="true"
          aria-label="Приёмка поставки от поставщика"
        >
          <div className="absolute inset-0" onClick={() => setRestockSupplier(null)} />
          <div className="relative z-10 w-full max-w-md rounded-xl border border-zinc-200 bg-white p-6 shadow-2xl space-y-4">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h3 className="font-display text-lg font-semibold text-zinc-900">
                  Приёмка поставки
                </h3>
                <p className="text-xs text-zinc-500 mt-0.5">{restockSupplier.name}</p>
              </div>
              <button
                type="button"
                onClick={() => setRestockSupplier(null)}
                className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-zinc-500 hover:bg-zinc-100"
                aria-label="Закрыть окно"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {restockError && (
              <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-800">
                {restockError}
              </div>
            )}

            <form onSubmit={submitRestock} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-zinc-700 mb-1">
                  Товарная позиция
                </label>
                <select
                  value={restockProductId}
                  onChange={(e) => setRestockProductId(Number(e.target.value))}
                  className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 focus:border-emerald-900 focus:outline-none"
                >
                  {(productsBySupplier.get(restockSupplier.id)?.length
                    ? productsBySupplier.get(restockSupplier.id)!
                    : products
                  ).map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.sku} — {p.name} (остаток: {p.stock})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-zinc-700 mb-1">
                  Количество поставки
                </label>
                <input
                  type="number"
                  min={1}
                  required
                  value={restockQty}
                  onChange={(e) => setRestockQty(e.target.value)}
                  className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm font-mono tabular-nums text-zinc-900 focus:border-emerald-900 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-zinc-700 mb-1">
                  Накладная / комментарий
                </label>
                <input
                  type="text"
                  value={restockNote}
                  onChange={(e) => setRestockNote(e.target.value)}
                  className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm text-zinc-900 focus:border-emerald-900 focus:outline-none"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setRestockSupplier(null)}
                  className="rounded-lg border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50"
                >
                  Отмена
                </button>
                <button
                  type="submit"
                  disabled={restockSubmitting}
                  className="rounded-lg bg-emerald-900 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-800 disabled:opacity-60"
                >
                  {restockSubmitting ? 'Приёмка...' : 'Оприходовать на склад'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
