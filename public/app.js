const CATEGORIES = [
  { id: 'animals', label: 'Животные', description: 'Здоровые питомцы с ветпаспортом и рекомендациями по содержанию' },
  { id: 'supplies', label: 'Товары для животных', description: 'Лежанки, переноски, когтеточки, миски, игрушки и амуниция' },
  { id: 'food', label: 'Корма', description: 'Сбалансированные сухие и влажные рационы класса холистик и супер-премиум' },
  { id: 'care', label: 'Средства для ухода', description: 'Шампуни, расчески, гигиенические наполнители и уход за шерстью' },
  { id: 'treats', label: 'Лакомства', description: 'Натуральные сушеные снеки, косточки и поощрение для дрессировки' },
  { id: 'medicine', label: 'Лекарства', description: 'Ветеринарная аптека: витамины, пробиотики, защита от паразитов' },
];

const CATEGORY_LABELS = Object.fromEntries(CATEGORIES.map((c) => [c.id, c.label]));
const CATEGORY_IMAGES = {
  animals: '/images/cat_animals_companion_1795537999424.jpg',
  supplies: '/images/cat_pet_accessories_1795537998453.jpg',
  food: '/images/cat_food_premium_1795537996961.jpg',
  care: '/images/cat_care_grooming_1795537998190.jpg',
  treats: '/images/cat_treats_snacks_1795537998259.jpg',
  medicine: '/images/cat_medicine_vet_1795537998705.jpg',
};
const SPECIES_FILTERS = ['Все', 'Кошки', 'Собаки', 'Птицы', 'Грызуны', 'Рыбки'];
const PRODUCT_SPECIES = ['Собаки', 'Кошки', 'Птицы', 'Грызуны', 'Рыбки'];
const ORDER_STATUSES = ['В обработке', 'Выполнен', 'Доставлен', 'Отменён'];
const PAYMENT_METHODS = ['Картой при получении', 'Онлайн-оплата', 'Наличными курьеру'];

const state = {
  idToken: null,
  account: null,
  needsAdminSetup: false,
  authReady: true,
  authBusy: false,
  authError: null,
  customerPreview: false,

  activeTab: 'catalog',
  loading: true,
  loadError: null,

  products: [],
  suppliers: [],
  orders: [],
  myOrders: [],
  movements: [],
  users: [],

  // Catalog filters
  catalogCategory: 'all',
  catalogSpecies: 'Все',
  catalogSearch: '',

  // Inventory filters
  invSearch: '',
  invCategory: 'all',
  invStockFilter: 'all',

  // Orders filters
  ordSearch: '',
  ordStatus: 'all',
  expandedOrderId: null,
  expandedMyOrderId: null,

  // Suppliers search
  supSearch: '',

  // Cart
  cart: [],
  cartOpen: false,
  completedOrder: null,
  cartError: null,
};

// --- Safe DOM Helper ---
function el(tag, attrs = {}, ...children) {
  const node = document.createElement(tag);
  if (attrs) {
    for (const [key, val] of Object.entries(attrs)) {
      if (val === null || val === undefined || val === false) continue;
      if (key === 'className') {
        node.className = String(val);
      } else if (key.startsWith('on') && typeof val === 'function') {
        node.addEventListener(key.slice(2).toLowerCase(), val);
      } else if (key === 'value' && ('value' in node)) {
        node.value = val;
      } else if (key === 'disabled' || key === 'required' || key === 'selected') {
        if (val) node[key] = true;
      } else {
        node.setAttribute(key, String(val));
      }
    }
  }
  for (const child of children.flat()) {
    if (child === null || child === undefined || child === false) continue;
    if (child instanceof Node) {
      node.appendChild(child);
    } else {
      node.appendChild(document.createTextNode(String(child)));
    }
  }
  return node;
}

function createSearchWrap(inputNode) {
  const svgNs = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(svgNs, 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('fill', 'none');
  svg.setAttribute('stroke', 'currentColor');
  svg.setAttribute('stroke-width', '2');
  svg.setAttribute('aria-hidden', 'true');
  svg.setAttribute('class', 'icon-svg search-icon');
  const circle = document.createElementNS(svgNs, 'circle');
  circle.setAttribute('cx', '11');
  circle.setAttribute('cy', '11');
  circle.setAttribute('r', '8');
  const line = document.createElementNS(svgNs, 'line');
  line.setAttribute('x1', '21');
  line.setAttribute('y1', '21');
  line.setAttribute('x2', '16.65');
  line.setAttribute('y2', '16.65');
  svg.appendChild(circle);
  svg.appendChild(line);
  return el('div', { className: 'search-wrap' }, svg, inputNode);
}

let toastTimer = null;
function showToast(message, isError = false) {
  const prev = document.getElementById('appToast');
  if (prev) prev.remove();
  if (toastTimer) clearTimeout(toastTimer);
  const toast = el(
    'div',
    {
      id: 'appToast',
      role: 'status',
      className: `toast-banner ${isError ? 'toast-error' : ''}`,
    },
    message,
  );
  document.body.appendChild(toast);
  toastTimer = setTimeout(() => {
    toast.remove();
    toastTimer = null;
  }, 3200);
}

function escapeCsvCell(val) {
  let str = String(val ?? '');
  if (/^[=+\-@]/.test(str)) {
    str = `'${str}`;
  }
  return `"${str.replaceAll('"', '""')}"`;
}

function downloadCsv(filename, headers, rows) {
  const lines = [headers.map(escapeCsvCell).join(';')];
  for (const row of rows) {
    lines.push(row.map(escapeCsvCell).join(';'));
  }
  const blob = new Blob([`\uFEFF${lines.join('\r\n')}`], {
    type: 'text/csv;charset=utf-8;',
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
  showToast(`Файл «${filename}» выгружен`);
}

function createResilientImage(src, alt, className = '') {
  const img = el('img', {
    src,
    alt,
    referrerpolicy: 'no-referrer',
    className,
  });
  img.addEventListener('error', () => {
    const fallback = el('div', { className: `img-fallback ${className}` }, alt);
    img.replaceWith(fallback);
  });
  return img;
}

function formatRub(amount) {
  return `${new Intl.NumberFormat('ru-RU').format(Math.round(Number(amount) || 0))} ₽`;
}

function formatDateRu(iso) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return String(iso);
  return new Intl.DateTimeFormat('ru-RU', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(d);
}

function getStockState(stock, minStock) {
  if (stock <= 0) return { label: 'Нет в наличии', cls: 'stock-out' };
  if (stock <= minStock) return { label: 'Мало на складе', cls: 'stock-low' };
  return { label: 'В наличии', cls: 'stock-ok' };
}

function isTrueAdmin() {
  return state.account?.role === 'admin';
}

function isEffectiveAdmin() {
  return isTrueAdmin() && !state.customerPreview;
}

async function apiJson(url, options = {}) {
  const headers = {
    'Content-Type': 'application/json',
    ...(options.headers || {}),
  };
  if (state.idToken) {
    headers.Authorization = `Bearer ${state.idToken}`;
  }
  const res = await fetch(url, { ...options, headers });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.error || `Ошибка сервера (${res.status})`);
  }
  return data;
}

// --- Auth Actions ---
function openAuthModal(defaultMode) {
  let mode = defaultMode || (state.needsAdminSetup ? 'register' : 'login');
  const errBox = el('div', { className: 'alert-error hidden' });

  const nameInput = el('input', {
    type: 'text',
    className: 'input',
    placeholder: 'Например, Анна Смирнова',
    autocomplete: 'name',
  });
  const nameField = el(
    'div',
    null,
    el('label', { className: 'field-label' }, 'Имя и фамилия'),
    nameInput,
  );

  const emailInput = el('input', {
    type: 'email',
    className: 'input',
    placeholder: 'name@example.ru',
    autocomplete: 'email',
    required: true,
  });
  const passInput = el('input', {
    type: 'password',
    className: 'input',
    placeholder: 'Не менее 6 символов',
    minLength: 6,
    required: true,
  });

  const setupHint = state.needsAdminSetup
    ? el(
        'div',
        { className: 'alert-success', style: 'font-size:0.8125rem;' },
        'Первый зарегистрированный пользователь получит права администратора магазина.',
      )
    : null;

  const loginTabBtn = el('button', { type: 'button', className: 'seg-btn' }, 'Вход');
  const regTabBtn = el(
    'button',
    { type: 'button', className: 'seg-btn' },
    state.needsAdminSetup ? 'Создать администратора' : 'Регистрация',
  );
  const submitBtn = el('button', { type: 'submit', className: 'btn-primary' }, 'Войти');

  function syncMode() {
    const isReg = mode === 'register';
    loginTabBtn.className = `seg-btn ${!isReg ? 'active' : ''}`;
    regTabBtn.className = `seg-btn ${isReg ? 'active' : ''}`;
    nameField.classList.toggle('hidden', !isReg);
    nameInput.required = isReg;
    passInput.setAttribute('autocomplete', isReg ? 'new-password' : 'current-password');
    submitBtn.textContent = isReg
      ? state.needsAdminSetup
        ? 'Создать администратора'
        : 'Зарегистрироваться'
      : 'Войти';
    errBox.classList.add('hidden');
  }

  loginTabBtn.addEventListener('click', () => {
    mode = 'login';
    syncMode();
  });
  regTabBtn.addEventListener('click', () => {
    mode = 'register';
    syncMode();
  });

  const form = el(
    'form',
    { className: 'form-stack' },
    nameField,
    el('div', null, el('label', { className: 'field-label' }, 'Email'), emailInput),
    el('div', null, el('label', { className: 'field-label' }, 'Пароль'), passInput),
    el(
      'div',
      { className: 'modal-actions' },
      el('button', { type: 'button', className: 'btn-secondary', onClick: closeModal }, 'Отмена'),
      submitBtn,
    ),
  );

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    errBox.classList.add('hidden');
    state.authError = null;
    state.authBusy = true;
    submitBtn.disabled = true;
    submitBtn.textContent = mode === 'register' ? 'Регистрация...' : 'Вход...';

    try {
      const endpoint = mode === 'register' ? '/api/auth/register' : '/api/auth/login';
      const payload =
        mode === 'register'
          ? {
              displayName: nameInput.value.trim(),
              email: emailInput.value.trim(),
              password: passInput.value,
            }
          : {
              email: emailInput.value.trim(),
              password: passInput.value,
            };

      const data = await apiJson(endpoint, {
        method: 'POST',
        body: JSON.stringify(payload),
      });
      state.idToken = data.token;
      state.account = data.account;
      state.needsAdminSetup = false;
      closeModal();
      showToast(`Добро пожаловать, ${data.account.displayName || data.account.email}`);
      await fetchStore();
    } catch (err) {
      errBox.textContent = err instanceof Error ? err.message : 'Не удалось выполнить вход.';
      errBox.classList.remove('hidden');
      syncMode();
    } finally {
      state.authBusy = false;
      submitBtn.disabled = false;
    }
  });

  syncMode();

  openModal(
    el(
      'div',
      { className: 'form-stack' },
      el(
        'div',
        { style: 'display:flex; justify-content:space-between; align-items:center; gap:12px;' },
        el('h3', { style: 'font-size:1.125rem; font-weight:600;' }, 'Аккаунт «Лапа и Дом»'),
        el('button', { type: 'button', className: 'icon-btn', 'aria-label': 'Закрыть', onClick: closeModal }, '×'),
      ),
      el('div', { className: 'segmented-bar' }, loginTabBtn, regTabBtn),
      setupHint,
      errBox,
      form,
    ),
    true,
    'Вход и регистрация',
  );
}

async function signOut() {
  state.authBusy = true;
  state.authError = null;
  renderAll();
  try {
    state.idToken = null;
    state.account = null;
    state.customerPreview = false;
    state.activeTab = 'catalog';
    state.orders = [];
    state.myOrders = [];
    state.suppliers = [];
    state.movements = [];
    state.users = [];
    await fetchStore();
    showToast('Вы вышли из аккаунта');
  } finally {
    state.authBusy = false;
    renderAll();
  }
}

// --- Store Loading ---
async function fetchStore() {
  if (!state.authReady) return;
  state.loading = true;
  state.loadError = null;
  renderAll();
  try {
    const data = await apiJson('/api/store');
    state.account = data.account || null;
    state.needsAdminSetup = Boolean(data.needsAdminSetup);
    state.products = data.products || [];
    state.suppliers = data.suppliers || [];
    state.orders = data.orders || [];
    state.myOrders = data.myOrders || [];
    state.movements = data.stockMovements || [];
    state.users = data.users || [];
    if (state.orders.length > 0 && state.expandedOrderId === null) {
      state.expandedOrderId = state.orders[0].id;
    }
    if (state.myOrders.length > 0 && state.expandedMyOrderId === null) {
      state.expandedMyOrderId = state.myOrders[0].id;
    }
  } catch (err) {
    state.loadError = err instanceof Error ? err.message : 'Не удалось загрузить данные.';
  } finally {
    state.loading = false;
    renderAll();
  }
}

