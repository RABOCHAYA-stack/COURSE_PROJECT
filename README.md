# Лапа и Дом — Зоомагазин и учёт товаров

Полнофункциональное веб-приложение зоомагазина (React + Vite + Express + PostgreSQL + Drizzle ORM + Firebase Authentication).

## Структура проекта

```text
├── server.ts                        # Сервер Express API и интеграция Vite / static dist
├── index.html                       # Точка входа HTML и шрифты
├── package.json                     # Зависимости и скрипты запуска
├── tsconfig.json                    # Настройки TypeScript
├── vite.config.ts                   # Конфигурация Vite + Tailwind CSS v4
├── firebase-applet-config.json      # Конфигурация Firebase Auth для клиента и сервера
├── .env.example                     # Шаблон переменных окружения
└── src/
    ├── main.tsx                     # Монтирование React и AuthProvider
    ├── App.tsx                      # Основное приложение и маршрутизация по ролям
    ├── index.css                    # Глобальные стили Tailwind CSS v4
    ├── types.ts                     # Общие TypeScript-типы и справочник категорий
    ├── assets/images/               # Графические ассеты категорий и баннера
    ├── contexts/
    │   └── AuthContext.tsx          # Вход через Google и хранение ID-токена в памяти
    ├── lib/
    │   ├── firebase.ts              # Клиентский SDK Firebase Auth
    │   └── firebase-admin.ts        # Серверный Firebase Admin SDK для проверки токенов
    ├── middleware/
    │   └── auth.ts                  # Middleware проверки токена и роли (admin / customer)
    ├── db/
    │   ├── schema.ts                # Схема PostgreSQL (users, suppliers, products, orders, order_items, stock_movements)
    │   ├── index.ts                 # Пул подключений pg и экземпляр Drizzle ORM
    │   ├── drizzle.config.ts        # Конфигурация Drizzle Kit
    │   ├── users.ts                 # Работа с аккаунтами и ролями пользователей
    │   └── repository.ts            # Запросы, транзакции заказов и начальное заполнение БД
    ├── utils/
    │   └── format.ts                # Форматирование валюты, дат и статусов остатков
    └── components/
        ├── CatalogView.tsx          # Витрина, фильтры по 6 категориям и видам животных
        ├── CartDrawer.tsx           # Корзина и оформление заказа
        ├── InventoryView.tsx        # Склад, остатки, приёмка, списание и журнал движения
        ├── OrdersView.tsx           # История покупок, чеки и статусы заказов
        ├── SuppliersView.tsx        # Поставщики и оформление поставок на склад
        ├── AccountsView.tsx         # Управление ролями пользователей (администратор)
        └── ResilientImage.tsx       # Изображения с резервной заглушкой при ошибке
```

## Локальный запуск

1. Установите зависимости:
   ```bash
   npm install
   ```
2. Скопируйте `.env.example` в `.env` и заполните параметры подключения к PostgreSQL (`SQL_HOST`, `SQL_DB_NAME`, `SQL_USER`, `SQL_PASSWORD`, `SQL_ADMIN_USER`, `SQL_ADMIN_PASSWORD`).
3. Примените схему таблиц в PostgreSQL:
   ```bash
   npx drizzle-kit push --config=src/db/drizzle.config.ts
   ```
4. Запустите сервер разработки на порту `3000`:
   ```bash
   npm run dev
   ```
5. Для production-сборки:
   ```bash
   npm run build
   NODE_ENV=production npm start
   ```
