#!/usr/bin/env node
import 'dotenv/config';
import { spawn, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '..');

const REQUIRED_FILES = [
  'server.js',
  'lib/db.js',
  'lib/firebase-admin.js',
  'middleware/auth.js',
  'public/index.html',
  'public/app.js',
  'public/styles.css',
  'sql/schema.sql',
];

const JS_CHECK_FILES = [
  'bin/lapa-i-dom.js',
  'server.js',
  'lib/db.js',
  'lib/firebase-admin.js',
  'middleware/auth.js',
  'public/app.js',
];

function printHelp() {
  console.log(`
Лапа и Дом — запуск приложения (HTML + CSS + JS + SQL)

Использование:
  start.bat [опции]          (Windows)
  ./bin/lapa-i-dom [опции]   (Linux / macOS)

Опции:
  -p, --port <номер>   Порт HTTP-сервера (по умолчанию 3000 или PORT из .env)
      --check          Проверить окружение, файлы проекта и синтаксис JS
      --init-db        Инициализировать таблицы PostgreSQL и начальные данные
      --with-init      Сначала применить схему БД, затем запустить сервер
  -v, --version        Показать версию пакета
  -h, --help           Показать эту справку
`);
}

function readPackageVersion() {
  try {
    const pkgRaw = fs.readFileSync(path.join(ROOT_DIR, 'package.json'), 'utf8');
    const pkg = JSON.parse(pkgRaw);
    return typeof pkg.version === 'string' ? pkg.version : '1.0.0';
  } catch {
    return '1.0.0';
  }
}

function parseArgs(argv) {
  const opts = {
    port: null,
    checkOnly: false,
    initDb: false,
    withInit: false,
    help: false,
    version: false,
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '-h' || arg === '--help') {
      opts.help = true;
    } else if (arg === '-v' || arg === '--version') {
      opts.version = true;
    } else if (arg === '--check') {
      opts.checkOnly = true;
    } else if (arg === '--init-db') {
      opts.initDb = true;
    } else if (arg === '--with-init') {
      opts.withInit = true;
    } else if (arg === '-p' || arg === '--port') {
      const next = argv[i + 1];
      if (!next) {
        throw new Error('Укажите номер порта после --port.');
      }
      i += 1;
      const num = Number(next);
      if (!Number.isInteger(num) || num < 1 || num > 65535) {
        throw new Error(`Некорректный порт: ${next}. Допустимо 1–65535.`);
      }
      opts.port = num;
    } else if (arg.startsWith('--port=')) {
      const raw = arg.slice('--port='.length);
      const num = Number(raw);
      if (!Number.isInteger(num) || num < 1 || num > 65535) {
        throw new Error(`Некорректный порт: ${raw}. Допустимо 1–65535.`);
      }
      opts.port = num;
    } else {
      throw new Error(`Неизвестный параметр: ${arg}. Используйте --help.`);
    }
  }
  return opts;
}

function verifyRuntimeAndFiles() {
  const major = Number(process.versions.node.split('.')[0]);
  if (!Number.isFinite(major) || major < 18) {
    throw new Error(`Требуется Node.js 18+, обнаружена версия ${process.versions.node}.`);
  }

  for (const rel of REQUIRED_FILES) {
    const abs = path.join(ROOT_DIR, rel);
    if (!fs.existsSync(abs)) {
      throw new Error(`Отсутствует обязательный файл: ${rel}`);
    }
  }

  if (!fs.existsSync(path.join(ROOT_DIR, 'node_modules'))) {
    throw new Error('Каталог node_modules не найден. Выполните npm install.');
  }
}

function runSyntaxChecks() {
  const targets = JS_CHECK_FILES.map((rel) => path.join(ROOT_DIR, rel));
  for (const file of targets) {
    const res = spawnSync(process.execPath, ['--check', file], {
      cwd: ROOT_DIR,
      stdio: 'pipe',
      encoding: 'utf8',
      shell: false,
    });
    if (res.status !== 0) {
      throw new Error(`Ошибка синтаксиса в ${path.relative(ROOT_DIR, file)}: ${res.stderr}`);
    }
  }
}

async function initDatabase() {
  const { default: pg } = await import('pg');
  const schemaSql = fs.readFileSync(path.join(ROOT_DIR, 'sql/schema.sql'), 'utf8');
  const adminPool = new pg.Pool({
    host: process.env.SQL_HOST,
    user: process.env.SQL_ADMIN_USER || process.env.SQL_USER,
    password: process.env.SQL_ADMIN_PASSWORD || process.env.SQL_PASSWORD,
    database: process.env.SQL_DB_NAME,
    max: 2,
    connectionTimeoutMillis: 15000,
  });
  try {
    await adminPool.query(schemaSql);
  } finally {
    await adminPool.end();
  }
  const dbUrl = pathToFileURL(path.join(ROOT_DIR, 'lib/db.js')).href;
  const { ensureSeeded } = await import(dbUrl);
  await ensureSeeded();
  console.log('База данных PostgreSQL готова: таблицы и начальные данные проверены.');
}

async function main() {
  const opts = parseArgs(process.argv.slice(2));

  if (opts.help) {
    printHelp();
    return;
  }

  if (opts.version) {
    console.log(`lapa-i-dom v${readPackageVersion()}`);
    return;
  }

  verifyRuntimeAndFiles();

  if (opts.checkOnly) {
    runSyntaxChecks();
    const envExists = fs.existsSync(path.join(ROOT_DIR, '.env'));
    console.log(`OK · Node.js ${process.versions.node}`);
    console.log(`OK · Проверены ${REQUIRED_FILES.length} файлов проекта и синтаксис ${JS_CHECK_FILES.length} JS-модулей`);
    console.log(
      envExists
        ? 'OK · Файл .env обнаружен'
        : 'INFO · Файл .env не найден (используются переменные окружения процесса)',
    );
    return;
  }

  if (opts.initDb || opts.withInit) {
    await initDatabase();
    if (opts.initDb && !opts.withInit) {
      return;
    }
  }

  const rawEnvPort = Number(process.env.PORT);
  const port =
    opts.port ||
    (Number.isInteger(rawEnvPort) && rawEnvPort >= 1 && rawEnvPort <= 65535
      ? rawEnvPort
      : 3000);

  console.log(`Лапа и Дом v${readPackageVersion()}`);
  console.log(`Запуск сервера: http://localhost:${port}`);
  console.log(`Проверка состояния: http://localhost:${port}/api/health`);

  const child = spawn(process.execPath, [path.join(ROOT_DIR, 'server.js')], {
    cwd: ROOT_DIR,
    stdio: 'inherit',
    shell: false,
    env: {
      ...process.env,
      PORT: String(port),
    },
  });

  const forwardSignal = (signal) => {
    if (!child.killed) {
      child.kill(signal);
    }
  };
  process.on('SIGINT', () => forwardSignal('SIGINT'));
  process.on('SIGTERM', () => forwardSignal('SIGTERM'));

  child.on('exit', (code, signal) => {
    if (signal) {
      process.kill(process.pid, signal);
      return;
    }
    process.exit(code ?? 0);
  });
}

main().catch((err) => {
  console.error('Ошибка запуска:', err instanceof Error ? err.message : String(err));
  process.exit(1);
});