// --- Cart Helpers ---
function addToCart(product) {
  if (product.stock <= 0) return;
  const existing = state.cart.find((c) => c.product.id === product.id);
  if (existing) {
    existing.product = product;
    existing.quantity = Math.min(product.stock, existing.quantity + 1);
  } else {
    state.cart.push({ product, quantity: 1 });
  }
  showToast(`«${product.name}» добавлен в корзину`);
  renderAll();
}

function updateCartQty(productId, nextQty) {
  if (nextQty <= 0) {
    state.cart = state.cart.filter((c) => c.product.id !== productId);
  } else {
    state.cart = state.cart.map((c) =>
      c.product.id === productId
        ? { ...c, quantity: Math.min(c.product.stock, nextQty) }
        : c,
    );
  }
  renderAll();
}

function removeFromCart(productId) {
  state.cart = state.cart.filter((c) => c.product.id !== productId);
  renderAll();
}

function openCart() {
  state.cartOpen = true;
  state.cartError = null;
  renderCart();
}

function closeCart() {
  state.cartOpen = false;
  state.completedOrder = null;
  state.cartError = null;
  renderCart();
}

// --- Modal Helper ---
function openModal(contentNode, small = false, ariaLabel = 'Диалоговое окно') {
  const overlay = document.getElementById('modalOverlay');
  const dialog = document.getElementById('modalDialog');
  overlay.setAttribute('aria-label', ariaLabel);
  dialog.className = small ? 'modal-card modal-card-sm' : 'modal-card';
  dialog.replaceChildren(contentNode);
  overlay.classList.remove('hidden');
}

function closeModal() {
  const overlay = document.getElementById('modalOverlay');
  const dialog = document.getElementById('modalDialog');
  overlay.classList.add('hidden');
  dialog.replaceChildren();
}

// --- Navigation & Header ---
function setActiveTab(tab) {
  if (isEffectiveAdmin()) {
    state.activeTab = tab;
  } else if (state.account && (tab === 'catalog' || tab === 'my-orders')) {
    state.activeTab = tab;
  } else {
    state.activeTab = 'catalog';
  }
  renderAll();
}

function renderNav() {
  const admin = isEffectiveAdmin();
  const navItems = admin
    ? [
        { id: 'catalog', label: 'Каталог' },
        { id: 'orders', label: 'История покупок' },
        { id: 'inventory', label: 'Склад и остатки' },
        { id: 'suppliers', label: 'Поставщики' },
        { id: 'accounts', label: 'Аккаунты' },
      ]
    : state.account
      ? [
          { id: 'catalog', label: 'Каталог' },
          { id: 'my-orders', label: 'Мои заказы' },
        ]
      : [{ id: 'catalog', label: 'Каталог' }];

  const desktopNav = document.getElementById('desktopNav');
  const mobileNav = document.getElementById('mobileNav');
  const footerNav = document.getElementById('footerNav');

  const buildNavButtons = () => {
    const btns = navItems.map((item) =>
      el(
        'button',
        {
          type: 'button',
          className: `nav-link ${state.activeTab === item.id ? 'active' : ''}`,
          onClick: () => setActiveTab(item.id),
        },
        item.label,
      ),
    );
    if (!state.account) {
      btns.push(
        el(
          'button',
          {
            type: 'button',
            disabled: state.authBusy,
            className: 'nav-link',
            onClick: () => openAuthModal(state.needsAdminSetup ? 'register' : 'login'),
          },
          state.authBusy ? 'Вход...' : 'Войти',
        ),
      );
    } else {
      btns.push(
        el(
          'button',
          {
            type: 'button',
            disabled: state.authBusy,
            className: 'nav-link nav-link-muted',
            onClick: () => void signOut(),
          },
          'Выйти',
        ),
      );
    }
    return btns;
  };

  desktopNav.replaceChildren(...buildNavButtons());
  mobileNav.replaceChildren(...buildNavButtons());

  footerNav.replaceChildren(
    ...navItems.map((item) =>
      el(
        'button',
        {
          type: 'button',
          className: 'footer-link-btn',
          onClick: () => setActiveTab(item.id),
        },
        item.label,
      ),
    ),
  );

  const count = state.cart.reduce((s, c) => s + c.quantity, 0);
  document.getElementById('cartCountLabel').textContent =
    count > 0 ? `Корзина · ${count}` : 'Корзина';
}

function renderAccountBar() {
  const bar = document.getElementById('accountBar');
  const infoNodes = [];

  if (state.account) {
    const roleLabel =
      state.account.role === 'admin'
        ? state.customerPreview
          ? 'Администратор (предпросмотр покупателя)'
          : 'Администратор · Полный доступ'
        : 'Покупатель · Каталог и корзина';

    infoNodes.push(
      el('strong', null, state.account.displayName || state.account.email),
      el('span', { 'aria-hidden': 'true' }, '·'),
      el('span', null, state.account.email),
      el('span', { 'aria-hidden': 'true' }, '·'),
      el(
        'span',
        {
          className:
            state.account.role === 'admin' ? 'role-label-admin' : 'role-label-customer',
        },
        roleLabel,
      ),
    );
  } else {
    infoNodes.push(
      el(
        'span',
        null,
        'Гостевой режим: просмотр каталога и подбор корзины. Войдите в аккаунт для оформления заказа.',
      ),
    );
  }

  const controls = [];
  if (state.authError) {
    controls.push(el('span', { className: 'stock-out' }, state.authError));
  }
  if (isTrueAdmin()) {
    controls.push(
      el(
        'button',
        {
          type: 'button',
          className: 'btn-secondary btn-sm',
          onClick: () => {
            state.customerPreview = !state.customerPreview;
            if (!isEffectiveAdmin() && state.activeTab !== 'catalog') {
              state.activeTab = 'catalog';
            }
            renderAll();
          },
        },
        state.customerPreview ? 'Вернуться в режим администратора' : 'Предпросмотр: Покупатель',
      ),
    );
  }
  if (!state.account) {
    controls.push(
      el(
        'button',
        {
          type: 'button',
          disabled: state.authBusy,
          className: 'btn-secondary btn-sm',
          onClick: () => openAuthModal(state.needsAdminSetup ? 'register' : 'login'),
        },
        state.needsAdminSetup ? 'Создать администратора' : 'Войти / Регистрация',
      ),
    );
  } else {
    controls.push(
      el(
        'button',
        {
          type: 'button',
          disabled: state.authBusy,
          className: 'btn-secondary btn-sm',
          onClick: () => void signOut(),
        },
        'Сменить аккаунт',
      ),
    );
  }

  bar.replaceChildren(
    el('div', { className: 'account-info' }, ...infoNodes),
    el('div', { className: 'account-controls' }, ...controls),
  );
}

// --- View 1: Catalog ---
function renderCatalogView(root) {
  const admin = isEffectiveAdmin();
  const cartQtyMap = new Map(state.cart.map((c) => [c.product.id, c.quantity]));
  const totalUnits = state.products.reduce((s, p) => s + p.stock, 0);
  const lowCount = state.products.filter((p) => p.stock <= p.minStock).length;
  const availableCount = state.products.filter((p) => p.stock > 0).length;

  const heroSection = el(
    'section',
    { className: 'hero-split' },
    el(
      'div',
      { className: 'hero-copy' },
      el(
        'div',
        null,
        el('p', { className: 'hero-kicker' }, 'Ветеринарный контроль и прямые поставки'),
        el('h1', { className: 'hero-title' }, 'Зоомагазин полного цикла: питомцы, рационы и уход'),
        el(
          'p',
          { className: 'hero-subtitle' },
          'Шесть профильных категорий — от декоративных животных и холистик-кормов до ветеринарной аптеки и аксессуаров с актуальным наличием в реальном времени.',
        ),
      ),
      el(
        'div',
        { className: 'hero-actions' },
        el(
          'button',
          {
            type: 'button',
            className: 'btn-primary',
            onClick: () => {
              document.getElementById('catalogSection')?.scrollIntoView({ behavior: 'smooth' });
            },
          },
          'Выбрать товары',
        ),
        admin &&
          el(
            'button',
            {
              type: 'button',
              className: 'btn-secondary',
              onClick: () => setActiveTab('inventory'),
            },
            'Остатки на складе',
          ),
      ),
    ),
    el(
      'div',
      { className: 'hero-media' },
      createResilientImage(
        '/images/hero_pet_boutique_1795537997932.jpg',
        'Зоомаркет Лапа и Дом — зал кормов, лежанок и ухода за питомцами',
      ),
    ),
  );

  const kpiStrip = admin
    ? el(
        'section',
        { className: 'kpi-strip' },
        el(
          'div',
          null,
          el('div', { className: 'kpi-label' }, 'Позиций в каталоге'),
          el('div', { className: 'kpi-value tabular-nums' }, state.products.length),
          el('div', { className: 'kpi-sub' }, '6 категорий ассортимента'),
        ),
        el(
          'div',
          null,
          el('div', { className: 'kpi-label' }, 'Единиц на складе'),
          el('div', { className: 'kpi-value tabular-nums' }, totalUnits),
          el(
            'div',
            { className: 'kpi-sub' },
            lowCount > 0 ? `${lowCount} требуют пополнения` : 'Все остатки в норме',
          ),
        ),
        el(
          'div',
          null,
          el('div', { className: 'kpi-label' }, 'Надёжных поставщиков'),
          el('div', { className: 'kpi-value tabular-nums' }, state.suppliers.length),
          el('div', { className: 'kpi-sub' }, 'Прямые договоры поставки'),
        ),
        el(
          'div',
          null,
          el('div', { className: 'kpi-label' }, 'Заказов в истории'),
          el('div', { className: 'kpi-value tabular-nums' }, state.orders.length),
          el('div', { className: 'kpi-sub' }, 'Прозрачная отчётность'),
        ),
      )
    : el(
        'section',
        { className: 'kpi-strip' },
        el(
          'div',
          null,
          el('div', { className: 'kpi-label' }, 'Доступно в каталоге'),
          el('div', { className: 'kpi-value tabular-nums' }, availableCount),
          el('div', { className: 'kpi-sub' }, 'Готовы к отправке'),
        ),
        el(
          'div',
          null,
          el('div', { className: 'kpi-label' }, 'Профильных категорий'),
          el('div', { className: 'kpi-value tabular-nums' }, '6'),
          el('div', { className: 'kpi-sub' }, 'Корма, уход, аптека и питомцы'),
        ),
        el(
          'div',
          null,
          el('div', { className: 'kpi-label' }, 'Бесплатная доставка'),
          el('div', { className: 'kpi-value tabular-nums' }, 'от 3 000 ₽'),
          el('div', { className: 'kpi-sub' }, 'Курьером до двери'),
        ),
        el(
          'div',
          null,
          el('div', { className: 'kpi-label' }, 'Гарантия качества'),
          el('div', { className: 'kpi-value' }, '100%'),
          el('div', { className: 'kpi-sub' }, 'Сертифицированные поставщики'),
        ),
      );

  const searchInput = el('input', {
    type: 'search',
    className: 'input input-search',
    value: state.catalogSearch,
    placeholder: 'Поиск по названию, артикулу, составу...',
  });
  searchInput.addEventListener('input', (e) => {
    state.catalogSearch = e.target.value;
    updateCatalogGridOnly();
  });

  const catButtons = [
    el(
      'button',
      {
        type: 'button',
        className: `seg-btn ${state.catalogCategory === 'all' ? 'active' : ''}`,
        onClick: () => {
          state.catalogCategory = 'all';
          renderMainView();
        },
      },
      'Все категории',
    ),
    ...CATEGORIES.map((cat) =>
      el(
        'button',
        {
          type: 'button',
          className: `seg-btn ${state.catalogCategory === cat.id ? 'active' : ''}`,
          onClick: () => {
            state.catalogCategory = cat.id;
            renderMainView();
          },
        },
        cat.label,
      ),
    ),
  ];

  const speciesButtons = SPECIES_FILTERS.map((sp) =>
    el(
      'button',
      {
        type: 'button',
        className: `species-btn ${state.catalogSpecies === sp ? 'active' : ''}`,
        onClick: () => {
          state.catalogSpecies = sp;
          renderMainView();
        },
      },
      sp,
    ),
  );

  const gridContainer = el('div', { id: 'catalogGridSlot' });

  const catalogSection = el(
    'section',
    { id: 'catalogSection', className: 'section-block' },
    el(
      'div',
      { className: 'section-header-row' },
      el(
        'div',
        null,
        el('h2', { className: 'section-title' }, 'Каталог зоотоваров и питомцев'),
        el(
          'p',
          { className: 'section-desc' },
          state.catalogCategory === 'all'
            ? 'Все категории ассортимента с актуальным остатком в реальном времени'
            : CATEGORIES.find((c) => c.id === state.catalogCategory)?.description || '',
        ),
      ),
      el('div', null, createSearchWrap(searchInput)),
    ),
    el('div', { className: 'segmented-bar' }, ...catButtons),
    el(
      'div',
      { className: 'species-row' },
      el('span', { style: 'color: var(--ink-muted);' }, 'Питомец:'),
      ...speciesButtons,
    ),
    gridContainer,
  );

  root.replaceChildren(heroSection, kpiStrip, catalogSection);
  updateCatalogGridOnly(cartQtyMap);
}

