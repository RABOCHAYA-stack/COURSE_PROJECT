#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

if ! command -v node >/dev/null 2>&1; then
  echo "Ошибка: Node.js 20+ не найден в PATH." >&2
  exit 1
fi

if [ ! -d "$ROOT_DIR/node_modules" ]; then
  echo "Установка зависимостей..."
  npm --prefix "$ROOT_DIR" install
fi

exec node "$ROOT_DIR/bin/lapa-i-dom.js" "$@"
