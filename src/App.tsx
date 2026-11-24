import { useCallback, useEffect, useMemo, useState } from 'react';
import { ShoppingBag, LogIn, LogOut, Eye } from 'lucide-react';
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
  UserAccount,
  UserRole,
} from './types';
import { useAuth } from './contexts/AuthContext';
import { CatalogView } from './components/CatalogView';
import { InventoryView } from './components/InventoryView';
import { OrdersView } from './components/OrdersView';
import { SuppliersView } from './components/SuppliersView';
import { AccountsView } from './components/AccountsView';
import { CartDrawer, type CartEntry } from './components/CartDrawer';

type ActiveTab = 'catalog' | 'orders' | 'inventory' | 'suppliers' | 'accounts';

export default function App() {
  const {
    account,
    idToken,
    authReady,
    authBusy,
    authError,
    signInWithGoogle,
    signOut,
  } = useAuth();

  const [activeTab, setActiveTab] = useState<ActiveTab>('catalog');
  const [customerPreview, setCustomerPreview] = useState(false);

  const [products, setProducts] = useState<Product[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [movements, setMovements] = useState<StockMovement[]>([]);
  const [usersList, setUsersList] = useState<UserAccount[]>([]);

  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [cart, setCart] = useState<CartEntry[]>([]);
  const [cartOpen, setCartOpen] = useState(false);

  const isTrueAdmin = account?.role === 'admin';
  const effectiveIsAdmin = isTrueAdmin && !customerPreview;

  useEffect(() => {
    if (!effectiveIsAdmin && activeTab !== 'catalog') {
      setActiveTab('catalog');
    }
  }, [effectiveIsAdmin, activeTab]);

  useEffect(() => {
    if (!isTrueAdmin && customerPreview) {
      setCustomerPreview(false);
    }
  }, [isTrueAdmin, customerPreview]);

  const apiJson = useCallback(
    async <T,>(url: string, init?: RequestInit): Promise<T> => {
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        ...((init?.headers as Record<string, string> | undefined) ?? {}),
      };
      if (idToken) {
        headers.Authorization = `Bearer ${idToken}`;
      }
      const res = await fetch(url, {
        ...init,
        headers,
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        throw new Error(data.error ?? `Ошибка сервера (${res.status})`);
      }
      return data as T;
    },
    [idToken],
  );

  const fetchStore = useCallback(async () => {
    if (!authReady) return;
    setLoading(true);
    setLoadError(null);
    try {
      const data = await apiJson<{
        account: UserAccount | null;
        products: Product[];
        suppliers: Supplier[];
        orders: Order[];
        stockMovements: StockMovement[];
        users: UserAccount[];
      }>('/api/store');
      setProducts(data.products);
      setSuppliers(data.suppliers);
      setOrders(data.orders);
      setMovements(data.stockMovements);
      setUsersList(data.users);
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : 'Не удалось загрузить данные магазина');
    } finally {
      setLoading(false);
    }
  }, [authReady, apiJson]);

  useEffect(() => {
    void fetchStore();
  }, [fetchStore, account?.role]);

  const cartCount = useMemo(
    () => cart.reduce((sum, entry) => sum + entry.quantity, 0),
    [cart],
  );

  function handleAddToCart(product: Product) {
    if (product.stock <= 0) return;
    setCart((prev) => {
      const existing = prev.find((item) => item.product.id === product.id);
      if (existing) {
        const nextQty = Math.min(product.stock, existing.quantity + 1);
        return prev.map((item) =>
          item.product.id === product.id ? { ...item, product, quantity: nextQty } : item,
        );
      }
      return [...prev, { product, quantity: 1 }];
    });
  }

  function handleUpdateCartQty(productId: number, nextQty: number) {
    if (nextQty <= 0) {
      setCart((prev) => prev.filter((item) => item.product.id !== productId));
      return;
    }
    setCart((prev) =>
      prev.map((item) => {
        if (item.product.id !== productId) return item;
        const clamped = Math.min(item.product.stock, nextQty);
        return { ...item, quantity: clamped };
      }),
    );
  }

  function handleRemoveFromCart(productId: number) {
    setCart((prev) => prev.filter((item) => item.product.id !== productId));
  }

  async function handleSubmitOrder(payload: {
    customerName: string;
    customerPhone: string;
    deliveryAddress: string;
    paymentMethod: PaymentMethod;
  }): Promise<Order> {
    const res = await apiJson<{
      order: Order;
      products: Product[];
      stockMovements: StockMovement[];
    }>('/api/orders', {
      method: 'POST',
      body: JSON.stringify({
        ...payload,
        items: cart.map((entry) => ({
          productId: entry.product.id,
          quantity: entry.quantity,
        })),
      }),
    });

    if (isTrueAdmin) {
      setOrders((prev) => [res.order, ...prev]);
      setMovements(res.stockMovements);
    }
    setProducts(res.products);
    setCart([]);
    return res.order;
  }

  async function handleUpdateOrderStatus(orderId: number, nextStatus: OrderStatus) {
    const res = await apiJson<{
      order: Order;
      products: Product[];
      stockMovements: StockMovement[];
    }>(`/api/orders/${orderId}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status: nextStatus }),
    });

    setOrders((prev) => prev.map((o) => (o.id === res.order.id ? res.order : o)));
    setProducts(res.products);
    setMovements(res.stockMovements);
  }

  function handleRepeatOrder(order: Order) {
    const productMap = new Map(products.map((p) => [p.id, p]));
    const nextCart: CartEntry[] = [];
    for (const item of order.items) {
      const fresh = productMap.get(item.productId);
      if (fresh && fresh.stock > 0) {
        nextCart.push({
          product: fresh,
          quantity: Math.min(fresh.stock, item.quantity),
        });
      }
    }
    if (nextCart.length > 0) {
      setCart(nextCart);
      setCartOpen(true);
    }
  }

  async function handleAdjustStock(payload: {
    productId: number;
    delta: number;
    type: StockMovementType;
    supplierId?: number;
    note: string;
  }) {
    const res = await apiJson<{
      product: Product;
      movement: StockMovement;
    }>(`/api/products/${payload.productId}/stock`, {
      method: 'PATCH',
      body: JSON.stringify({
        delta: payload.delta,
        type: payload.type,
        supplierId: payload.supplierId,
        note: payload.note,
      }),
    });

    setProducts((prev) =>
      prev.map((p) => (p.id === res.product.id ? res.product : p)),
    );
    setMovements((prev) => [res.movement, ...prev]);
    setCart((prev) =>
      prev
        .map((entry) =>
          entry.product.id === res.product.id
            ? {
                product: res.product,
                quantity: Math.min(entry.quantity, res.product.stock),
              }
            : entry,
        )
        .filter((entry) => entry.quantity > 0),
    );
  }

  async function handleCreateProduct(payload: {
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
  }) {
    const created = await apiJson<Product>('/api/products', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    setProducts((prev) => [created, ...prev]);
    const latestMovements = await apiJson<StockMovement[]>('/api/stock-movements');
    setMovements(latestMovements);
  }

  async function handleCreateSupplier(payload: Omit<Supplier, 'id' | 'createdAt'>) {
    const created = await apiJson<Supplier>('/api/suppliers', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    setSuppliers((prev) => [created, ...prev]);
  }

  async function handleUpdateSupplier(
    id: number,
    payload: Omit<Supplier, 'id' | 'createdAt'>,
  ) {
    const updated = await apiJson<Supplier>(`/api/suppliers/${id}`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    });
    setSuppliers((prev) => prev.map((s) => (s.id === updated.id ? updated : s)));
  }

  async function handleUpdateUserRole(userId: number, role: UserRole) {
    const updated = await apiJson<UserAccount>(`/api/users/${userId}/role`, {
      method: 'PATCH',
      body: JSON.stringify({ role }),
    });
    setUsersList((prev) => prev.map((u) => (u.id === updated.id ? updated : u)));
  }

  const navItems: { id: ActiveTab; label: string }[] = effectiveIsAdmin
    ? [
        { id: 'catalog', label: 'Каталог' },
        { id: 'orders', label: 'История покупок' },
        { id: 'inventory', label: 'Склад и остатки' },
        { id: 'suppliers', label: 'Поставщики' },
        { id: 'accounts', label: 'Аккаунты' },
      ]
    : [{ id: 'catalog', label: 'Каталог' }];

  return (
    <div className="min-h-screen flex flex-col bg-[#F7F7F5] text-zinc-900">
      {/* Top Bar Contract: 3 zones separated by gap-8 */}
      <header className="sticky top-0 z-40 border-b border-zinc-200 bg-white/95 backdrop-blur-sm">
        <div className="mx-auto max-w-[1280px] px-4 sm:px-8 h-16 flex items-center justify-between gap-8">
          {/* Zone 1: Single-line Brand wordmark */}
          <button
            type="button"
            onClick={() => setActiveTab('catalog')}
            className="font-display text-lg font-bold tracking-tight text-zinc-900 whitespace-nowrap shrink-0"
          >
            Лапа и Дом
          </button>

          {/* Zone 2: Clean single-line nav links */}
          <nav
            aria-label="Основная навигация"
            className="hidden md:flex items-center gap-6 text-sm font-medium"
          >
            {navItems.map((item) => {
              const active = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setActiveTab(item.id)}
                  className={`py-1 transition-colors whitespace-nowrap shrink-0 border-b-2 ${
                    active
                      ? 'border-emerald-900 text-zinc-900'
                      : 'border-transparent text-zinc-600 hover:text-zinc-900'
                  }`}
                >
                  {item.label}
                </button>
              );
            })}
            {!account ? (
              <button
                type="button"
                disabled={authBusy}
                onClick={() => void signInWithGoogle()}
                className="py-1 text-zinc-600 hover:text-zinc-900 transition-colors whitespace-nowrap shrink-0 border-b-2 border-transparent"
              >
                {authBusy ? 'Вход...' : 'Войти'}
              </button>
            ) : (
              <button
                type="button"
                disabled={authBusy}
                onClick={() => void signOut()}
                className="py-1 text-zinc-500 hover:text-zinc-900 transition-colors whitespace-nowrap shrink-0 border-b-2 border-transparent"
              >
                Выйти
              </button>
            )}
          </nav>

          {/* Zone 3: 1 primary action */}
          <div className="flex items-center shrink-0">
            <button
              type="button"
              onClick={() => setCartOpen(true)}
              className="inline-flex items-center gap-2 rounded-lg bg-emerald-900 px-4 py-2 text-xs font-medium text-white hover:bg-emerald-800 transition-colors whitespace-nowrap shrink-0"
            >
              <ShoppingBag className="h-4 w-4" />
              <span className="tabular-nums">
                {cartCount > 0 ? `Корзина · ${cartCount}` : 'Корзина'}
              </span>
            </button>
          </div>
        </div>

        {/* Mobile navigation row */}
        <div className="md:hidden border-t border-zinc-200 px-4 py-2 flex items-center gap-4 overflow-x-auto text-xs font-medium">
          {navItems.map((item) => {
            const active = activeTab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setActiveTab(item.id)}
                className={`py-1 whitespace-nowrap shrink-0 border-b-2 ${
                  active
                    ? 'border-emerald-900 text-zinc-900'
                    : 'border-transparent text-zinc-600'
                }`}
              >
                {item.label}
              </button>
            );
          })}
          {!account ? (
            <button
              type="button"
              disabled={authBusy}
              onClick={() => void signInWithGoogle()}
              className="py-1 whitespace-nowrap shrink-0 text-emerald-900"
            >
              Войти
            </button>
          ) : (
            <button
              type="button"
              disabled={authBusy}
              onClick={() => void signOut()}
              className="py-1 whitespace-nowrap shrink-0 text-zinc-500"
            >
              Выйти
            </button>
          )}
        </div>
      </header>

      <main className="flex-1 mx-auto w-full max-w-[1280px] px-4 sm:px-8 py-6 sm:py-8 space-y-8">
        {/* Workspace Account & Role Bar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-zinc-200 pb-4 text-xs">
          {account ? (
            <div className="flex flex-wrap items-center gap-2 text-zinc-600">
              <span className="font-medium text-zinc-900">
                {account.displayName || account.email}
              </span>
              <span aria-hidden="true">·</span>
              <span>{account.email}</span>
              <span aria-hidden="true">·</span>
              <span
                className={`font-medium ${
                  account.role === 'admin' ? 'text-emerald-900' : 'text-zinc-800'
                }`}
              >
                {account.role === 'admin'
                  ? customerPreview
                    ? 'Администратор (предпросмотр покупателя)'
                    : 'Администратор · Полный доступ'
                  : 'Покупатель · Каталог и корзина'}
              </span>
            </div>
          ) : (
            <div className="text-zinc-600">
              Гостевой режим: просмотр каталога и подбор корзины. Войдите в аккаунт для оформления заказа.
            </div>
          )}

          <div className="flex flex-wrap items-center gap-3 shrink-0">
            {authError && <span className="text-red-700">{authError}</span>}
            {isTrueAdmin && (
              <button
                type="button"
                onClick={() => setCustomerPreview((prev) => !prev)}
                className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-300 bg-white px-3 py-1.5 text-xs font-medium text-zinc-800 hover:bg-zinc-50 transition-colors whitespace-nowrap"
              >
                <Eye className="h-3.5 w-3.5" />
                <span>
                  {customerPreview
                    ? 'Вернуться в режим администратора'
                    : 'Предпросмотр: Покупатель'}
                </span>
              </button>
            )}
            {!account ? (
              <button
                type="button"
                disabled={authBusy}
                onClick={() => void signInWithGoogle()}
                className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-300 bg-white px-3 py-1.5 text-xs font-medium text-zinc-800 hover:bg-zinc-50 transition-colors whitespace-nowrap"
              >
                <LogIn className="h-3.5 w-3.5" />
                <span>{authBusy ? 'Вход...' : 'Войти через Google'}</span>
              </button>
            ) : (
              <button
                type="button"
                disabled={authBusy}
                onClick={() => void signOut()}
                className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-200 bg-white px-3 py-1.5 text-xs font-medium text-zinc-600 hover:text-zinc-900 transition-colors whitespace-nowrap"
              >
                <LogOut className="h-3.5 w-3.5" />
                <span>Сменить аккаунт</span>
              </button>
            )}
          </div>
        </div>

        {loading ? (
          <div className="space-y-6 py-8">
            <div className="h-8 w-64 rounded-lg bg-zinc-200 animate-pulse" />
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {[1, 2, 3].map((idx) => (
                <div
                  key={idx}
                  className="h-72 rounded-xl border border-zinc-200 bg-white animate-pulse"
                />
              ))}
            </div>
          </div>
        ) : loadError ? (
          <div className="rounded-xl border border-red-200 bg-white p-8 text-center space-y-3">
            <p className="font-display text-base font-semibold text-zinc-900">
              Ошибка загрузки данных
            </p>
            <p className="text-sm text-red-700">{loadError}</p>
            <button
              type="button"
              onClick={() => void fetchStore()}
              className="rounded-lg bg-emerald-900 px-4 py-2 text-xs font-medium text-white hover:bg-emerald-800"
            >
              Повторить попытку
            </button>
          </div>
        ) : activeTab === 'catalog' ? (
          <CatalogView
            products={products}
            suppliers={suppliers}
            ordersCount={orders.length}
            isAdmin={effectiveIsAdmin}
            cart={cart}
            onAddToCart={handleAddToCart}
            onUpdateCartQty={handleUpdateCartQty}
            onNavigateTab={(tab) => setActiveTab(tab)}
          />
        ) : activeTab === 'inventory' && effectiveIsAdmin ? (
          <InventoryView
            products={products}
            suppliers={suppliers}
            movements={movements}
            onAdjustStock={handleAdjustStock}
            onCreateProduct={handleCreateProduct}
          />
        ) : activeTab === 'orders' && effectiveIsAdmin ? (
          <OrdersView
            orders={orders}
            onUpdateStatus={handleUpdateOrderStatus}
            onRepeatOrder={handleRepeatOrder}
          />
        ) : activeTab === 'suppliers' && effectiveIsAdmin ? (
          <SuppliersView
            suppliers={suppliers}
            products={products}
            onCreateSupplier={handleCreateSupplier}
            onUpdateSupplier={handleUpdateSupplier}
            onRestockProduct={handleAdjustStock}
          />
        ) : activeTab === 'accounts' && effectiveIsAdmin && account ? (
          <AccountsView
            users={usersList}
            currentUid={account.uid}
            onUpdateRole={handleUpdateUserRole}
          />
        ) : (
          <CatalogView
            products={products}
            suppliers={suppliers}
            ordersCount={orders.length}
            isAdmin={effectiveIsAdmin}
            cart={cart}
            onAddToCart={handleAddToCart}
            onUpdateCartQty={handleUpdateCartQty}
            onNavigateTab={(tab) => setActiveTab(tab)}
          />
        )}
      </main>

      <footer className="border-t border-zinc-200 bg-white mt-12">
        <div className="mx-auto max-w-[1280px] px-4 sm:px-8 py-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 text-xs text-zinc-500">
          <div>
            Лапа и Дом · Зоомагазин для владельцев питомцев и администраторов
          </div>
          <div className="flex flex-wrap items-center gap-4">
            <button
              type="button"
              onClick={() => setActiveTab('catalog')}
              className="hover:text-zinc-900 transition-colors"
            >
              Каталог
            </button>
            {effectiveIsAdmin && (
              <>
                <button
                  type="button"
                  onClick={() => setActiveTab('orders')}
                  className="hover:text-zinc-900 transition-colors"
                >
                  История покупок
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab('inventory')}
                  className="hover:text-zinc-900 transition-colors"
                >
                  Склад
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab('suppliers')}
                  className="hover:text-zinc-900 transition-colors"
                >
                  Поставщики
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab('accounts')}
                  className="hover:text-zinc-900 transition-colors"
                >
                  Аккаунты
                </button>
              </>
            )}
          </div>
        </div>
      </footer>

      <CartDrawer
        open={cartOpen}
        items={cart}
        isAuthenticated={Boolean(account)}
        isAdmin={effectiveIsAdmin}
        defaultCustomerName={account?.displayName ?? ''}
        authBusy={authBusy}
        onSignIn={signInWithGoogle}
        onClose={() => setCartOpen(false)}
        onUpdateQty={handleUpdateCartQty}
        onRemove={handleRemoveFromCart}
        onSubmitOrder={handleSubmitOrder}
        onGoToOrders={() => setActiveTab('orders')}
      />
    </div>
  );
}