function updateCatalogGridOnly(existingCartMap) {
  const slot = document.getElementById('catalogGridSlot');
  if (!slot) return;

  const cartQtyMap =
    existingCartMap || new Map(state.cart.map((c) => [c.product.id, c.quantity]));
  const q = state.catalogSearch.trim().toLowerCase();

  const filtered = state.products.filter((p) => {
    if (state.catalogCategory !== 'all' && p.category !== state.catalogCategory) return false;
    if (state.catalogSpecies !== 'Все' && p.species !== state.catalogSpecies) return false;
    if (q) {
      const hay = `${p.name} ${p.sku} ${p.specs} ${p.description} ${p.supplierName || ''}`.toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });

  if (filtered.length === 0) {
    slot.replaceChildren(
      el(
        'div',
        { className: 'empty-card' },
        el('h3', { style: 'font-size: 1rem; font-weight: 600;' }, 'По заданным фильтрам товары не найдены'),
        el('p', { style: 'font-size: 0.875rem; color: var(--ink-muted);' }, 'Сбросьте поиск или выберите другую категорию.'),
        el(
          'button',
          {
            type: 'button',
            className: 'btn-secondary btn-sm',
            onClick: () => {
              state.catalogCategory = 'all';
              state.catalogSpecies = 'Все';
              state.catalogSearch = '';
              renderMainView();
            },
          },
          'Показать весь каталог',
        ),
      ),
    );
    return;
  }

  const cards = filtered.map((product) => {
    const stockState = getStockState(product.stock, product.minStock);
    const inCartQty = cartQtyMap.get(product.id) || 0;
    const meta = [
      CATEGORY_LABELS[product.category] || product.category,
      product.species,
      product.supplierName,
    ]
      .filter(Boolean)
      .join(' · ');

    const actionEl =
      inCartQty > 0
        ? el(
            'div',
            { className: 'qty-stepper' },
            el(
              'button',
              {
                type: 'button',
                className: 'qty-btn',
                'aria-label': 'Уменьшить количество',
                onClick: () => updateCartQty(product.id, inCartQty - 1),
              },
              '−',
            ),
            el('span', { className: 'qty-val tabular-nums' }, inCartQty),
            el(
              'button',
              {
                type: 'button',
                className: 'qty-btn',
                disabled: inCartQty >= product.stock,
                'aria-label': 'Увеличить количество',
                onClick: () => updateCartQty(product.id, inCartQty + 1),
              },
              '+',
            ),
          )
        : el(
            'button',
            {
              type: 'button',
              className: 'btn-primary btn-sm',
              disabled: product.stock <= 0,
              onClick: () => addToCart(product),
            },
            product.stock > 0 ? 'В корзину' : 'Нет в наличии',
          );

    return el(
      'article',
      { className: 'product-card' },
      el(
        'div',
        null,
        el(
          'button',
          {
            type: 'button',
            className: 'product-thumb-btn',
            onClick: () => openProductModal(product),
          },
          createResilientImage(product.imageUrl, product.name),
        ),
        el(
          'div',
          { className: 'product-card-body' },
          el('div', { className: 'meta-line' }, meta),
          el(
            'button',
            {
              type: 'button',
              className: 'product-title-btn',
              onClick: () => openProductModal(product),
            },
            product.name,
          ),
          el('p', { className: 'product-specs' }, product.specs),
        ),
      ),
      el(
        'div',
        { className: 'product-card-footer' },
        el(
          'div',
          null,
          el('div', { className: 'price-text tabular-nums' }, formatRub(product.price)),
          el(
            'div',
            { className: `stock-text tabular-nums ${stockState.cls}` },
            `${stockState.label} · ${product.stock} ${product.unit}`,
          ),
        ),
        actionEl,
      ),
    );
  });

  slot.replaceChildren(el('div', { className: 'product-grid' }, ...cards));
}

function openProductModal(product) {
  const inCartQty = state.cart.find((c) => c.product.id === product.id)?.quantity || 0;
  const node = el(
    'div',
    { className: 'pdp-grid' },
    el('div', { className: 'pdp-media' }, createResilientImage(product.imageUrl, product.name)),
    el(
      'div',
      { className: 'pdp-content' },
      el(
        'div',
        { className: 'form-stack' },
        el(
          'div',
          { style: 'display:flex; justify-content:space-between; align-items:flex-start; gap:12px;' },
          el(
            'div',
            { className: 'meta-line' },
            `${CATEGORY_LABELS[product.category]} · ${product.species} · ${product.sku}`,
          ),
          el(
            'button',
            { type: 'button', className: 'icon-btn', 'aria-label': 'Закрыть', onClick: closeModal },
            '×',
          ),
        ),
        el('h3', { style: 'font-size:1.25rem; font-weight:600; line-height:1.3;' }, product.name),
        el('p', { style: 'font-size:0.875rem; color:var(--ink-secondary); line-height:1.55;' }, product.description),
        el(
          'div',
          { style: 'border-top:1px solid var(--border); padding-top:12px; display:flex; flex-direction:column; gap:6px; font-size:0.75rem;' },
          el(
            'div',
            { style: 'display:flex; justify-content:space-between; gap:8px;' },
            el('span', { style: 'color:var(--ink-muted);' }, 'Характеристики'),
            el('span', { style: 'font-weight:500; text-align:right;' }, product.specs),
          ),
          el(
            'div',
            { style: 'display:flex; justify-content:space-between; gap:8px;' },
            el('span', { style: 'color:var(--ink-muted);' }, 'Поставщик'),
            el('span', { style: 'font-weight:500; text-align:right;' }, product.supplierName || '—'),
          ),
          el(
            'div',
            { style: 'display:flex; justify-content:space-between; gap:8px;' },
            el('span', { style: 'color:var(--ink-muted);' }, 'Остаток на складе'),
            el('span', { className: 'font-mono tabular-nums', style: 'font-weight:600;' }, `${product.stock} ${product.unit}`),
          ),
        ),
      ),
      el(
        'div',
        { style: 'border-top:1px solid var(--border); padding-top:16px; display:flex; align-items:center; justify-content:space-between; gap:12px;' },
        el('div', { className: 'font-mono tabular-nums', style: 'font-size:1.25rem; font-weight:600;' }, formatRub(product.price)),
        el(
          'button',
          {
            type: 'button',
            className: 'btn-primary',
            disabled: product.stock <= 0 || inCartQty >= product.stock,
            onClick: () => {
              addToCart(product);
              closeModal();
            },
          },
          product.stock > 0 ? 'Добавить в корзину' : 'Нет в наличии',
        ),
      ),
    ),
  );
  openModal(node, false, product.name);
}

// --- View 2: Inventory ---
function renderInventoryView(root) {
  let totalUnits = 0;
  let totalWholesale = 0;
  let lowCount = 0;
  let outCount = 0;
  for (const p of state.products) {
    totalUnits += p.stock;
    totalWholesale += p.stock * p.purchasePrice;
    if (p.stock <= 0) outCount += 1;
    else if (p.stock <= p.minStock) lowCount += 1;
  }

  const header = el(
    'div',
    { className: 'page-header-row' },
    el(
      'div',
      null,
      el('h1', { className: 'page-title' }, 'Склад и учёт остатков'),
      el('p', { className: 'section-desc' }, 'Контроль складских запасов, минимальных порогов, приёмка поставок и журнал движения товаров.'),
    ),
    el(
      'div',
      { style: 'display:flex; flex-wrap:wrap; gap:8px;' },
      el(
        'button',
        {
          type: 'button',
          className: 'btn-secondary',
          onClick: () => {
            downloadCsv(
              'ostatki-sklada.csv',
              ['Артикул', 'Наименование', 'Категория', 'Питомец', 'Поставщик', 'Закупка ₽', 'Розница ₽', 'Остаток', 'Мин. порог', 'Ед. изм.'],
              state.products.map((p) => [
                p.sku,
                p.name,
                CATEGORY_LABELS[p.category] || p.category,
                p.species,
                p.supplierName || '',
                p.purchasePrice,
                p.price,
                p.stock,
                p.minStock,
                p.unit,
              ]),
            );
          },
        },
        'Экспорт CSV',
      ),
      el(
        'button',
        {
          type: 'button',
          className: 'btn-primary',
          onClick: () => openProductModalForm(null),
        },
        '+ Добавить товар',
      ),
    ),
  );

  const kpis = el(
    'div',
    { className: 'kpi-strip' },
    el('div', null, el('div', { className: 'kpi-label' }, 'Общий остаток'), el('div', { className: 'kpi-value tabular-nums' }, `${totalUnits} ед.`)),
    el('div', null, el('div', { className: 'kpi-label' }, 'Стоимость склада (закупка)'), el('div', { className: 'kpi-value tabular-nums' }, formatRub(totalWholesale))),
    el('div', null, el('div', { className: 'kpi-label' }, 'Низкий остаток'), el('div', { className: 'kpi-value kpi-value-amber tabular-nums' }, `${lowCount} поз.`)),
    el('div', null, el('div', { className: 'kpi-label' }, 'Отсутствуют на складе'), el('div', { className: 'kpi-value kpi-value-crimson tabular-nums' }, `${outCount} поз.`)),
  );

  const catSelect = el(
    'select',
    { className: 'select select-inline', 'aria-label': 'Фильтр по категории' },
    el('option', { value: 'all', selected: state.invCategory === 'all' }, 'Все категории'),
    ...CATEGORIES.map((c) =>
      el('option', { value: c.id, selected: state.invCategory === c.id }, c.label),
    ),
  );
  catSelect.addEventListener('change', (e) => {
    state.invCategory = e.target.value;
    renderMainView();
  });

  const searchInput = el('input', {
    type: 'search',
    className: 'input input-search',
    value: state.invSearch,
    placeholder: 'Артикул, товар, поставщик...',
  });
  searchInput.addEventListener('input', (e) => {
    state.invSearch = e.target.value;
    updateInventoryTableOnly();
  });

  const filtersRow = el(
    'div',
    { style: 'display:flex; flex-wrap:wrap; align-items:center; justify-content:space-between; gap:12px;' },
    el(
      'div',
      { style: 'display:flex; flex-wrap:wrap; align-items:center; gap:8px;' },
      el(
        'div',
        { className: 'segmented-bar' },
        ...[
          { id: 'all', label: 'Все позиции' },
          { id: 'low', label: 'Мало на складе' },
          { id: 'out', label: 'Нет в наличии' },
        ].map((tab) =>
          el(
            'button',
            {
              type: 'button',
              className: `seg-btn ${state.invStockFilter === tab.id ? 'active' : ''}`,
              onClick: () => {
                state.invStockFilter = tab.id;
                renderMainView();
              },
            },
            tab.label,
          ),
        ),
      ),
      catSelect,
    ),
    createSearchWrap(searchInput),
  );

  const tableSlot = el('div', { id: 'inventoryTableSlot' });

  const ledgerSection = el(
    'section',
    { className: 'section-block' },
    el(
      'div',
      null,
      el('h2', { style: 'font-size:1.125rem; font-weight:600;' }, 'Журнал движения товаров'),
      el('p', { style: 'font-size:0.75rem; color:var(--ink-muted); margin-top:2px;' }, 'Последние приёмки от поставщиков, продажи по заказам и ручные корректировки остатков.'),
    ),
    el(
      'div',
      { className: 'table-card' },
      el(
        'div',
        { className: 'table-scroll' },
        el(
          'table',
          { className: 'data-table', style: 'font-size:0.75rem;' },
          el(
            'thead',
            null,
            el(
              'tr',
              null,
              el('th', null, 'Дата и время'),
              el('th', null, 'Операция'),
              el('th', null, 'Товар'),
              el('th', { className: 'text-right' }, 'Изменение'),
              el('th', { className: 'text-right' }, 'Остаток после'),
              el('th', null, 'Основание'),
            ),
          ),
          el(
            'tbody',
            null,
            ...state.movements.slice(0, 20).map((mov) =>
              el(
                'tr',
                null,
                el('td', { className: 'tabular-nums nowrap', style: 'color:var(--ink-muted);' }, formatDateRu(mov.createdAt)),
                el('td', { className: 'nowrap', style: 'font-weight:500;' }, mov.type),
                el('td', null, el('span', { className: 'font-mono', style: 'color:var(--ink-muted); margin-right:6px;' }, mov.sku), mov.productName),
                el(
                  'td',
                  {
                    className: `text-right font-mono tabular-nums nowrap ${mov.delta > 0 ? 'stock-ok' : 'stock-out'}`,
                    style: 'font-weight:600;',
                  },
                  mov.delta > 0 ? `+${mov.delta}` : String(mov.delta),
                ),
                el('td', { className: 'text-right font-mono tabular-nums nowrap' }, mov.balanceAfter),
                el('td', { style: 'color:var(--ink-secondary);' }, mov.note),
              ),
            ),
          ),
        ),
      ),
    ),
  );

  root.replaceChildren(header, kpis, filtersRow, tableSlot, ledgerSection);
  updateInventoryTableOnly();
}

function updateInventoryTableOnly() {
  const slot = document.getElementById('inventoryTableSlot');
  if (!slot) return;
  const q = state.invSearch.trim().toLowerCase();

  const filtered = state.products.filter((p) => {
    if (state.invCategory !== 'all' && p.category !== state.invCategory) return false;
    if (state.invStockFilter === 'low' && (p.stock <= 0 || p.stock > p.minStock)) return false;
    if (state.invStockFilter === 'out' && p.stock > 0) return false;
    if (q) {
      const hay = `${p.sku} ${p.name} ${p.supplierName || ''}`.toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });

  const rows =
    filtered.length === 0
      ? [
          el(
            'tr',
            null,
            el('td', { colSpan: 7, style: 'text-align:center; padding:32px; color:var(--ink-muted);' }, 'По выбранным условиям позиции не найдены.'),
          ),
        ]
      : filtered.map((p) => {
          const st = getStockState(p.stock, p.minStock);
          return el(
            'tr',
            null,
            el('td', { className: 'font-mono nowrap', style: 'font-size:0.75rem; color:var(--ink-secondary);' }, p.sku),
            el(
              'td',
              null,
              el('div', { style: 'font-weight:500;' }, p.name),
              el('div', { style: 'font-size:0.75rem; color:var(--ink-muted);' }, `${CATEGORY_LABELS[p.category]} · ${p.species}`),
            ),
            el('td', { style: 'font-size:0.75rem; color:var(--ink-secondary);' }, p.supplierName || '—'),
            el(
              'td',
              { className: 'text-right font-mono tabular-nums nowrap' },
              el('div', { style: 'font-weight:500;' }, formatRub(p.price)),
              el('div', { style: 'font-size:0.75rem; color:var(--ink-muted);' }, formatRub(p.purchasePrice)),
            ),
            el(
              'td',
              { className: 'text-right font-mono tabular-nums nowrap' },
              el('strong', null, p.stock),
              el('span', { style: 'color:var(--ink-muted);' }, ` / ${p.minStock} `),
              el('span', { style: 'font-family:var(--font-sans); font-size:0.75rem; color:var(--ink-muted);' }, p.unit),
            ),
            el('td', { className: `nowrap ${st.cls}`, style: 'font-size:0.75rem;' }, st.label),
            el(
              'td',
              { className: 'text-right nowrap' },
              el(
                'div',
                { style: 'display:inline-flex; gap:6px;' },
                el(
                  'button',
                  {
                    type: 'button',
                    className: 'btn-secondary btn-sm',
                    onClick: () => openStockAdjustModal(p, 'in'),
                  },
                  'Приход',
                ),
                el(
                  'button',
                  {
                    type: 'button',
                    className: 'btn-secondary btn-sm',
                    disabled: p.stock <= 0,
                    onClick: () => openStockAdjustModal(p, 'out'),
                  },
                  'Списание',
                ),
                el(
                  'button',
                  {
                    type: 'button',
                    className: 'btn-secondary btn-sm',
                    onClick: () => openProductModalForm(p),
                  },
                  'Изм.',
                ),
              ),
            ),
          );
        });

  slot.replaceChildren(
    el(
      'div',
      { className: 'table-card' },
      el(
        'div',
        { className: 'table-scroll' },
        el(
          'table',
          { className: 'data-table' },
          el(
            'thead',
            null,
            el(
              'tr',
              null,
              el('th', null, 'Артикул'),
              el('th', null, 'Товар и категория'),
              el('th', null, 'Поставщик'),
              el('th', { className: 'text-right' }, 'Закупка / Розница'),
              el('th', { className: 'text-right' }, 'Остаток / Мин.'),
              el('th', null, 'Статус'),
              el('th', { className: 'text-right' }, 'Операции'),
            ),
          ),
          el('tbody', null, ...rows),
        ),
      ),
    ),
  );
}

function openStockAdjustModal(product, mode) {
  const isIncoming = mode === 'in';
  const errBox = el('div', { className: 'alert-error hidden' });
  const qtyInput = el('input', {
    type: 'number',
    className: 'input font-mono tabular-nums',
    min: 1,
    max: isIncoming ? 9999 : product.stock,
    value: isIncoming ? 10 : 1,
    required: true,
  });
  const supSelect = el(
    'select',
    { className: 'select' },
    ...state.suppliers.map((s) =>
      el('option', { value: s.id, selected: s.id === product.supplierId }, s.name),
    ),
  );
  const noteInput = el('input', {
    type: 'text',
    className: 'input',
    placeholder: isIncoming ? 'Например, Накладная №518' : 'Например, Повреждение упаковки',
  });
  const submitBtn = el('button', { type: 'submit', className: 'btn-primary' }, 'Подтвердить');

  const form = el(
    'form',
    { className: 'form-stack' },
    el('div', null, el('label', { className: 'field-label' }, `Количество (${product.unit})`), qtyInput),
    isIncoming ? el('div', null, el('label', { className: 'field-label' }, 'Поставщик'), supSelect) : null,
    el('div', null, el('label', { className: 'field-label' }, 'Комментарий / накладная'), noteInput),
    el(
      'div',
      { className: 'modal-actions' },
      el('button', { type: 'button', className: 'btn-secondary', onClick: closeModal }, 'Отмена'),
      submitBtn,
    ),
  );

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const qty = Math.trunc(Number(qtyInput.value));
    if (!Number.isFinite(qty) || qty <= 0) {
      errBox.textContent = 'Введите положительное целое число.';
      errBox.classList.remove('hidden');
      return;
    }
    submitBtn.disabled = true;
    submitBtn.textContent = 'Сохранение...';
    errBox.classList.add('hidden');
    try {
      const res = await apiJson(`/api/products/${product.id}/stock`, {
        method: 'PATCH',
        body: JSON.stringify({
          delta: isIncoming ? qty : -qty,
          type: isIncoming ? 'Приход от поставщика' : 'Списание',
          supplierId: isIncoming ? Number(supSelect.value) : undefined,
          note: noteInput.value.trim(),
        }),
      });
      state.products = state.products.map((p) => (p.id === res.product.id ? res.product : p));
      state.movements = [res.movement, ...state.movements];
      state.cart = state.cart
        .map((c) =>
          c.product.id === res.product.id
            ? { product: res.product, quantity: Math.min(c.quantity, res.product.stock) }
            : c,
        )
        .filter((c) => c.quantity > 0);
      closeModal();
      showToast(isIncoming ? `Приход +${qty} ${product.unit} оформлен` : `Списано ${qty} ${product.unit}`);
      renderAll();
    } catch (err) {
      errBox.textContent = err instanceof Error ? err.message : 'Ошибка обновления остатка.';
      errBox.classList.remove('hidden');
    } finally {
      submitBtn.disabled = false;
      submitBtn.textContent = 'Подтвердить';
    }
  });

  openModal(
    el(
      'div',
      { className: 'form-stack' },
      el(
        'div',
        { style: 'display:flex; justify-content:space-between; align-items:flex-start; gap:12px;' },
        el(
          'div',
          null,
          el('h3', { style: 'font-size:1.125rem; font-weight:600;' }, isIncoming ? 'Приход товара на склад' : 'Списание со склада'),
          el('p', { style: 'font-size:0.75rem; color:var(--ink-muted); margin-top:2px;' }, `${product.name} · сейчас ${product.stock} ${product.unit}`),
        ),
        el('button', { type: 'button', className: 'icon-btn', 'aria-label': 'Закрыть', onClick: closeModal }, '×'),
      ),
      errBox,
      form,
    ),
    true,
    'Корректировка остатка',
  );
}

