# Лапа и Дом — Зоомагазин и учёт товаров

Полнофункциональное веб-приложение зоомагазина на **HTML, CSS, чистом JavaScript (ESM + Express) и SQL (PostgreSQL)** с авторизацией через Firebase Authentication и исполняемой бинкой запуска `bin/lapa-i-dom`.

## Структура проекта

```text
├── start.bat                        # Батник для запуска на Windows (двойной клик или CMD)
├── bin/
│   ├── lapa-i-dom                   # Исполняемый CLI-бинарник запуска (--port, --check, --init-db)
│   └── start.sh                     # Bash-обёртка для запуска на Linux/macOS
├── server.js                        # Express-сервер (порт 3000), API и раздача статики
├── package.json                     # Зависимости (express, pg, firebase, firebase-admin, dotenv) и bin
├── firebase-applet-config.json      # Конфигурация Firebase Auth
├── .env.example                     # Шаблон переменных окружения PostgreSQL
├── sql/
│   ├── schema.sql                   # SQL-схема таблиц (users, suppliers, products, orders, order_items, stock_movements)
│   └── seed.sql                     # Начальное наполнение каталога, поставщиков и заказов
├── lib/
│   ├── db.js                        # Пул pg, ленивое создание схемы и параметризованные SQL-транзакции
│   └── firebase-admin.js            # Серверная проверка Firebase ID-токенов
├── middleware/
│   └── auth.js                      # Проверка токенов и ролей (admin / customer)
└── public/
    ├── index.html                   # Страница приложения и importmap для локального Firebase SDK
    ├── styles.css                   # Стили интерфейса и адаптивная вёрстка
    ├── app.js                       # Клиентская логика на чистом JavaScript (DOM API)
    └── images/                      # Графические ассеты категорий и баннера
```

## Запуск

1. Скопируйте `.env.example` в `.env` и заполните параметры подключения к PostgreSQL (`SQL_HOST`, `SQL_DB_NAME`, `SQL_USER`, `SQL_PASSWORD`).
2. **На Windows**: запустите **`start.bat`** (двойным кликом или в командной строке, поддерживаются флаги например `start.bat --with-init --port 3000`). При первом запуске батник сам установит зависимости.
3. **На Linux / macOS**:
   ```bash
   ./bin/lapa-i-dom --check
   ./bin/lapa-i-dom
   # или через shell-скрипт:
   ./bin/start.sh
   ```
   Также доступен стандартный запуск через npm: `npm run dev` или `npm start`.
