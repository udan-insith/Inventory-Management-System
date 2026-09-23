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

if not exist backups mkdir backups

for /f %%i in ('powershell -NoProfile -Command "Get-Date -Format yyyy-MM-dd_HHmmss"') do set TIMESTAMP=%%i
set OUTFILE=backups\gift_storage_%TIMESTAMP%.sql

if "%MYSQL_PASSWORD%"=="" (
  mysqldump -h %MYSQL_HOST% -P %MYSQL_PORT% -u %MYSQL_USER% %MYSQL_DATABASE% > "%OUTFILE%"
) else (
  mysqldump -h %MYSQL_HOST% -P %MYSQL_PORT% -u %MYSQL_USER% -p%MYSQL_PASSWORD% %MYSQL_DATABASE% > "%OUTFILE%"
)

if exist "%OUTFILE%" (
  echo.
  echo Backup saved to %OUTFILE%
  echo Now copy the backups folder to a USB drive or cloud storage.
) else (
  echo.
  echo Backup failed - check that mysqldump is on your PATH and MySQL is running.
)
pause