function openProductModalForm(existing) {
  const isEdit = Boolean(existing);
  const errBox = el('div', { className: 'alert-error hidden' });
  const skuInput = el('input', { type: 'text', className: 'input font-mono', value: existing?.sku || '', placeholder: 'FD-1099', required: true });
  const nameInput = el('input', { type: 'text', className: 'input', value: existing?.name || '', placeholder: 'Название товара или питомца', required: true });
  const catSelect = el('select', { className: 'select' }, ...CATEGORIES.map((c) => el('option', { value: c.id, selected: existing?.category === c.id }, c.label)));
  const spSelect = el('select', { className: 'select' }, ...PRODUCT_SPECIES.map((s) => el('option', { value: s, selected: existing?.species === s }, s)));
  const supSelect = el('select', { className: 'select' }, ...state.suppliers.map((s) => el('option', { value: s.id, selected: existing?.supplierId === s.id }, s.name)));
  const priceInput = el('input', { type: 'number', className: 'input font-mono tabular-nums', min: 1, value: existing?.price || '', required: true });
  const buyInput = el('input', { type: 'number', className: 'input font-mono tabular-nums', min: 0, value: existing ? existing.purchasePrice : '' });
  const stockInput = el('input', { type: 'number', className: 'input font-mono tabular-nums', min: 0, value: existing ? existing.stock : 10, disabled: isEdit, required: !isEdit });
  const minInput = el('input', { type: 'number', className: 'input font-mono tabular-nums', min: 0, value: existing ? existing.minStock : 5, required: true });
  const unitInput = el('input', { type: 'text', className: 'input', value: existing?.unit || 'шт', required: true });
  const imageInput = el('input', { type: 'text', className: 'input font-mono', value: existing?.imageUrl || '', placeholder: 'Авто по категории или /images/...' });
  const specsInput = el('input', { type: 'text', className: 'input', value: existing?.specs || '', placeholder: 'Беззерновой · Лосось · 2 кг' });
  const descInput = el('textarea', { className: 'textarea', rows: 2, placeholder: 'Подробное описание' });
  descInput.value = existing?.description || '';

  const submitBtn = el('button', { type: 'submit', className: 'btn-primary' }, isEdit ? 'Сохранить изменения' : 'Сохранить товар');

  let confirmDelete = false;
  const deleteBtn = isEdit
    ? el(
        'button',
        {
          type: 'button',
          className: 'btn-danger-outline',
          onClick: async () => {
            if (!confirmDelete) {
              confirmDelete = true;
              deleteBtn.textContent = 'Точно удалить?';
              return;
            }
            errBox.classList.add('hidden');
            deleteBtn.disabled = true;
            try {
              await apiJson(`/api/products/${existing.id}`, { method: 'DELETE' });
              state.products = state.products.filter((p) => p.id !== existing.id);
              state.cart = state.cart.filter((c) => c.product.id !== existing.id);
              state.movements = await apiJson('/api/stock-movements');
              closeModal();
              showToast(`Товар «${existing.name}» удалён`);
              renderAll();
            } catch (err) {
              errBox.textContent = err instanceof Error ? err.message : 'Не удалось удалить товар.';
              errBox.classList.remove('hidden');
              confirmDelete = false;
              deleteBtn.textContent = 'Удалить товар';
              deleteBtn.disabled = false;
            }
          },
        },
        'Удалить товар',
      )
    : null;

  const form = el(
    'form',
    { className: 'form-stack' },
    el('div', { className: 'form-grid-2' }, el('div', null, el('label', { className: 'field-label' }, 'Артикул'), skuInput), el('div', null, el('label', { className: 'field-label' }, 'Наименование'), nameInput)),
    el('div', { className: 'form-grid-3' }, el('div', null, el('label', { className: 'field-label' }, 'Категория'), catSelect), el('div', null, el('label', { className: 'field-label' }, 'Вид животного'), spSelect), el('div', null, el('label', { className: 'field-label' }, 'Поставщик'), supSelect)),
    el('div', { className: 'form-grid-3' }, el('div', null, el('label', { className: 'field-label' }, 'Цена (₽)'), priceInput), el('div', null, el('label', { className: 'field-label' }, 'Закупка (₽)'), buyInput), el('div', null, el('label', { className: 'field-label' }, 'Ед. изм.'), unitInput)),
    el('div', { className: 'form-grid-2' }, el('div', null, el('label', { className: 'field-label' }, isEdit ? 'Текущий остаток (через Приход/Списание)' : 'Начальный остаток'), stockInput), el('div', null, el('label', { className: 'field-label' }, 'Мин. порог'), minInput)),
    el('div', { className: 'form-grid-2' }, el('div', null, el('label', { className: 'field-label' }, 'Характеристики'), specsInput), el('div', null, el('label', { className: 'field-label' }, 'Изображение (/images/... или https://...)'), imageInput)),
    el('div', null, el('label', { className: 'field-label' }, 'Описание'), descInput),
    el(
      'div',
      { className: 'modal-actions', style: isEdit ? 'justify-content:space-between;' : '' },
      deleteBtn,
      el('div', { style: 'display:flex; gap:8px;' }, el('button', { type: 'button', className: 'btn-secondary', onClick: closeModal }, 'Отмена'), submitBtn),
    ),
  );

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    errBox.classList.add('hidden');
    submitBtn.disabled = true;
    submitBtn.textContent = 'Сохранение...';
    try {
      const price = Number(priceInput.value);
      const payload = {
        sku: skuInput.value,
        name: nameInput.value,
        category: catSelect.value,
        species: spSelect.value,
        supplierId: Number(supSelect.value),
        price,
        purchasePrice: Number(buyInput.value || Math.round(price * 0.65)),
        minStock: Number(minInput.value),
        unit: unitInput.value,
        imageUrl: imageInput.value.trim() || CATEGORY_IMAGES[catSelect.value],
        specs: specsInput.value,
        description: descInput.value,
      };
      if (isEdit) {
        const updated = await apiJson(`/api/products/${existing.id}`, {
          method: 'PUT',
          body: JSON.stringify(payload),
        });
        state.products = state.products.map((p) => (p.id === updated.id ? updated : p));
        state.cart = state.cart.map((c) => (c.product.id === updated.id ? { ...c, product: updated } : c));
        closeModal();
        showToast(`Карточка «${updated.name}» обновлена`);
      } else {
        const created = await apiJson('/api/products', {
          method: 'POST',
          body: JSON.stringify({ ...payload, stock: Number(stockInput.value) }),
        });
        state.products = [created, ...state.products];
        state.movements = await apiJson('/api/stock-movements');
        closeModal();
        showToast(`Товар «${created.name}» добавлен`);
      }
      renderAll();
    } catch (err) {
      errBox.textContent = err instanceof Error ? err.message : 'Не удалось сохранить товар.';
      errBox.classList.remove('hidden');
    } finally {
      submitBtn.disabled = false;
      submitBtn.textContent = isEdit ? 'Сохранить изменения' : 'Сохранить товар';
    }
  });

  openModal(
    el(
      'div',
      { style: 'padding:24px;' },
      el('div', { className: 'form-stack' }, el('div', { style: 'display:flex; justify-content:space-between; align-items:center;' }, el('h3', { style: 'font-size:1.125rem; font-weight:600;' }, isEdit ? 'Редактирование карточки товара' : 'Новая позиция на склад и в каталог'), el('button', { type: 'button', className: 'icon-btn', 'aria-label': 'Закрыть', onClick: closeModal }, '×')), errBox, form),
    ),
    false,
    isEdit ? 'Редактирование товара' : 'Новый товар',
  );
}

