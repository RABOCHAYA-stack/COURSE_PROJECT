@echo off
setlocal EnableExtensions
chcp 65001 >nul 2>&1
title Lapa i Dom

cd /d "%~dp0"
if errorlevel 1 goto :cd_err

where node >nul 2>&1
if errorlevel 1 goto :no_node

if exist "node_modules\express\package.json" goto :check_env

echo [Lapa i Dom] Installing dependencies (npm install)...
call npm.cmd install
if errorlevel 1 goto :npm_err

:check_env
if exist ".env" goto :run_app
if exist ".env.example" echo [Lapa i Dom] Tip: copy .env.example to .env and configure SQL_HOST, SQL_DB_NAME, SQL_USER, SQL_PASSWORD.

:run_app
node "bin\lapa-i-dom.js" %*
set "EXIT_CODE=%ERRORLEVEL%"
if "%EXIT_CODE%"=="0" goto :done

echo.
echo [Lapa i Dom] Process exited with code %EXIT_CODE%.
pause
exit /b %EXIT_CODE%

:cd_err
echo [Lapa i Dom] Failed to switch to project directory.
pause
exit /b 1

:no_node
echo [Lapa i Dom] Node.js 18+ was not found in PATH.
echo Download Node.js from https://nodejs.org/
pause
exit /b 1

:npm_err
echo [Lapa i Dom] npm install failed. Check your internet connection or npm configuration.
pause
exit /b 1

:done
endlocal
exit /b 0
