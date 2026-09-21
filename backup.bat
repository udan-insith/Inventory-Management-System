@echo off
REM Double-click this to back up the Gift Storage database to backups\.
REM Reads connection details from .env, so nothing to type each time.
REM IMPORTANT: afterwards, copy the backups folder somewhere off this
REM laptop too (USB drive, OneDrive, Google Drive) - a backup that only
REM lives on the same disk doesn't protect you if the laptop fails.

cd /d "%~dp0"

if not exist .env (
  echo Could not find .env - copy .env.example to .env and fill in your MySQL details first.
  pause
  exit /b 1
)

set MYSQL_HOST=localhost
set MYSQL_PORT=3306
set MYSQL_USER=root
set MYSQL_PASSWORD=
set MYSQL_DATABASE=gift_storage

for /f "usebackq tokens=1,2 delims==" %%a in (".env") do (
  if "%%a"=="MYSQL_HOST" set MYSQL_HOST=%%b
  if "%%a"=="MYSQL_PORT" set MYSQL_PORT=%%b
  if "%%a"=="MYSQL_USER" set MYSQL_USER=%%b
  if "%%a"=="MYSQL_PASSWORD" set MYSQL_PASSWORD=%%b
  if "%%a"=="MYSQL_DATABASE" set MYSQL_DATABASE=%%b
)