// --- View 3: Purchase History ---
function renderOrdersView(root) {
  const activeOrders = state.orders.filter((o) => o.status !== 'Отменён');
  const revenue = activeOrders.reduce((s, o) => s + o.totalAmount, 0);
  const avgCheck = activeOrders.length > 0 ? revenue / activeOrders.length : 0;
  const processing = state.orders.filter((o) => o.status === 'В обработке').length;

  const header = el(
    'div',
    { className: 'page-header-row' },
    el('div', null, el('h1', { className: 'page-title' }, 'История покупок и заказов'), el('p', { className: 'section-desc' }, 'Все оформленные покупки, товарные чеки, управление статусами доставки и быстрый повтор заказа.')),
    el(
      'button',
      {
        type: 'button',
        className: 'btn-secondary',
        onClick: () => {
          downloadCsv(
            'istoriya-pokupok.csv',
            ['Номер заказа', 'Дата', 'Покупатель', 'Телефон', 'Адрес доставки', 'Оплата', 'Статус', 'Сумма ₽'],
            state.orders.map((o) => [
              o.orderNumber,
              formatDateRu(o.createdAt),
              o.customerName,
              o.customerPhone,
              o.deliveryAddress,
              o.paymentMethod,
              o.status,
              o.totalAmount,
            ]),
          );
        },
      },
      'Экспорт CSV',
    ),
  );

  const kpis = el(
    'div',
    { className: 'kpi-strip' },
    el('div', null, el('div', { className: 'kpi-label' }, 'Всего заказов'), el('div', { className: 'kpi-value tabular-nums' }, state.orders.length)),
    el('div', null, el('div', { className: 'kpi-label' }, 'Общая выручка'), el('div', { className: 'kpi-value tabular-nums' }, formatRub(revenue))),
    el('div', null, el('div', { className: 'kpi-label' }, 'Средний чек'), el('div', { className: 'kpi-value tabular-nums' }, formatRub(avgCheck))),
    el('div', null, el('div', { className: 'kpi-label' }, 'Ожидают сборки'), el('div', { className: 'kpi-value kpi-value-amber tabular-nums' }, processing)),
  );

  const searchInput = el('input', {
    type: 'search',
    className: 'input input-search',
    value: state.ordSearch,
    placeholder: 'Номер заказа, клиент, товар...',
  });
  searchInput.addEventListener('input', (e) => {
    state.ordSearch = e.target.value;
    updateOrdersListOnly();
  });

  const filterBar = el(
    'div',
    { style: 'display:flex; flex-wrap:wrap; align-items:center; justify-content:space-between; gap:12px;' },
    el(
      'div',
      { className: 'segmented-bar' },
      el(
        'button',
        {
          type: 'button',
          className: `seg-btn ${state.ordStatus === 'all' ? 'active' : ''}`,
          onClick: () => {
            state.ordStatus = 'all';
            renderMainView();
          },
        },
        'Все',
      ),
      ...ORDER_STATUSES.map((st) =>
        el(
          'button',
          {
            type: 'button',
            className: `seg-btn ${state.ordStatus === st ? 'active' : ''}`,
            onClick: () => {
              state.ordStatus = st;
              renderMainView();
            },
          },
          st,
        ),
      ),
    ),
    createSearchWrap(searchInput),
  );

  const errorBanner = el('div', { id: 'ordersErrorBanner', className: 'alert-error hidden' });
  const listSlot = el('div', { id: 'ordersListSlot' });

  root.replaceChildren(header, kpis, errorBanner, filterBar, listSlot);
  updateOrdersListOnly();
}

