import { useMemo, useState } from 'react';
import { Search, Plus, Minus, X, ArrowDownRight } from 'lucide-react';
import type { AnimalSpecies, CategoryId, Product, Supplier } from '../types';
import { CATEGORIES, CATEGORY_LABELS } from '../types';
import { formatRub, getStockState } from '../utils/format';
import { ResilientImage } from './ResilientImage';
import type { CartEntry } from './CartDrawer';

interface CatalogViewProps {
  products: Product[];
  suppliers: Supplier[];
  ordersCount: number;
  isAdmin: boolean;
  cart: CartEntry[];
  onAddToCart: (product: Product) => void;
  onUpdateCartQty: (productId: number, nextQty: number) => void;
  onNavigateTab: (tab: 'inventory' | 'orders' | 'suppliers' | 'accounts') => void;
}

const SPECIES_FILTERS: AnimalSpecies[] = [
  'Все',
  'Кошки',
  'Собаки',
  'Птицы',
  'Грызуны',
  'Рыбки',
];

export function CatalogView({
  products,
  suppliers,
  ordersCount,
  isAdmin,
  cart,
  onAddToCart,
  onUpdateCartQty,
  onNavigateTab,
}: CatalogViewProps) {
  const [selectedCategory, setSelectedCategory] = useState<'all' | CategoryId>('all');
  const [selectedSpecies, setSelectedSpecies] = useState<AnimalSpecies>('Все');
  const [searchQuery, setSearchQuery] = useState('');
  const [activeProduct, setActiveProduct] = useState<Product | null>(null);

  const supplierMap = useMemo(() => {
    const map = new Map<number, Supplier>();
    for (const s of suppliers) map.set(s.id, s);
    return map;
  }, [suppliers]);

  const cartQtyMap = useMemo(() => {
    const map = new Map<number, number>();
    for (const entry of cart) map.set(entry.product.id, entry.quantity);
    return map;
  }, [cart]);

  const filteredProducts = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return products.filter((p) => {
      if (selectedCategory !== 'all' && p.category !== selectedCategory) return false;
      if (selectedSpecies !== 'Все' && p.species !== selectedSpecies) return false;
      if (q) {
        const supplierName = p.supplierName ?? supplierMap.get(p.supplierId)?.name ?? '';
        const haystack = `${p.name} ${p.sku} ${p.specs} ${p.description} ${supplierName}`.toLowerCase();
        if (!haystack.includes(q)) return false;
      }
      return true;
    });
  }, [products, selectedCategory, selectedSpecies, searchQuery, supplierMap]);

  const totalStockUnits = useMemo(
    () => products.reduce((sum, p) => sum + p.stock, 0),
    [products],
  );
  const lowStockCount = useMemo(
    () => products.filter((p) => p.stock <= p.minStock).length,
    [products],
  );
  const availableProductsCount = useMemo(
    () => products.filter((p) => p.stock > 0).length,
    [products],
  );

  function scrollToCatalog() {
    document.getElementById('catalog-section')?.scrollIntoView({ behavior: 'smooth' });
  }

  return (
    <div className="space-y-12">
      {/* Hero Split */}
      <section className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-stretch border-b border-zinc-200 pb-10">
        <div className="lg:col-span-6 flex flex-col justify-between py-2 space-y-6">
          <div className="space-y-4">
            <p className="text-xs font-medium tracking-wide text-emerald-900">
              Ветеринарный контроль и прямые поставки
            </p>
            <h1 className="font-display text-3xl sm:text-4xl lg:text-[2.75rem] font-semibold tracking-tight text-zinc-900 leading-[1.12] [text-wrap:balance]">
              Зоомагазин полного цикла: питомцы, рационы и уход
            </h1>
            <p className="text-base text-zinc-600 leading-relaxed max-w-xl">
              Шесть профильных категорий — от декоративных животных и холистик-кормов до ветеринарной аптеки и аксессуаров с актуальным наличием в реальном времени.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-4 pt-2">
            <button
              type="button"
              onClick={scrollToCatalog}
              className="inline-flex items-center gap-2 rounded-lg bg-emerald-900 px-5 py-2.5 text-sm font-medium text-white hover:bg-emerald-800 transition-colors whitespace-nowrap shrink-0"
            >
              <span>Выбрать товары</span>
              <ArrowDownRight className="h-4 w-4" />
            </button>
            {isAdmin && (
              <button
                type="button"
                onClick={() => onNavigateTab('inventory')}
                className="inline-flex items-center rounded-lg border border-zinc-300 bg-white px-4 py-2.5 text-sm font-medium text-zinc-800 hover:bg-zinc-50 transition-colors whitespace-nowrap shrink-0"
              >
                Остатки на складе
              </button>
            )}
          </div>
        </div>

        <div className="lg:col-span-6">
          <div className="h-full min-h-[260px] lg:min-h-[340px] rounded-xl overflow-hidden border border-zinc-200 bg-zinc-100">
            <ResilientImage
              src="/src/assets/images/hero_pet_boutique_1795537997932.jpg"
              alt="Зоомаркет Лапа и Дом — зал кормов, лежанок и ухода за питомцами"
              className="h-full w-full object-cover"
            />
          </div>
        </div>
      </section>

      {/* Full-width 4-Column Summary Strip below Hero */}
      {isAdmin ? (
        <section className="grid grid-cols-2 lg:grid-cols-4 gap-6 border-b border-zinc-200 pb-10">
          <div>
            <div className="text-xs text-zinc-500">Позиций в каталоге</div>
            <div className="mt-1 font-display text-2xl font-semibold tabular-nums text-zinc-900">
              {products.length}
            </div>
            <div className="mt-0.5 text-xs text-zinc-500">6 категорий ассортимента</div>
          </div>
          <div>
            <div className="text-xs text-zinc-500">Единиц на складе</div>
            <div className="mt-1 font-display text-2xl font-semibold tabular-nums text-zinc-900">
              {totalStockUnits}
            </div>
            <div className="mt-0.5 text-xs text-zinc-500">
              {lowStockCount > 0 ? `${lowStockCount} требуют пополнения` : 'Все остатки в норме'}
            </div>
          </div>
          <div>
            <div className="text-xs text-zinc-500">Надёжных поставщиков</div>
            <div className="mt-1 font-display text-2xl font-semibold tabular-nums text-zinc-900">
              {suppliers.length}
            </div>
            <div className="mt-0.5 text-xs text-zinc-500">Прямые договоры поставки</div>
          </div>
          <div>
            <div className="text-xs text-zinc-500">Заказов в истории</div>
            <div className="mt-1 font-display text-2xl font-semibold tabular-nums text-zinc-900">
              {ordersCount}
            </div>
            <div className="mt-0.5 text-xs text-zinc-500">Прозрачная отчётность</div>
          </div>
        </section>
      ) : (
        <section className="grid grid-cols-2 lg:grid-cols-4 gap-6 border-b border-zinc-200 pb-10">
          <div>
            <div className="text-xs text-zinc-500">Доступно в каталоге</div>
            <div className="mt-1 font-display text-2xl font-semibold tabular-nums text-zinc-900">
              {availableProductsCount}
            </div>
            <div className="mt-0.5 text-xs text-zinc-500">Готовы к отправке</div>
          </div>
          <div>
            <div className="text-xs text-zinc-500">Профильных категорий</div>
            <div className="mt-1 font-display text-2xl font-semibold tabular-nums text-zinc-900">
              6
            </div>
            <div className="mt-0.5 text-xs text-zinc-500">Корма, уход, аптека и питомцы</div>
          </div>
          <div>
            <div className="text-xs text-zinc-500">Бесплатная доставка</div>
            <div className="mt-1 font-display text-2xl font-semibold tabular-nums text-zinc-900">
              от 3 000 ₽
            </div>
            <div className="mt-0.5 text-xs text-zinc-500">Курьером до двери</div>
          </div>
          <div>
            <div className="text-xs text-zinc-500">Гарантия качества</div>
            <div className="mt-1 font-display text-2xl font-semibold text-zinc-900">
              100%
            </div>
            <div className="mt-0.5 text-xs text-zinc-500">Сертифицированные поставщики</div>
          </div>
        </section>
      )}

      {/* Catalog Filter & Product Grid */}
      <section id="catalog-section" className="space-y-6">
        <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4">
          <div>
            <h2 className="font-display text-2xl font-semibold text-zinc-900">
              Каталог зоотоваров и питомцев
            </h2>
            <p className="mt-1 text-sm text-zinc-600">
              {selectedCategory === 'all'
                ? 'Все категории ассортимента с актуальным остатком в реальном времени'
                : CATEGORIES.find((c) => c.id === selectedCategory)?.description}
            </p>
          </div>

          <div className="relative w-full lg:w-80">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
            <input
              type="search"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Поиск по названию, артикулу, составу..."
              className="w-full rounded-lg border border-zinc-300 bg-white pl-9 pr-3 py-2 text-sm text-zinc-900 placeholder:text-zinc-400 focus:border-emerald-900 focus:outline-none"
            />
          </div>
        </div>

        {/* Category Tabs */}
        <div className="flex flex-wrap items-center gap-1.5 bg-zinc-200/70 p-1 rounded-lg w-fit max-w-full overflow-x-auto">
          <button
            type="button"
            onClick={() => setSelectedCategory('all')}
            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
              selectedCategory === 'all'
                ? 'bg-white text-zinc-900 shadow-sm'
                : 'text-zinc-600 hover:text-zinc-900'
            }`}
          >
            Все категории
          </button>
          {CATEGORIES.map((cat) => (
            <button
              key={cat.id}
              type="button"
              onClick={() => setSelectedCategory(cat.id)}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
                selectedCategory === cat.id
                  ? 'bg-white text-zinc-900 shadow-sm'
                  : 'text-zinc-600 hover:text-zinc-900'
              }`}
            >
              {cat.label}
            </button>
          ))}
        </div>

        {/* Species Filter */}
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <span className="text-zinc-500 mr-1">Питомец:</span>
          {SPECIES_FILTERS.map((sp) => (
            <button
              key={sp}
              type="button"
              onClick={() => setSelectedSpecies(sp)}
              className={`px-2.5 py-1 rounded-md border transition-colors whitespace-nowrap shrink-0 ${
                selectedSpecies === sp
                  ? 'border-emerald-900 bg-emerald-900 text-white font-medium'
                  : 'border-zinc-200 bg-white text-zinc-700 hover:border-zinc-300'
              }`}
            >
              {sp}
            </button>
          ))}
        </div>

        {/* 3-Column Product Grid */}
        {filteredProducts.length === 0 ? (
          <div className="rounded-xl border border-zinc-200 bg-white p-12 text-center space-y-3">
            <p className="font-display text-base font-medium text-zinc-900">
              По заданным фильтрам товары не найдены
            </p>
            <p className="text-sm text-zinc-500">
              Сбросьте поиск или выберите другую категорию.
            </p>
            <button
              type="button"
              onClick={() => {
                setSelectedCategory('all');
                setSelectedSpecies('Все');
                setSearchQuery('');
              }}
              className="inline-flex items-center rounded-lg border border-zinc-300 bg-white px-4 py-2 text-xs font-medium text-zinc-800 hover:bg-zinc-50"
            >
              Показать весь каталог
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 lg:gap-8">
            {filteredProducts.map((product) => {
              const supplierName =
                product.supplierName ?? supplierMap.get(product.supplierId)?.name;
              const stockState = getStockState(product.stock, product.minStock);
              const inCartQty = cartQtyMap.get(product.id) ?? 0;

              return (
                <article
                  key={product.id}
                  className="group flex flex-col justify-between rounded-xl border border-zinc-200 bg-white overflow-hidden transition-transform duration-200 hover:-translate-y-0.5 hover:shadow-md"
                >
                  <div>
                    <button
                      type="button"
                      onClick={() => setActiveProduct(product)}
                      className="block w-full aspect-[4/3] overflow-hidden bg-zinc-100 text-left"
                    >
                      <ResilientImage
                        src={product.imageUrl}
                        alt={product.name}
                        className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.02]"
                      />
                    </button>

                    <div className="p-5 space-y-2">
                      <div className="flex items-center gap-1.5 text-xs text-zinc-500 truncate">
                        <span>{CATEGORY_LABELS[product.category]}</span>
                        <span aria-hidden="true">·</span>
                        <span>{product.species}</span>
                        {supplierName && (
                          <>
                            <span aria-hidden="true">·</span>
                            <span className="truncate">{supplierName}</span>
                          </>
                        )}
                      </div>

                      <button
                        type="button"
                        onClick={() => setActiveProduct(product)}
                        className="block text-left"
                      >
                        <h3 className="font-display text-base font-semibold text-zinc-900 leading-snug group-hover:text-emerald-900 transition-colors">
                          {product.name}
                        </h3>
                      </button>

                      <p className="text-xs text-zinc-500 truncate">{product.specs}</p>
                    </div>
                  </div>

                  <div className="px-5 pb-5 pt-3 border-t border-zinc-100 flex items-center justify-between gap-3">
                    <div>
                      <div className="font-mono tabular-nums text-base font-semibold text-zinc-900">
                        {formatRub(product.price)}
                      </div>
                      <div
                        className={`text-xs tabular-nums ${
                          stockState.tone === 'out'
                            ? 'text-red-700 font-medium'
                            : stockState.tone === 'low'
                              ? 'text-amber-700 font-medium'
                              : 'text-zinc-500'
                        }`}
                      >
                        {stockState.label} · {product.stock} {product.unit}
                      </div>
                    </div>

                    {inCartQty > 0 ? (
                      <div className="inline-flex items-center border border-emerald-900 rounded-lg bg-emerald-50/40 shrink-0">
                        <button
                          type="button"
                          onClick={() => onUpdateCartQty(product.id, inCartQty - 1)}
                          className="inline-flex h-9 w-8 items-center justify-center text-emerald-900 hover:bg-emerald-100 rounded-l-lg transition-colors"
                          aria-label="Уменьшить количество"
                        >
                          <Minus className="h-3.5 w-3.5" />
                        </button>
                        <span className="px-2.5 text-xs font-mono tabular-nums font-semibold text-emerald-950">
                          {inCartQty}
                        </span>
                        <button
                          type="button"
                          disabled={inCartQty >= product.stock}
                          onClick={() => onUpdateCartQty(product.id, inCartQty + 1)}
                          className="inline-flex h-9 w-8 items-center justify-center text-emerald-900 hover:bg-emerald-100 disabled:opacity-40 disabled:cursor-not-allowed rounded-r-lg transition-colors"
                          aria-label="Увеличить количество"
                        >
                          <Plus className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        disabled={product.stock <= 0}
                        onClick={() => onAddToCart(product)}
                        className="inline-flex items-center justify-center rounded-lg bg-emerald-900 px-4 py-2 text-xs font-medium text-white hover:bg-emerald-800 disabled:bg-zinc-200 disabled:text-zinc-500 disabled:cursor-not-allowed transition-colors whitespace-nowrap shrink-0"
                      >
                        {product.stock > 0 ? 'В корзину' : 'Нет в наличии'}
                      </button>
                    )}
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>

      {/* Product Detail Modal */}
      {activeProduct && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-zinc-950/45 backdrop-blur-[2px]"
          role="dialog"
          aria-modal="true"
          aria-label={activeProduct.name}
        >
          <div className="absolute inset-0" onClick={() => setActiveProduct(null)} />
          <div className="relative z-10 w-full max-w-3xl rounded-xl border border-zinc-200 bg-white overflow-hidden shadow-2xl grid grid-cols-1 md:grid-cols-2">
            <div className="aspect-[4/3] md:aspect-auto md:h-full bg-zinc-100">
              <ResilientImage
                src={activeProduct.imageUrl}
                alt={activeProduct.name}
                className="h-full w-full object-cover"
              />
            </div>
            <div className="p-6 flex flex-col justify-between space-y-5">
              <div className="space-y-3">
                <div className="flex items-start justify-between gap-4">
                  <div className="text-xs text-zinc-500">
                    {CATEGORY_LABELS[activeProduct.category]} · {activeProduct.species} ·{' '}
                    <span className="font-mono">{activeProduct.sku}</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setActiveProduct(null)}
                    className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900 shrink-0"
                    aria-label="Закрыть карточку товара"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>

                <h3 className="font-display text-xl font-semibold text-zinc-900 leading-snug">
                  {activeProduct.name}
                </h3>

                <p className="text-sm text-zinc-600 leading-relaxed">
                  {activeProduct.description}
                </p>

                <div className="border-t border-zinc-200 pt-3 space-y-1.5 text-xs">
                  <div className="flex justify-between gap-2">
                    <span className="text-zinc-500">Характеристики</span>
                    <span className="text-zinc-900 font-medium text-right">{activeProduct.specs}</span>
                  </div>
                  <div className="flex justify-between gap-2">
                    <span className="text-zinc-500">Поставщик</span>
                    <span className="text-zinc-900 font-medium text-right">
                      {activeProduct.supplierName ??
                        supplierMap.get(activeProduct.supplierId)?.name ??
                        '—'}
                    </span>
                  </div>
                  <div className="flex justify-between gap-2">
                    <span className="text-zinc-500">Остаток на складе</span>
                    <span className="font-mono tabular-nums text-zinc-900 font-medium">
                      {activeProduct.stock} {activeProduct.unit}
                    </span>
                  </div>
                </div>
              </div>

              <div className="border-t border-zinc-200 pt-4 flex items-center justify-between gap-4">
                <div className="font-mono tabular-nums text-xl font-semibold text-zinc-900">
                  {formatRub(activeProduct.price)}
                </div>
                <button
                  type="button"
                  disabled={
                    activeProduct.stock <= 0 ||
                    (cartQtyMap.get(activeProduct.id) ?? 0) >= activeProduct.stock
                  }
                  onClick={() => {
                    onAddToCart(activeProduct);
                    setActiveProduct(null);
                  }}
                  className="rounded-lg bg-emerald-900 px-5 py-2.5 text-sm font-medium text-white hover:bg-emerald-800 disabled:bg-zinc-200 disabled:text-zinc-500 disabled:cursor-not-allowed transition-colors whitespace-nowrap"
                >
                  {activeProduct.stock > 0 ? 'Добавить в корзину' : 'Нет в наличии'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
