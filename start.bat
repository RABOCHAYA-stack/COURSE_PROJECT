@echo off
setlocal EnableExtensions
chcp 65001 >nul
title Лапа и Дом — Зоомагазин

cd /d "%~dp0"

where node >nul 2>&1
if errorlevel 1 (
  echo [Ошибка] Node.js 20+ не найден в PATH.
  echo Скачайте и установите Node.js: https://nodejs.org/
  pause
  exit /b 1
)

if not exist "node_modules\" (
  echo Установка зависимостей ^(npm install^)...
  call npm install
  if errorlevel 1 (
    echo [Ошибка] Не удалось установить зависимости npm.
    pause
    exit /b 1
  )
)

if not exist ".env" (
  if exist ".env.example" (
    echo [Подсказка] Файл .env не найден. Для локальной БД скопируйте .env.example в .env и заполните SQL_HOST, SQL_DB_NAME, SQL_USER, SQL_PASSWORD.
  )
)

node "bin\lapa-i-dom" %*
set "EXIT_CODE=%ERRORLEVEL%"

if not "%EXIT_CODE%"=="0" (
  echo.
  echo [Ошибка] Сервер завершился с кодом %EXIT_CODE%.
  pause
  exit /b %EXIT_CODE%
)

endlocal