function updateOrdersListOnly() {
  const slot = document.getElementById('ordersListSlot');
  if (!slot) return;
  const q = state.ordSearch.trim().toLowerCase();

  const filtered = state.orders.filter((order) => {
    if (state.ordStatus !== 'all' && order.status !== state.ordStatus) return false;
    if (q) {
      const itemsText = order.items.map((i) => `${i.productName} ${i.sku}`).join(' ');
      const hay = `${order.orderNumber} ${order.customerName} ${order.customerPhone} ${itemsText}`.toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });

  if (filtered.length === 0) {
    slot.replaceChildren(
      el(
        'div',
        { className: 'empty-card' },
        el('h3', { style: 'font-size:1rem; font-weight:600;' }, 'Заказы не найдены'),
        el('p', { style: 'font-size:0.875rem; color:var(--ink-muted);' }, 'Попробуйте изменить фильтр статуса или поисковый запрос.'),
      ),
    );
    return;
  }

  const cards = filtered.map((order) => {
    const expanded = state.expandedOrderId === order.id;
    const statusCls =
      order.status === 'Доставлен' || order.status === 'Выполнен'
        ? 'stock-ok'
        : order.status === 'В обработке'
          ? 'stock-low'
          : 'stock-out';

    const statusSelect = el(
      'select',
      { className: 'select select-inline', 'aria-label': `Статус заказа ${order.orderNumber}` },
      ...ORDER_STATUSES.map((st) =>
        el('option', { value: st, selected: order.status === st }, st),
      ),
    );
    statusSelect.addEventListener('change', async (e) => {
      const nextStatus = e.target.value;
      const errBanner = document.getElementById('ordersErrorBanner');
      errBanner?.classList.add('hidden');
      statusSelect.disabled = true;
      try {
        const res = await apiJson(`/api/orders/${order.id}/status`, {
          method: 'PATCH',
          body: JSON.stringify({ status: nextStatus }),
        });
        state.orders = state.orders.map((o) => (o.id === res.order.id ? res.order : o));
        state.myOrders = state.myOrders.map((o) => (o.id === res.order.id ? res.order : o));
        state.products = res.products;
        state.movements = res.stockMovements;
        showToast(`Статус заказа ${order.orderNumber}: ${nextStatus}`);
        renderMainView();
      } catch (err) {
        if (errBanner) {
          errBanner.textContent = err instanceof Error ? err.message : 'Ошибка изменения статуса.';
          errBanner.classList.remove('hidden');
        }
        statusSelect.value = order.status;
      } finally {
        statusSelect.disabled = false;
      }
    });

    const repeatBtn = el(
      'button',
      {
        type: 'button',
        className: 'btn-secondary btn-sm',
        onClick: () => {
          const pMap = new Map(state.products.map((p) => [p.id, p]));
          const nextCart = [];
          for (const item of order.items) {
            const fresh = pMap.get(item.productId);
            if (fresh && fresh.stock > 0) {
              nextCart.push({ product: fresh, quantity: Math.min(fresh.stock, item.quantity) });
            }
          }
          if (nextCart.length > 0) {
            state.cart = nextCart;
            state.cartOpen = true;
            showToast(`Товары из заказа ${order.orderNumber} добавлены в корзину`);
            renderAll();
          } else {
            showToast('Товары из этого заказа сейчас отсутствуют на складе', true);
          }
        },
      },
      'Повторить',
    );

    const toggleBtn = el(
      'button',
      {
        type: 'button',
        className: 'btn-secondary btn-sm',
        onClick: () => {
          state.expandedOrderId = expanded ? null : order.id;
          updateOrdersListOnly();
        },
      },
      expanded ? 'Скрыть состав' : 'Состав',
    );

    const itemsSection = expanded
      ? el(
          'div',
          { className: 'order-card-items table-scroll' },
          el(
            'table',
            { className: 'data-table', style: 'font-size:0.75rem;' },
            el(
              'thead',
              null,
              el(
                'tr',
                null,
                el('th', null, 'Артикул'),
                el('th', null, 'Наименование'),
                el('th', null, 'Категория'),
                el('th', { className: 'text-right' }, 'Кол-во'),
                el('th', { className: 'text-right' }, 'Цена'),
                el('th', { className: 'text-right' }, 'Сумма'),
              ),
            ),
            el(
              'tbody',
              null,
              ...order.items.map((it) =>
                el(
                  'tr',
                  null,
                  el('td', { className: 'font-mono nowrap', style: 'color:var(--ink-muted);' }, it.sku),
                  el('td', { style: 'font-weight:500;' }, it.productName),
                  el('td', { className: 'nowrap', style: 'color:var(--ink-secondary);' }, CATEGORY_LABELS[it.category] || it.category),
                  el('td', { className: 'text-right font-mono tabular-nums' }, it.quantity),
                  el('td', { className: 'text-right font-mono tabular-nums', style: 'color:var(--ink-secondary);' }, formatRub(it.unitPrice)),
                  el('td', { className: 'text-right font-mono tabular-nums', style: 'font-weight:600;' }, formatRub(it.subtotal)),
                ),
              ),
            ),
          ),
        )
      : null;

    return el(
      'article',
      { className: 'order-card' },
      el(
        'div',
        { className: 'order-card-head' },
        el(
          'div',
          { style: 'display:flex; flex-direction:column; gap:4px;' },
          el(
            'div',
            { className: 'meta-line' },
            el('span', { className: 'font-mono', style: 'font-weight:600; color:var(--ink);' }, order.orderNumber),
            ' · ',
            el('span', { className: 'tabular-nums' }, formatDateRu(order.createdAt)),
            ' · ',
            el('span', { className: statusCls, style: 'font-weight:500;' }, order.status),
          ),
          el('div', { style: 'font-family:var(--font-display); font-weight:600; font-size:1rem;' }, order.customerName, el('span', { style: 'font-family:var(--font-sans); font-weight:400; font-size:0.875rem; color:var(--ink-muted); margin-left:8px;' }, order.customerPhone)),
          el('div', { style: 'font-size:0.75rem; color:var(--ink-muted);' }, `${order.deliveryAddress} · ${order.paymentMethod}`),
        ),
        el(
          'div',
          { style: 'display:flex; flex-wrap:wrap; align-items:center; gap:10px;' },
          el(
            'div',
            { className: 'text-right', style: 'margin-right:8px;' },
            el('div', { className: 'font-mono tabular-nums', style: 'font-size:1.125rem; font-weight:600;' }, formatRub(order.totalAmount)),
            el('div', { className: 'tabular-nums', style: 'font-size:0.75rem; color:var(--ink-muted);' }, `Позиций: ${order.items.reduce((s, i) => s + i.quantity, 0)}`),
          ),
          statusSelect,
          repeatBtn,
          toggleBtn,
        ),
      ),
      itemsSection,
    );
  });

  slot.replaceChildren(el('div', { className: 'orders-list' }, ...cards));
}

// --- View 4: Suppliers ---
function renderSuppliersView(root) {
  const header = el(
    'div',
    { className: 'page-header-row' },
    el('div', null, el('h1', { className: 'page-title' }, 'Поставщики и закупки'), el('p', { className: 'section-desc' }, 'База партнёров по кормам, питомникам, ветеринарной аптеке и аксессуарам с оформлением поставок.')),
    el('button', { type: 'button', className: 'btn-primary', onClick: () => openSupplierModal(null) }, '+ Новый поставщик'),
  );

  const searchInput = el('input', {
    type: 'search',
    className: 'input input-search',
    value: state.supSearch,
    placeholder: 'Поиск по названию, городу, категории...',
  });
  searchInput.addEventListener('input', (e) => {
    state.supSearch = e.target.value;
    updateSuppliersGridOnly();
  });

  const bar = el(
    'div',
    { style: 'display:flex; flex-wrap:wrap; align-items:center; justify-content:space-between; gap:12px;' },
    el('div', { style: 'font-size:0.875rem; color:var(--ink-secondary);' }, 'Активных партнёров: ', el('strong', { className: 'tabular-nums', style: 'color:var(--ink);' }, state.suppliers.length)),
    createSearchWrap(searchInput),
  );

  const gridSlot = el('div', { id: 'suppliersGridSlot' });
  root.replaceChildren(header, bar, gridSlot);
  updateSuppliersGridOnly();
}

function updateSuppliersGridOnly() {
  const slot = document.getElementById('suppliersGridSlot');
  if (!slot) return;
  const q = state.supSearch.trim().toLowerCase();

  const filtered = state.suppliers.filter((s) => {
    if (!q) return true;
    const catsText = s.categories.map((c) => CATEGORY_LABELS[c] || c).join(' ');
    return `${s.name} ${s.contactPerson} ${s.city} ${catsText}`.toLowerCase().includes(q);
  });

  const bySup = new Map();
  for (const p of state.products) {
    const arr = bySup.get(p.supplierId) || [];
    arr.push(p);
    bySup.set(p.supplierId, arr);
  }

  const cards = filtered.map((sup) => {
    const linked = bySup.get(sup.id) || [];
    const lowCount = linked.filter((p) => p.stock <= p.minStock).length;

    return el(
      'article',
      { className: 'supplier-card' },
      el(
        'div',
        { className: 'form-stack' },
        el(
          'div',
          { style: 'display:flex; justify-content:space-between; align-items:flex-start; gap:12px;' },
          el(
            'div',
            null,
            el('div', { className: 'meta-line' }, `${sup.city} · Срок поставки ${sup.leadTimeDays} дн.`),
            el('h2', { style: 'font-size:1.125rem; font-weight:600; margin-top:4px;' }, sup.name),
          ),
          el('button', { type: 'button', className: 'btn-secondary btn-sm', onClick: () => openSupplierModal(sup) }, 'Изменить'),
        ),
        el('div', { style: 'font-size:0.75rem; color:var(--ink-secondary);' }, 'Категории: ', el('strong', { style: 'color:var(--ink);' }, sup.categories.map((c) => CATEGORY_LABELS[c] || c).join(' · '))),
        el(
          'div',
          { className: 'supplier-meta-grid' },
          el('div', null, el('span', { style: 'color:var(--ink-muted); display:block;' }, 'Контактное лицо'), el('strong', null, sup.contactPerson)),
          el('div', null, el('span', { style: 'color:var(--ink-muted); display:block;' }, 'Телефон и почта'), el('div', { className: 'font-mono' }, sup.phone), el('div', { style: 'color:var(--ink-secondary);' }, sup.email)),
        ),
        sup.notes ? el('p', { style: 'font-size:0.75rem; color:var(--ink-secondary); line-height:1.5;' }, sup.notes) : null,
        el(
          'div',
          { className: 'supplier-products-box' },
          el(
            'div',
            { style: 'display:flex; justify-content:space-between;' },
            el('strong', null, `Позиции в каталоге (${linked.length})`),
            lowCount > 0 ? el('span', { className: 'stock-low' }, `Требуют дозаказа: ${lowCount}`) : null,
          ),
          linked.length === 0
            ? el('p', { style: 'color:var(--ink-muted); margin-top:6px;' }, 'Товары ещё не привязаны.')
            : el(
                'ul',
                { className: 'supplier-products-list' },
                ...linked.slice(0, 4).map((p) =>
                  el(
                    'li',
                    null,
                    el('span', { style: 'color:var(--ink-secondary); overflow:hidden; text-overflow:ellipsis; white-space:nowrap;' }, p.name),
                    el('span', { className: `font-mono tabular-nums nowrap ${p.stock <= p.minStock ? 'stock-low' : ''}` }, `${p.stock} ${p.unit}`),
                  ),
                ),
                linked.length > 4 ? el('li', { style: 'color:var(--ink-muted);' }, `и ещё ${linked.length - 4} поз.`) : null,
              ),
        ),
      ),
      el(
        'div',
        { style: 'border-top:1px solid #f4f4f5; padding-top:14px; display:flex; justify-content:flex-end;' },
        el('button', { type: 'button', className: 'btn-primary btn-sm', onClick: () => openRestockModal(sup, linked) }, 'Оформить поставку на склад'),
      ),
    );
  });

  slot.replaceChildren(el('div', { className: 'suppliers-grid' }, ...cards));
}

function openSupplierModal(existing) {
  const errBox = el('div', { className: 'alert-error hidden' });
  let selectedCats = existing ? [...existing.categories] : ['food'];

  const nameInput = el('input', { type: 'text', className: 'input', value: existing?.name || '', placeholder: 'ООО «ЗооЛогистика»', required: true });
  const contactInput = el('input', { type: 'text', className: 'input', value: existing?.contactPerson || '', placeholder: 'Иван Петров', required: true });
  const phoneInput = el('input', { type: 'tel', className: 'input', value: existing?.phone || '', placeholder: '+7 (495) 000-00-00', required: true });
  const cityInput = el('input', { type: 'text', className: 'input', value: existing?.city || 'Москва' });
  const leadInput = el('input', { type: 'number', className: 'input font-mono tabular-nums', min: 1, max: 60, value: existing?.leadTimeDays || 2 });
  const emailInput = el('input', { type: 'email', className: 'input', value: existing?.email || '', placeholder: 'b2b@company.ru' });
  const notesInput = el('textarea', { className: 'textarea', rows: 2, value: existing?.notes || '', placeholder: 'Условия оплаты, график отгрузок' });
  notesInput.value = existing?.notes || '';

  const catRow = el('div', { style: 'display:flex; flex-wrap:wrap; gap:6px;' });
  function renderCatChips() {
    catRow.replaceChildren(
      ...CATEGORIES.map((c) => {
        const active = selectedCats.includes(c.id);
        return el(
          'button',
          {
            type: 'button',
            className: `species-btn ${active ? 'active' : ''}`,
            onClick: () => {
              if (active && selectedCats.length > 1) {
                selectedCats = selectedCats.filter((id) => id !== c.id);
              } else if (!active) {
                selectedCats.push(c.id);
              }
              renderCatChips();
            },
          },
          c.label,
        );
      }),
    );
  }
  renderCatChips();

  let confirmDelete = false;
  const deleteSupBtn = existing
    ? el(
        'button',
        {
          type: 'button',
          className: 'btn-danger-outline',
          onClick: async () => {
            if (!confirmDelete) {
              confirmDelete = true;
              deleteSupBtn.textContent = 'Точно удалить?';
              return;
            }
            errBox.classList.add('hidden');
            deleteSupBtn.disabled = true;
            try {
              await apiJson(`/api/suppliers/${existing.id}`, { method: 'DELETE' });
              state.suppliers = state.suppliers.filter((s) => s.id !== existing.id);
              closeModal();
              showToast(`Поставщик «${existing.name}» удалён`);
              renderAll();
            } catch (err) {
              errBox.textContent = err instanceof Error ? err.message : 'Не удалось удалить поставщика.';
              errBox.classList.remove('hidden');
              confirmDelete = false;
              deleteSupBtn.textContent = 'Удалить';
              deleteSupBtn.disabled = false;
            }
          },
        },
        'Удалить',
      )
    : null;

  const submitBtn = el('button', { type: 'submit', className: 'btn-primary' }, 'Сохранить');
  const form = el(
    'form',
    { className: 'form-stack' },
    el('div', null, el('label', { className: 'field-label' }, 'Название компании или питомника'), nameInput),
    el('div', { className: 'form-grid-2' }, el('div', null, el('label', { className: 'field-label' }, 'Контактное лицо'), contactInput), el('div', null, el('label', { className: 'field-label' }, 'Телефон'), phoneInput)),
    el('div', { className: 'form-grid-3' }, el('div', null, el('label', { className: 'field-label' }, 'Город'), cityInput), el('div', null, el('label', { className: 'field-label' }, 'Срок (дней)'), leadInput), el('div', null, el('label', { className: 'field-label' }, 'Email'), emailInput)),
    el('div', null, el('span', { className: 'field-label' }, 'Поставляемые категории'), catRow),
    el('div', null, el('label', { className: 'field-label' }, 'Примечания'), notesInput),
    el(
      'div',
      { className: 'modal-actions', style: existing ? 'justify-content:space-between;' : '' },
      deleteSupBtn,
      el('div', { style: 'display:flex; gap:8px;' }, el('button', { type: 'button', className: 'btn-secondary', onClick: closeModal }, 'Отмена'), submitBtn),
    ),
  );

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    errBox.classList.add('hidden');
    submitBtn.disabled = true;
    submitBtn.textContent = 'Сохранение...';
    try {
      const payload = {
        name: nameInput.value,
        contactPerson: contactInput.value,
        phone: phoneInput.value,
        email: emailInput.value,
        city: cityInput.value,
        leadTimeDays: Number(leadInput.value),
        categories: selectedCats,
        notes: notesInput.value,
      };
      if (existing) {
        const updated = await apiJson(`/api/suppliers/${existing.id}`, {
          method: 'PUT',
          body: JSON.stringify(payload),
        });
        state.suppliers = state.suppliers.map((s) => (s.id === updated.id ? updated : s));
        showToast(`Поставщик «${updated.name}» обновлён`);
      } else {
        const created = await apiJson('/api/suppliers', {
          method: 'POST',
          body: JSON.stringify(payload),
        });
        state.suppliers = [created, ...state.suppliers];
        showToast(`Поставщик «${created.name}» добавлен`);
      }
      closeModal();
      renderAll();
    } catch (err) {
      errBox.textContent = err instanceof Error ? err.message : 'Ошибка сохранения.';
      errBox.classList.remove('hidden');
    } finally {
      submitBtn.disabled = false;
      submitBtn.textContent = 'Сохранить';
    }
  });

  openModal(
    el(
      'div',
      { style: 'padding:24px;' },
      el('div', { className: 'form-stack' }, el('div', { style: 'display:flex; justify-content:space-between; align-items:center;' }, el('h3', { style: 'font-size:1.125rem; font-weight:600;' }, existing ? 'Редактирование поставщика' : 'Новый поставщик'), el('button', { type: 'button', className: 'icon-btn', 'aria-label': 'Закрыть', onClick: closeModal }, '×')), errBox, form),
    ),
    false,
    'Карточка поставщика',
  );
}

