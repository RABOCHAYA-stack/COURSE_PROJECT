import { useMemo, useState } from 'react';
import { Plus, Search, X, ArrowUpRight, ArrowDownLeft } from 'lucide-react';
import type {
  CategoryId,
  PetSpecies,
  Product,
  StockMovement,
  StockMovementType,
  Supplier,
} from '../types';
import { CATEGORIES, CATEGORY_LABELS } from '../types';
import { formatDateRu, formatRub, getStockState } from '../utils/format';

interface InventoryViewProps {
  products: Product[];
  suppliers: Supplier[];
  movements: StockMovement[];
  onAdjustStock: (payload: {
    productId: number;
    delta: number;
    type: StockMovementType;
    supplierId?: number;
    note: string;
  }) => Promise<void>;
  onCreateProduct: (payload: {
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
    specs: string;
    description: string;
  }) => Promise<void>;
}

const SPECIES_LIST: PetSpecies[] = ['Собаки', 'Кошки', 'Птицы', 'Грызуны', 'Рыбки'];

export function InventoryView({
  products,
  suppliers,
  movements,
  onAdjustStock,
  onCreateProduct,
}: InventoryViewProps) {
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<'all' | CategoryId>('all');
  const [stockFilter, setStockFilter] = useState<'all' | 'low' | 'out'>('all');

  const [adjustTarget, setAdjustTarget] = useState<{
    product: Product;
    mode: 'in' | 'out';
  } | null>(null);
  const [adjustQty, setAdjustQty] = useState('5');
  const [adjustNote, setAdjustNote] = useState('');
  const [adjustSupplierId, setAdjustSupplierId] = useState<number>(suppliers[0]?.id ?? 0);
  const [adjustSubmitting, setAdjustSubmitting] = useState(false);
  const [adjustError, setAdjustError] = useState<string | null>(null);

  const [showAddModal, setShowAddModal] = useState(false);
  const [newSku, setNewSku] = useState('');
  const [newName, setNewName] = useState('');
  const [newCategory, setNewCategory] = useState<CategoryId>('food');
  const [newSpecies, setNewSpecies] = useState<PetSpecies>('Кошки');
  const [newSupplierId, setNewSupplierId] = useState<number>(suppliers[0]?.id ?? 0);
  const [newPrice, setNewPrice] = useState('');
  const [newPurchasePrice, setNewPurchasePrice] = useState('');
  const [newStock, setNewStock] = useState('10');
  const [newMinStock, setNewMinStock] = useState('5');
  const [newUnit, setNewUnit] = useState('шт');
  const [newSpecs, setNewSpecs] = useState('');
  const [newDescription, setNewDescription] = useState('');
  const [addSubmitting, setAddSubmitting] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);

  const supplierMap = useMemo(() => {
    const map = new Map<number, Supplier>();
    for (const s of suppliers) map.set(s.id, s);
    return map;
  }, [suppliers]);

  const filteredProducts = useMemo(() => {
    const q = search.trim().toLowerCase();
    return products.filter((p) => {
      if (categoryFilter !== 'all' && p.category !== categoryFilter) return false;
      if (stockFilter === 'low' && (p.stock <= 0 || p.stock > p.minStock)) return false;
      if (stockFilter === 'out' && p.stock > 0) return false;
      if (q) {
        const sup = p.supplierName ?? supplierMap.get(p.supplierId)?.name ?? '';
        const hay = `${p.sku} ${p.name} ${sup}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [products, categoryFilter, stockFilter, search, supplierMap]);

  const summary = useMemo(() => {
    let totalUnits = 0;
    let totalWholesaleValue = 0;
    let lowCount = 0;
    let outCount = 0;
    for (const p of products) {
      totalUnits += p.stock;
      totalWholesaleValue += p.stock * p.purchasePrice;
      if (p.stock <= 0) outCount += 1;
      else if (p.stock <= p.minStock) lowCount += 1;
    }
    return { totalUnits, totalWholesaleValue, lowCount, outCount };
  }, [products]);

  function openAdjust(product: Product, mode: 'in' | 'out') {
    setAdjustTarget({ product, mode });
    setAdjustQty(mode === 'in' ? '10' : '1');
    setAdjustSupplierId(product.supplierId);
    setAdjustNote('');
    setAdjustError(null);
  }

  async function submitAdjustment(e: React.FormEvent) {
    e.preventDefault();
    if (!adjustTarget) return;
    const rawQty = Math.trunc(Number(adjustQty));
    if (!Number.isFinite(rawQty) || rawQty <= 0) {
      setAdjustError('Введите положительное целое число.');
      return;
    }

    setAdjustSubmitting(true);
    setAdjustError(null);
    try {
      const isIncoming = adjustTarget.mode === 'in';
      await onAdjustStock({
        productId: adjustTarget.product.id,
        delta: isIncoming ? rawQty : -rawQty,
        type: isIncoming ? 'Приход от поставщика' : 'Списание',
        supplierId: isIncoming && adjustSupplierId ? adjustSupplierId : undefined,
        note:
          adjustNote.trim() ||
          (isIncoming ? 'Плановая поставка на склад' : 'Списание / корректировка остатка'),
      });
      setAdjustTarget(null);
    } catch (err) {
      setAdjustError(err instanceof Error ? err.message : 'Ошибка обновления остатка');
    } finally {
      setAdjustSubmitting(false);
    }
  }

  async function submitNewProduct(e: React.FormEvent) {
    e.preventDefault();
    setAddError(null);
    setAddSubmitting(true);
    try {
      await onCreateProduct({
        sku: newSku,
        name: newName,
        category: newCategory,
        species: newSpecies,
        supplierId: newSupplierId || suppliers[0]?.id || 0,
        price: Number(newPrice),
        purchasePrice: Number(newPurchasePrice || Math.round(Number(newPrice) * 0.65)),
        stock: Number(newStock),
        minStock: Number(newMinStock),
        unit: newUnit,
        specs: newSpecs,
        description: newDescription,
      });
      setShowAddModal(false);
      setNewSku('');
      setNewName('');
      setNewPrice('');
      setNewPurchasePrice('');
      setNewSpecs('');
      setNewDescription('');
    } catch (err) {
      setAddError(err instanceof Error ? err.message : 'Не удалось добавить товар');
    } finally {
      setAddSubmitting(false);
    }
  }

  return (
    <div className="space-y-10">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 border-b border-zinc-200 pb-6">
        <div>
          <h1 className="font-display text-2xl sm:text-3xl font-semibold text-zinc-900">
            Склад и учёт остатков
          </h1>
          <p className="mt-1 text-sm text-zinc-600">
            Контроль складских запасов, минимальных порогов, приёмка поставок и журнал движения товаров.
          </p>
        </div>

        <button
          type="button"
          onClick={() => {
            setNewSupplierId(suppliers[0]?.id ?? 0);
            setAddError(null);
            setShowAddModal(true);
          }}
          className="inline-flex items-center gap-2 rounded-lg bg-emerald-900 px-4 py-2.5 text-sm font-medium text-white hover:bg-emerald-800 transition-colors whitespace-nowrap shrink-0"
        >
          <Plus className="h-4 w-4" />
          <span>Добавить товар</span>
        </button>
      </div>

      {/* KPI Strip */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-6 border-b border-zinc-200 pb-8">
        <div>
          <div className="text-xs text-zinc-500">Общий остаток</div>
          <div className="mt-1 font-display text-2xl font-semibold tabular-nums text-zinc-900">
            {summary.totalUnits} ед.
          </div>
        </div>
        <div>
          <div className="text-xs text-zinc-500">Стоимость склада (закупка)</div>
          <div className="mt-1 font-display text-2xl font-semibold tabular-nums text-zinc-900">
            {formatRub(summary.totalWholesaleValue)}
          </div>
        </div>
        <div>
          <div className="text-xs text-zinc-500">Низкий остаток</div>
          <div className="mt-1 font-display text-2xl font-semibold tabular-nums text-amber-700">
            {summary.lowCount} поз.
          </div>
        </div>
        <div>
          <div className="text-xs text-zinc-500">Отсутствуют на складе</div>
          <div className="mt-1 font-display text-2xl font-semibold tabular-nums text-red-700">
            {summary.outCount} поз.
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-2">
          <div className="inline-flex items-center gap-1 bg-zinc-200/70 p-1 rounded-lg">
            {[
              { id: 'all', label: 'Все позиции' },
              { id: 'low', label: 'Мало на складе' },
              { id: 'out', label: 'Нет в наличии' },
            ].map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setStockFilter(tab.id as 'all' | 'low' | 'out')}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
                  stockFilter === tab.id
                    ? 'bg-white text-zinc-900 shadow-sm'
                    : 'text-zinc-600 hover:text-zinc-900'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value as 'all' | CategoryId)}
            aria-label="Фильтр по категории"
            className="rounded-lg border border-zinc-300 bg-white px-3 py-2 text-xs font-medium text-zinc-800 focus:border-emerald-900 focus:outline-none"
          >
            <option value="all">Все категории</option>
            {CATEGORIES.map((c) => (
              <option key={c.id} value={c.id}>
                {c.label}
              </option>
            ))}
          </select>
        </div>

        <div className="relative w-full lg:w-72">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Артикул, товар, поставщик..."
            className="w-full rounded-lg border border-zinc-300 bg-white pl-9 pr-3 py-2 text-sm text-zinc-900 placeholder:text-zinc-400 focus:border-emerald-900 focus:outline-none"
          />
        </div>
      </div>

      {/* Inventory Table */}
      <div className="rounded-xl border border-zinc-200 bg-white overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-zinc-200 bg-zinc-50/80 text-xs font-medium text-zinc-500">
                <th className="py-3 px-4">Артикул</th>
                <th className="py-3 px-4">Товар и категория</th>
                <th className="py-3 px-4">Поставщик</th>
                <th className="py-3 px-4 text-right">Закупка / Розница</th>
                <th className="py-3 px-4 text-right">Остаток / Мин.</th>
                <th className="py-3 px-4">Статус</th>
                <th className="py-3 px-4 text-right">Операции</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-200 text-sm">
              {filteredProducts.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-10 px-4 text-center text-sm text-zinc-500">
                    По выбранным условиям позиции не найдены.
                  </td>
                </tr>
              ) : (
                filteredProducts.map((product) => {
                  const supplierName =
                    product.supplierName ?? supplierMap.get(product.supplierId)?.name ?? '—';
                  const state = getStockState(product.stock, product.minStock);

                  return (
                    <tr key={product.id} className="hover:bg-zinc-50/70 transition-colors">
                      <td className="py-3 px-4 font-mono text-xs text-zinc-600 whitespace-nowrap">
                        {product.sku}
                      </td>
                      <td className="py-3 px-4">
                        <div className="font-medium text-zinc-900">{product.name}</div>
                        <div className="text-xs text-zinc-500">
                          {CATEGORY_LABELS[product.category]} · {product.species}
                        </div>
                      </td>
                      <td className="py-3 px-4 text-xs text-zinc-600">{supplierName}</td>
                      <td className="py-3 px-4 text-right font-mono tabular-nums whitespace-nowrap">
                        <div className="text-zinc-900 font-medium">{formatRub(product.price)}</div>
                        <div className="text-xs text-zinc-400">{formatRub(product.purchasePrice)}</div>
                      </td>
                      <td className="py-3 px-4 text-right font-mono tabular-nums whitespace-nowrap">
                        <span className="font-semibold text-zinc-900">{product.stock}</span>
                        <span className="text-zinc-400"> / {product.minStock}</span>{' '}
                        <span className="text-xs font-sans text-zinc-500">{product.unit}</span>
                      </td>
                      <td className="py-3 px-4 whitespace-nowrap">
                        <span
                          className={`text-xs font-medium ${
                            state.tone === 'out'
                              ? 'text-red-700'
                              : state.tone === 'low'
                                ? 'text-amber-700'
                                : 'text-emerald-800'
                          }`}
                        >
                          {state.label}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right whitespace-nowrap">
                        <div className="inline-flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => openAdjust(product, 'in')}
                            className="inline-flex items-center gap-1 rounded-md border border-zinc-300 bg-white px-2.5 py-1.5 text-xs font-medium text-zinc-800 hover:bg-zinc-50 transition-colors"
                          >
                            <ArrowDownLeft className="h-3.5 w-3.5 text-emerald-800" />
                            <span>Приход</span>
                          </button>
                          <button
                            type="button"
                            disabled={product.stock <= 0}
                            onClick={() => openAdjust(product, 'out')}
                            className="inline-flex items-center gap-1 rounded-md border border-zinc-300 bg-white px-2.5 py-1.5 text-xs font-medium text-zinc-700 hover:bg-zinc-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                          >
                            <ArrowUpRight className="h-3.5 w-3.5 text-zinc-500" />
                            <span>Списание</span>
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Stock Movement Ledger */}
      <section className="space-y-4">
        <div>
          <h2 className="font-display text-lg font-semibold text-zinc-900">
            Журнал движения товаров
          </h2>
          <p className="text-xs text-zinc-500">
            Последние приёмки от поставщиков, продажи по заказам и ручные корректировки остатков.
          </p>
        </div>

        <div className="rounded-xl border border-zinc-200 bg-white overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-zinc-200 bg-zinc-50/80 text-xs font-medium text-zinc-500">
                  <th className="py-3 px-4">Дата и время</th>
                  <th className="py-3 px-4">Операция</th>
                  <th className="py-3 px-4">Товар</th>
                  <th className="py-3 px-4 text-right">Изменение</th>
                  <th className="py-3 px-4 text-right">Остаток после</th>
                  <th className="py-3 px-4">Основание</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-200 text-xs">
                {movements.slice(0, 20).map((mov) => (
                  <tr key={mov.id} className="hover:bg-zinc-50/60">
                    <td className="py-2.5 px-4 text-zinc-500 tabular-nums whitespace-nowrap">
                      {formatDateRu(mov.createdAt)}
                    </td>
                    <td className="py-2.5 px-4 font-medium text-zinc-800 whitespace-nowrap">
                      {mov.type}
                    </td>
                    <td className="py-2.5 px-4 text-zinc-900">
                      <span className="font-mono text-zinc-500 mr-2">{mov.sku}</span>
                      {mov.productName}
                    </td>
                    <td
                      className={`py-2.5 px-4 text-right font-mono tabular-nums font-semibold whitespace-nowrap ${
                        mov.delta > 0 ? 'text-emerald-800' : 'text-red-700'
                      }`}
                    >
                      {mov.delta > 0 ? `+${mov.delta}` : mov.delta}
                    </td>
                    <td className="py-2.5 px-4 text-right font-mono tabular-nums text-zinc-900 whitespace-nowrap">
                      {mov.balanceAfter}
                    </td>
                    <td className="py-2.5 px-4 text-zinc-600">{mov.note}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* Stock Adjustment Modal */}
      {adjustTarget && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-zinc-950/45 backdrop-blur-[2px]"
          role="dialog"
          aria-modal="true"
          aria-label="Корректировка остатка"
        >
          <div className="absolute inset-0" onClick={() => setAdjustTarget(null)} />
          <div className="relative z-10 w-full max-w-md rounded-xl border border-zinc-200 bg-white p-6 shadow-2xl space-y-4">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h3 className="font-display text-lg font-semibold text-zinc-900">
                  {adjustTarget.mode === 'in' ? 'Приход товара на склад' : 'Списание со склада'}
                </h3>
                <p className="text-xs text-zinc-500 mt-0.5">
                  {adjustTarget.product.name} · сейчас {adjustTarget.product.stock}{' '}
                  {adjustTarget.product.unit}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setAdjustTarget(null)}
                className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-zinc-500 hover:bg-zinc-100"
                aria-label="Закрыть окно"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {adjustError && (
              <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-800">
                {adjustError}
              </div>
            )}

            <form onSubmit={submitAdjustment} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-zinc-700 mb-1">
                  Количество ({adjustTarget.product.unit})
                </label>
                <input
                  type="number"
                  min={1}
                  max={adjustTarget.mode === 'out' ? adjustTarget.product.stock : 9999}
                  required
                  value={adjustQty}
                  onChange={(e) => setAdjustQty(e.target.value)}
                  className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm font-mono tabular-nums text-zinc-900 focus:border-emerald-900 focus:outline-none"
                />
              </div>

              {adjustTarget.mode === 'in' && (
                <div>
                  <label className="block text-xs font-medium text-zinc-700 mb-1">
                    Поставщик
                  </label>
                  <select
                    value={adjustSupplierId}
                    onChange={(e) => setAdjustSupplierId(Number(e.target.value))}
                    className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 focus:border-emerald-900 focus:outline-none"
                  >
                    {suppliers.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div>
                <label className="block text-xs font-medium text-zinc-700 mb-1">
                  Комментарий / номер накладной
                </label>
                <input
                  type="text"
                  value={adjustNote}
                  onChange={(e) => setAdjustNote(e.target.value)}
                  placeholder={
                    adjustTarget.mode === 'in'
                      ? 'Например, Накладная №518'
                      : 'Например, Повреждение упаковки'
                  }
                  className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm text-zinc-900 focus:border-emerald-900 focus:outline-none"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setAdjustTarget(null)}
                  className="rounded-lg border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50"
                >
                  Отмена
                </button>
                <button
                  type="submit"
                  disabled={adjustSubmitting}
                  className="rounded-lg bg-emerald-900 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-800 disabled:opacity-60"
                >
                  {adjustSubmitting ? 'Сохранение...' : 'Подтвердить'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add Product Modal */}
      {showAddModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-zinc-950/45 backdrop-blur-[2px]"
          role="dialog"
          aria-modal="true"
          aria-label="Новый товар в каталог"
        >
          <div className="absolute inset-0" onClick={() => setShowAddModal(false)} />
          <div className="relative z-10 w-full max-w-xl max-h-[90vh] overflow-y-auto rounded-xl border border-zinc-200 bg-white p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-display text-lg font-semibold text-zinc-900">
                Новая позиция на склад и в каталог
              </h3>
              <button
                type="button"
                onClick={() => setShowAddModal(false)}
                className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-zinc-500 hover:bg-zinc-100"
                aria-label="Закрыть форму"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {addError && (
              <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-800">
                {addError}
              </div>
            )}

            <form onSubmit={submitNewProduct} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-medium text-zinc-700 mb-1">Артикул</label>
                  <input
                    type="text"
                    required
                    value={newSku}
                    onChange={(e) => setNewSku(e.target.value)}
                    placeholder="FD-1099"
                    className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm font-mono text-zinc-900 focus:border-emerald-900 focus:outline-none"
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className="block text-xs font-medium text-zinc-700 mb-1">
                    Наименование
                  </label>
                  <input
                    type="text"
                    required
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    placeholder="Название товара или питомца"
                    className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm text-zinc-900 focus:border-emerald-900 focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-medium text-zinc-700 mb-1">Категория</label>
                  <select
                    value={newCategory}
                    onChange={(e) => setNewCategory(e.target.value as CategoryId)}
                    className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 focus:border-emerald-900 focus:outline-none"
                  >
                    {CATEGORIES.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-zinc-700 mb-1">
                    Вид животного
                  </label>
                  <select
                    value={newSpecies}
                    onChange={(e) => setNewSpecies(e.target.value as PetSpecies)}
                    className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 focus:border-emerald-900 focus:outline-none"
                  >
                    {SPECIES_LIST.map((sp) => (
                      <option key={sp} value={sp}>
                        {sp}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-zinc-700 mb-1">Поставщик</label>
                  <select
                    value={newSupplierId}
                    onChange={(e) => setNewSupplierId(Number(e.target.value))}
                    className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 focus:border-emerald-900 focus:outline-none"
                  >
                    {suppliers.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                <div>
                  <label className="block text-xs font-medium text-zinc-700 mb-1">Цена (₽)</label>
                  <input
                    type="number"
                    min={1}
                    required
                    value={newPrice}
                    onChange={(e) => setNewPrice(e.target.value)}
                    className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm font-mono tabular-nums text-zinc-900 focus:border-emerald-900 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-zinc-700 mb-1">Закупка (₽)</label>
                  <input
                    type="number"
                    min={0}
                    value={newPurchasePrice}
                    onChange={(e) => setNewPurchasePrice(e.target.value)}
                    className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm font-mono tabular-nums text-zinc-900 focus:border-emerald-900 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-zinc-700 mb-1">Остаток</label>
                  <input
                    type="number"
                    min={0}
                    required
                    value={newStock}
                    onChange={(e) => setNewStock(e.target.value)}
                    className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm font-mono tabular-nums text-zinc-900 focus:border-emerald-900 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-zinc-700 mb-1">Мин. порог</label>
                  <input
                    type="number"
                    min={0}
                    required
                    value={newMinStock}
                    onChange={(e) => setNewMinStock(e.target.value)}
                    className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm font-mono tabular-nums text-zinc-900 focus:border-emerald-900 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-zinc-700 mb-1">Ед. изм.</label>
                  <input
                    type="text"
                    required
                    value={newUnit}
                    onChange={(e) => setNewUnit(e.target.value)}
                    placeholder="шт"
                    className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm text-zinc-900 focus:border-emerald-900 focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-zinc-700 mb-1">
                  Краткие характеристики
                </label>
                <input
                  type="text"
                  value={newSpecs}
                  onChange={(e) => setNewSpecs(e.target.value)}
                  placeholder="Например: Беззерновой · Лосось · 2 кг"
                  className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm text-zinc-900 focus:border-emerald-900 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-zinc-700 mb-1">Описание</label>
                <textarea
                  rows={2}
                  value={newDescription}
                  onChange={(e) => setNewDescription(e.target.value)}
                  placeholder="Подробное описание состава, показаний или условий содержания"
                  className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm text-zinc-900 focus:border-emerald-900 focus:outline-none"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="rounded-lg border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50"
                >
                  Отмена
                </button>
                <button
                  type="submit"
                  disabled={addSubmitting}
                  className="rounded-lg bg-emerald-900 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-800 disabled:opacity-60"
                >
                  {addSubmitting ? 'Добавление...' : 'Сохранить товар'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