function openRestockModal(supplier, linked) {
  const list = linked.length > 0 ? linked : state.products;
  const errBox = el('div', { className: 'alert-error hidden' });
  const prodSelect = el(
    'select',
    { className: 'select' },
    ...list.map((p) => el('option', { value: p.id }, `${p.sku} — ${p.name} (остаток: ${p.stock})`)),
  );
  const qtyInput = el('input', { type: 'number', className: 'input font-mono tabular-nums', min: 1, value: 12, required: true });
  const noteInput = el('input', { type: 'text', className: 'input', value: `Поставка от ${supplier.name}` });
  const submitBtn = el('button', { type: 'submit', className: 'btn-primary' }, 'Оприходовать на склад');

  const form = el(
    'form',
    { className: 'form-stack' },
    el('div', null, el('label', { className: 'field-label' }, 'Товарная позиция'), prodSelect),
    el('div', null, el('label', { className: 'field-label' }, 'Количество поставки'), qtyInput),
    el('div', null, el('label', { className: 'field-label' }, 'Накладная / комментарий'), noteInput),
    el('div', { className: 'modal-actions' }, el('button', { type: 'button', className: 'btn-secondary', onClick: closeModal }, 'Отмена'), submitBtn),
  );

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const qty = Math.trunc(Number(qtyInput.value));
    if (!Number.isFinite(qty) || qty <= 0) {
      errBox.textContent = 'Введите положительное количество.';
      errBox.classList.remove('hidden');
      return;
    }
    submitBtn.disabled = true;
    submitBtn.textContent = 'Приёмка...';
    errBox.classList.add('hidden');
    try {
      const res = await apiJson(`/api/products/${Number(prodSelect.value)}/stock`, {
        method: 'PATCH',
        body: JSON.stringify({
          delta: qty,
          type: 'Приход от поставщика',
          supplierId: supplier.id,
          note: noteInput.value.trim(),
        }),
      });
      state.products = state.products.map((p) => (p.id === res.product.id ? res.product : p));
      state.movements = [res.movement, ...state.movements];
      closeModal();
      showToast(`Поставка +${qty} оприходована на склад`);
      renderAll();
    } catch (err) {
      errBox.textContent = err instanceof Error ? err.message : 'Не удалось принять поставку.';
      errBox.classList.remove('hidden');
    } finally {
      submitBtn.disabled = false;
      submitBtn.textContent = 'Оприходовать на склад';
    }
  });

  openModal(
    el(
      'div',
      { className: 'form-stack' },
      el('div', { style: 'display:flex; justify-content:space-between; align-items:flex-start;' }, el('div', null, el('h3', { style: 'font-size:1.125rem; font-weight:600;' }, 'Приёмка поставки'), el('p', { style: 'font-size:0.75rem; color:var(--ink-muted); margin-top:2px;' }, supplier.name)), el('button', { type: 'button', className: 'icon-btn', 'aria-label': 'Закрыть', onClick: closeModal }, '×')),
      errBox,
      form,
    ),
    true,
    'Приёмка поставки',
  );
}

// --- View 5: Accounts ---
function renderAccountsView(root) {
  const adminCount = state.users.filter((u) => u.role === 'admin').length;
  const customerCount = state.users.filter((u) => u.role === 'customer').length;
  const errBanner = el('div', { className: 'alert-error hidden' });

  const rows = state.users.map((u) => {
    const isSelf = u.uid === state.account?.uid;
    const isAdmin = u.role === 'admin';
    const roleSelect = el(
      'select',
      {
        className: 'select select-inline',
        disabled: isSelf,
        'aria-label': `Роль для ${u.email}`,
      },
      el('option', { value: 'admin', selected: u.role === 'admin' }, 'Администратор'),
      el('option', { value: 'customer', selected: u.role === 'customer' }, 'Покупатель'),
    );

    roleSelect.addEventListener('change', async (e) => {
      errBanner.classList.add('hidden');
      roleSelect.disabled = true;
      try {
        const updated = await apiJson(`/api/users/${u.id}/role`, {
          method: 'PATCH',
          body: JSON.stringify({ role: e.target.value }),
        });
        state.users = state.users.map((item) => (item.id === updated.id ? updated : item));
        renderMainView();
      } catch (err) {
        errBanner.textContent = err instanceof Error ? err.message : 'Не удалось изменить роль.';
        errBanner.classList.remove('hidden');
        roleSelect.value = u.role;
      } finally {
        if (!isSelf) roleSelect.disabled = false;
      }
    });

    return el(
      'tr',
      null,
      el(
        'td',
        null,
        el('div', { style: 'font-weight:500;' }, u.displayName || 'Без имени', isSelf ? el('span', { style: 'color:var(--accent); font-size:0.75rem; margin-left:6px;' }, '(Вы)') : null),
        el('div', { className: 'font-mono', style: 'font-size:0.75rem; color:var(--ink-muted);' }, u.uid),
      ),
      el('td', null, u.email),
      el('td', { className: 'tabular-nums nowrap', style: 'font-size:0.75rem; color:var(--ink-muted);' }, formatDateRu(u.createdAt)),
      el(
        'td',
        { className: `nowrap ${isAdmin ? 'role-label-admin' : ''}`, style: 'font-size:0.75rem;' },
        isAdmin ? 'Администратор (полный доступ)' : 'Покупатель (каталог и корзина)',
      ),
      el('td', { className: 'text-right nowrap' }, roleSelect),
    );
  });

  root.replaceChildren(
    el(
      'div',
      { className: 'page-header-row' },
      el('div', null, el('h1', { className: 'page-title' }, 'Учётные записи и роли доступа'), el('p', { className: 'section-desc' }, 'Администратор управляет каталогом, складом, поставщиками, историей покупок и ролями. Покупатель имеет доступ к каталогу и корзине.')),
    ),
    el(
      'div',
      { className: 'kpi-strip', style: 'grid-template-columns: repeat(3, 1fr);' },
      el('div', null, el('div', { className: 'kpi-label' }, 'Всего аккаунтов'), el('div', { className: 'kpi-value tabular-nums' }, state.users.length)),
      el('div', null, el('div', { className: 'kpi-label' }, 'Администраторов'), el('div', { className: 'kpi-value role-label-admin tabular-nums' }, adminCount)),
      el('div', null, el('div', { className: 'kpi-label' }, 'Покупателей'), el('div', { className: 'kpi-value tabular-nums' }, customerCount)),
    ),
    errBanner,
    el(
      'div',
      { className: 'table-card' },
      el(
        'div',
        { className: 'table-scroll' },
        el(
          'table',
          { className: 'data-table' },
          el('thead', null, el('tr', null, el('th', null, 'Пользователь'), el('th', null, 'Email'), el('th', null, 'Дата регистрации'), el('th', null, 'Текущие права'), el('th', { className: 'text-right' }, 'Назначить роль'))),
          el('tbody', null, ...rows),
        ),
      ),
    ),
  );
}

// --- Cart Drawer ---
function renderCart() {
  const overlay = document.getElementById('cartOverlay');
  const titleEl = document.getElementById('cartDrawerTitle');
  const body = document.getElementById('cartDrawerBody');

  if (!state.cartOpen) {
    overlay.classList.add('hidden');
    return;
  }
  overlay.classList.remove('hidden');

  if (state.completedOrder) {
    const ord = state.completedOrder;
    titleEl.textContent = 'Заказ подтверждён';

    const itemsRows = ord.items.map((it) =>
      el(
        'div',
        { style: 'display:flex; justify-content:space-between; gap:12px; font-size:0.875rem;' },
        el('span', { style: 'overflow:hidden; text-overflow:ellipsis; white-space:nowrap;' }, it.productName, el('span', { className: 'font-mono', style: 'color:var(--ink-muted); margin-left:6px;' }, `×${it.quantity}`)),
        el('span', { className: 'font-mono tabular-nums nowrap', style: 'font-weight:600;' }, formatRub(it.subtotal)),
      ),
    );

    const actionButtons = [
      isEffectiveAdmin()
        ? el(
            'button',
            {
              type: 'button',
              className: 'btn-primary',
              style: 'flex:1;',
              onClick: () => {
                closeCart();
                setActiveTab('orders');
              },
            },
            'Открыть историю покупок',
          )
        : state.account
          ? el(
              'button',
              {
                type: 'button',
                className: 'btn-primary',
                style: 'flex:1;',
                onClick: () => {
                  closeCart();
                  setActiveTab('my-orders');
                },
              },
              'Мои заказы',
            )
          : null,
      el(
        'button',
        { type: 'button', className: 'btn-secondary', style: 'flex:1;', onClick: closeCart },
        'Вернуться в каталог',
      ),
    ];

    body.replaceChildren(
      el(
        'div',
        { className: 'alert-success' },
        el('div', { style: 'font-family:var(--font-display); font-weight:600;' }, `Заказ ${ord.orderNumber} принят в работу`),
        el('p', { style: 'font-size:0.8125rem; color:var(--ink-secondary); margin-top:4px;' }, 'Благодарим за покупку! Товары зарезервированы на складе и переданы в сборку.'),
      ),
      el(
        'div',
        { className: 'table-card', style: 'padding:16px; display:flex; flex-direction:column; gap:14px;' },
        el(
          'div',
          { style: 'font-size:0.8125rem; border-bottom:1px solid var(--border); padding-bottom:12px;' },
          el('div', { style: 'color:var(--ink-muted);' }, 'Получатель'),
          el('div', { style: 'font-weight:600; margin-top:2px;' }, `${ord.customerName} · ${ord.customerPhone}`),
          el('div', { style: 'color:var(--ink-secondary); margin-top:2px;' }, ord.deliveryAddress),
          el('div', { style: 'color:var(--ink-muted); font-size:0.75rem; margin-top:4px;' }, `Оплата: ${ord.paymentMethod}`),
        ),
        el('div', { style: 'display:flex; flex-direction:column; gap:8px;' }, ...itemsRows),
        el(
          'div',
          { style: 'border-top:1px solid var(--border); padding-top:12px; display:flex; justify-content:space-between; align-items:center;' },
          el('span', { style: 'font-weight:500;' }, 'Итого к оплате'),
          el('span', { className: 'font-mono tabular-nums', style: 'font-size:1.125rem; font-weight:600;' }, formatRub(ord.totalAmount)),
        ),
      ),
      el('div', { style: 'display:flex; gap:10px; flex-wrap:wrap;' }, ...actionButtons),
    );
    return;
  }

  titleEl.textContent = 'Корзина покупок';
  if (state.cart.length === 0) {
    body.replaceChildren(
      el(
        'div',
        { style: 'padding:64px 16px; text-align:center;' },
        el('h3', { style: 'font-size:1rem; font-weight:600;' }, 'В корзине пока нет товаров'),
        el('p', { style: 'font-size:0.875rem; color:var(--ink-muted); margin-top:8px;' }, 'Выберите корма, лакомства, средства для ухода, ветпрепараты или аксессуары из каталога.'),
      ),
    );
    return;
  }

  const subtotal = state.cart.reduce((s, c) => s + c.product.price * c.quantity, 0);
  const freeThreshold = 3000;
  const remaining = Math.max(0, freeThreshold - subtotal);

  const deliveryNote =
    remaining === 0
      ? el('div', { className: 'stock-ok', style: 'font-size:0.75rem; font-weight:500; border-bottom:1px solid var(--border); padding-bottom:12px;' }, `Доставка бесплатно — сумма заказа превышает ${formatRub(freeThreshold)}`)
      : el('div', { style: 'font-size:0.75rem; color:var(--ink-secondary); border-bottom:1px solid var(--border); padding-bottom:12px;' }, `До бесплатной доставки добавьте товаров на `, el('strong', { className: 'font-mono tabular-nums' }, formatRub(remaining)));

  const itemsList = el(
    'ul',
    { className: 'cart-items-list' },
    ...state.cart.map(({ product, quantity }) =>
      el(
        'li',
        { className: 'cart-item' },
        createResilientImage(product.imageUrl, product.name, 'cart-item-img'),
        el(
          'div',
          { className: 'cart-item-info' },
          el('div', { className: 'meta-line' }, `${CATEGORY_LABELS[product.category]} · ${product.species}`),
          el('div', { style: 'font-weight:600; font-size:0.875rem; margin-top:2px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;' }, product.name),
          el(
            'div',
            { style: 'display:flex; justify-content:space-between; margin-top:4px; font-size:0.8125rem;' },
            el('strong', { className: 'font-mono tabular-nums' }, formatRub(product.price * quantity)),
            el('span', { className: 'tabular-nums', style: 'font-size:0.75rem; color:var(--ink-muted);' }, `Остаток: ${product.stock}`),
          ),
          el(
            'div',
            { style: 'display:flex; justify-content:space-between; align-items:center; margin-top:10px;' },
            el(
              'div',
              { className: 'qty-stepper qty-stepper-neutral' },
              el('button', { type: 'button', className: 'qty-btn', 'aria-label': 'Уменьшить', onClick: () => updateCartQty(product.id, quantity - 1) }, '−'),
              el('span', { className: 'qty-val tabular-nums' }, quantity),
              el('button', { type: 'button', className: 'qty-btn', disabled: quantity >= product.stock, 'aria-label': 'Увеличить', onClick: () => updateCartQty(product.id, quantity + 1) }, '+'),
            ),
            el(
              'button',
              {
                type: 'button',
                style: 'background:none; border:none; font-size:0.75rem; color:var(--ink-muted);',
                onClick: () => removeFromCart(product.id),
              },
              'Удалить',
            ),
          ),
        ),
      ),
    ),
  );

  if (!state.account) {
    body.replaceChildren(
      deliveryNote,
      itemsList,
      el(
        'div',
        { className: 'table-card', style: 'padding:16px; background:#fafafa; display:flex; flex-direction:column; gap:10px;' },
        el('h3', { style: 'font-size:0.875rem; font-weight:600;' }, 'Войдите в аккаунт для оформления заказа'),
        el('p', { style: 'font-size:0.75rem; color:var(--ink-secondary); line-height:1.5;' }, `Выбрано товаров на сумму ${formatRub(subtotal)}. Войдите или зарегистрируйтесь, чтобы подтвердить заказ и адрес доставки.`),
        el(
          'button',
          {
            type: 'button',
            className: 'btn-primary',
            disabled: state.authBusy,
            onClick: () => openAuthModal(state.needsAdminSetup ? 'register' : 'login'),
          },
          state.needsAdminSetup ? 'Создать аккаунт и оформить' : 'Войти или зарегистрироваться',
        ),
      ),
    );
    return;
  }

  const errBox = el('div', { className: `alert-error ${state.cartError ? '' : 'hidden'}` }, state.cartError || '');
  const nameInput = el('input', { type: 'text', className: 'input', value: state.account.displayName || '', placeholder: 'Например, Анна Смирнова', required: true });
  const phoneInput = el('input', { type: 'tel', className: 'input', placeholder: '+7 (999) 123-45-67', required: true });
  const addrInput = el('input', { type: 'text', className: 'input', placeholder: 'Город, улица, дом, квартира', required: true });
  const paySelect = el('select', { className: 'select' }, ...PAYMENT_METHODS.map((pm) => el('option', { value: pm }, pm)));
  const submitBtn = el('button', { type: 'submit', className: 'btn-primary', style: 'width:100%; padding:12px 16px;' }, `Оформить заказ · ${formatRub(subtotal)}`);

  const form = el(
    'form',
    { className: 'form-stack', style: 'border-top:1px solid var(--border); padding-top:16px;' },
    el('h3', { style: 'font-size:0.875rem; font-weight:600;' }, 'Данные для доставки и оплаты'),
    errBox,
    el('div', null, el('label', { className: 'field-label' }, 'Имя и фамилия'), nameInput),
    el('div', null, el('label', { className: 'field-label' }, 'Телефон'), phoneInput),
    el('div', null, el('label', { className: 'field-label' }, 'Адрес доставки'), addrInput),
    el('div', null, el('label', { className: 'field-label' }, 'Способ оплаты'), paySelect),
    el('div', { style: 'display:flex; justify-content:space-between; align-items:center; padding-top:4px;' }, el('span', { style: 'font-size:0.875rem; color:var(--ink-secondary);' }, 'Сумма заказа'), el('strong', { className: 'font-mono tabular-nums', style: 'font-size:1.125rem;' }, formatRub(subtotal))),
    submitBtn,
  );

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    state.cartError = null;
    submitBtn.disabled = true;
    submitBtn.textContent = 'Оформление заказа...';
    try {
      const res = await apiJson('/api/orders', {
        method: 'POST',
        body: JSON.stringify({
          customerName: nameInput.value,
          customerPhone: phoneInput.value,
          deliveryAddress: addrInput.value,
          paymentMethod: paySelect.value,
          items: state.cart.map((c) => ({ productId: c.product.id, quantity: c.quantity })),
        }),
      });
      if (isTrueAdmin()) {
        state.orders = [res.order, ...state.orders];
        state.movements = res.stockMovements;
      }
      state.myOrders = [res.order, ...state.myOrders];
      state.expandedMyOrderId = res.order.id;
      state.products = res.products;
      state.cart = [];
      state.completedOrder = res.order;
      showToast(`Заказ ${res.order.orderNumber} оформлен`);
      renderAll();
    } catch (err) {
      state.cartError = err instanceof Error ? err.message : 'Не удалось оформить заказ.';
      errBox.textContent = state.cartError;
      errBox.classList.remove('hidden');
    } finally {
      submitBtn.disabled = false;
      submitBtn.textContent = `Оформить заказ · ${formatRub(subtotal)}`;
    }
  });

  body.replaceChildren(deliveryNote, itemsList, form);
}

// --- Main Render Orchestrator ---
function renderMainView() {
  const root = document.getElementById('viewRoot');
  if (state.loading) {
    root.replaceChildren(
      el(
        'div',
        { className: 'empty-card' },
        el('p', { style: 'color:var(--ink-muted); font-size:0.875rem;' }, 'Загрузка данных магазина...'),
      ),
    );
    return;
  }
  if (state.loadError) {
    root.replaceChildren(
      el(
        'div',
        { className: 'empty-card' },
        el('h2', { style: 'font-size:1rem; font-weight:600;' }, 'Ошибка загрузки данных'),
        el('p', { className: 'stock-out', style: 'font-size:0.875rem;' }, state.loadError),
        el('button', { type: 'button', className: 'btn-primary btn-sm', onClick: () => void fetchStore() }, 'Повторить попытку'),
      ),
    );
    return;
  }

  const admin = isEffectiveAdmin();
  if (state.activeTab === 'inventory' && admin) {
    renderInventoryView(root);
  } else if (state.activeTab === 'orders' && admin) {
    renderOrdersView(root);
  } else if (state.activeTab === 'suppliers' && admin) {
    renderSuppliersView(root);
  } else if (state.activeTab === 'accounts' && admin && state.account) {
    renderAccountsView(root);
  } else if (state.activeTab === 'my-orders' && state.account) {
    renderMyOrdersView(root);
  } else {
    renderCatalogView(root);
  }
}

function renderMyOrdersView(root) {
  const activeOrders = state.myOrders.filter((o) => o.status !== 'Отменён');
  const totalSpent = activeOrders.reduce((s, o) => s + o.totalAmount, 0);

  const header = el(
    'div',
    { className: 'page-header-row' },
    el('div', null, el('h1', { className: 'page-title' }, 'Мои заказы'), el('p', { className: 'section-desc' }, 'Ваша личная история покупок, статусы доставки и быстрый повтор заказа в корзину.')),
    el('button', { type: 'button', className: 'btn-secondary', onClick: () => setActiveTab('catalog') }, 'В каталог'),
  );

  const kpis = el(
    'div',
    { className: 'kpi-strip', style: 'grid-template-columns: repeat(3, 1fr);' },
    el('div', null, el('div', { className: 'kpi-label' }, 'Оформлено заказов'), el('div', { className: 'kpi-value tabular-nums' }, state.myOrders.length)),
    el('div', null, el('div', { className: 'kpi-label' }, 'Активных заказов'), el('div', { className: 'kpi-value tabular-nums' }, activeOrders.length)),
    el('div', null, el('div', { className: 'kpi-label' }, 'Сумма покупок'), el('div', { className: 'kpi-value tabular-nums' }, formatRub(totalSpent))),
  );

  if (state.myOrders.length === 0) {
    root.replaceChildren(
      header,
      kpis,
      el(
        'div',
        { className: 'empty-card' },
        el('h3', { style: 'font-size:1rem; font-weight:600;' }, 'У вас пока нет оформленных заказов'),
        el('p', { style: 'font-size:0.875rem; color:var(--ink-muted);' }, 'Выберите товары в каталоге и оформите первый заказ через корзину.'),
        el('button', { type: 'button', className: 'btn-primary btn-sm', onClick: () => setActiveTab('catalog') }, 'Перейти к покупкам'),
      ),
    );
    return;
  }

  const cards = state.myOrders.map((order) => {
    const expanded = state.expandedMyOrderId === order.id;
    const statusCls =
      order.status === 'Доставлен' || order.status === 'Выполнен'
        ? 'stock-ok'
        : order.status === 'В обработке'
          ? 'stock-low'
          : 'stock-out';

    const itemsSection = expanded
      ? el(
          'div',
          { className: 'order-card-items table-scroll' },
          el(
            'table',
            { className: 'data-table', style: 'font-size:0.75rem;' },
            el('thead', null, el('tr', null, el('th', null, 'Артикул'), el('th', null, 'Наименование'), el('th', null, 'Категория'), el('th', { className: 'text-right' }, 'Кол-во'), el('th', { className: 'text-right' }, 'Цена'), el('th', { className: 'text-right' }, 'Сумма'))),
            el(
              'tbody',
              null,
              ...order.items.map((it) =>
                el(
                  'tr',
                  null,
                  el('td', { className: 'font-mono nowrap', style: 'color:var(--ink-muted);' }, it.sku),
                  el('td', { style: 'font-weight:500;' }, it.productName),
                  el('td', { className: 'nowrap', style: 'color:var(--ink-secondary);' }, CATEGORY_LABELS[it.category] || it.category),
                  el('td', { className: 'text-right font-mono tabular-nums' }, it.quantity),
                  el('td', { className: 'text-right font-mono tabular-nums', style: 'color:var(--ink-secondary);' }, formatRub(it.unitPrice)),
                  el('td', { className: 'text-right font-mono tabular-nums', style: 'font-weight:600;' }, formatRub(it.subtotal)),
                ),
              ),
            ),
          ),
        )
      : null;

    return el(
      'article',
      { className: 'order-card' },
      el(
        'div',
        { className: 'order-card-head' },
        el(
          'div',
          { style: 'display:flex; flex-direction:column; gap:4px;' },
          el(
            'div',
            { className: 'meta-line' },
            el('span', { className: 'font-mono', style: 'font-weight:600; color:var(--ink);' }, order.orderNumber),
            ' · ',
            el('span', { className: 'tabular-nums' }, formatDateRu(order.createdAt)),
            ' · ',
            el('span', { className: statusCls, style: 'font-weight:500;' }, order.status),
          ),
          el('div', { style: 'font-weight:600; font-size:0.9375rem;' }, order.deliveryAddress),
          el('div', { style: 'font-size:0.75rem; color:var(--ink-muted);' }, `${order.customerName} · ${order.customerPhone} · ${order.paymentMethod}`),
        ),
        el(
          'div',
          { style: 'display:flex; flex-wrap:wrap; align-items:center; gap:10px;' },
          el(
            'div',
            { className: 'text-right', style: 'margin-right:8px;' },
            el('div', { className: 'font-mono tabular-nums', style: 'font-size:1.125rem; font-weight:600;' }, formatRub(order.totalAmount)),
            el('div', { className: 'tabular-nums', style: 'font-size:0.75rem; color:var(--ink-muted);' }, `Позиций: ${order.items.reduce((s, i) => s + i.quantity, 0)}`),
          ),
          el(
            'button',
            {
              type: 'button',
              className: 'btn-secondary btn-sm',
              onClick: () => {
                const pMap = new Map(state.products.map((p) => [p.id, p]));
                const nextCart = [];
                for (const item of order.items) {
                  const fresh = pMap.get(item.productId);
                  if (fresh && fresh.stock > 0) {
                    nextCart.push({ product: fresh, quantity: Math.min(fresh.stock, item.quantity) });
                  }
                }
                if (nextCart.length > 0) {
                  state.cart = nextCart;
                  state.cartOpen = true;
                  showToast(`Заказ ${order.orderNumber} скопирован в корзину`);
                  renderAll();
                } else {
                  showToast('К сожалению, товары из этого заказа сейчас закончились', true);
                }
              },
            },
            'Повторить',
          ),
          el(
            'button',
            {
              type: 'button',
              className: 'btn-secondary btn-sm',
              onClick: () => {
                state.expandedMyOrderId = expanded ? null : order.id;
                renderMainView();
              },
            },
            expanded ? 'Скрыть состав' : 'Состав',
          ),
        ),
      ),
      itemsSection,
    );
  });

  root.replaceChildren(header, kpis, el('div', { className: 'orders-list' }, ...cards));
}

function renderAll() {
  renderNav();
  renderAccountBar();
  renderMainView();
  renderCart();
}

// --- Bootstrap ---
async function init() {
  document.getElementById('brandBtn').addEventListener('click', () => setActiveTab('catalog'));
  document.getElementById('openCartBtn').addEventListener('click', openCart);
  document.getElementById('closeCartBtn').addEventListener('click', closeCart);
  document.getElementById('cartBackdrop').addEventListener('click', closeCart);
  document.getElementById('modalBackdrop').addEventListener('click', closeModal);
  document.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape') return;
    const modal = document.getElementById('modalOverlay');
    if (modal && !modal.classList.contains('hidden')) {
      closeModal();
      return;
    }
    if (state.cartOpen) {
      closeCart();
    }
  });

  state.authReady = true;
  renderAll();
  await fetchStore();
}

window.addEventListener('error', (event) => {
  console.error('Client error:', event.error || event.message);
});

void init();
