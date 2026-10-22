@echo off
title Gift Storage - Launcher
cd /d "%~dp0"

REM ---- 1. Node.js installed? ----
where node >nul 2>nul
if errorlevel 1 (
  echo Node.js is not installed on this computer.
  echo Install the LTS version from https://nodejs.org then double-click this again.
  pause
  exit /b 1
)

REM ---- 2. First-time setup: create .env and let the user fill in the password ----
if not exist .env (
  if exist .env.example (
    copy .env.example .env >nul
    echo First-time setup: Notepad will open.
    echo Type the MySQL password after MYSQL_PASSWORD= then save and close Notepad.
    start /wait notepad .env
  )
)

REM ---- 3. Read the port from .env (default 3000) ----
set PORT=3000
if exist .env (
  for /f "usebackq tokens=1,2 delims==" %%a in (".env") do (
    if "%%a"=="PORT" set PORT=%%b
  )
)

REM ---- 4. Already running? Just open the browser ----
powershell -NoProfile -Command "try { Invoke-WebRequest -UseBasicParsing -TimeoutSec 2 http://localhost:%PORT%/login.html | Out-Null; exit 0 } catch { exit 1 }"
if not errorlevel 1 (
  start "" "http://localhost:%PORT%/login.html"
  exit /b 0
)

REM ---- 5. Install / update packages every launch ----
echo Checking for updates, please wait...
call npm install --no-audit --no-fund --loglevel=error
if errorlevel 1 (
  if not exist node_modules (
    echo Could not install the required packages. Check the internet connection and try again.
    pause
    exit /b 1
  )
  echo Could not check for updates, starting with the installed version.
)

REM ---- 6. Start the server in its own window ----
start "Gift Storage Server - keep this window open" cmd /k "npm start"

REM ---- 7. Wait until the server answers, then open the browser ----
echo Starting Gift Storage...
powershell -NoProfile -Command "for ($i=0; $i -lt 40; $i++) { try { Invoke-WebRequest -UseBasicParsing -TimeoutSec 2 http://localhost:%PORT%/login.html | Out-Null; exit 0 } catch { Start-Sleep -Seconds 1 } }; exit 1"
if errorlevel 1 (
  echo The server did not start. Look at the "Gift Storage Server" window for the error.
  echo Most common cause: MySQL is not running or the password in .env is wrong.
  pause
  exit /b 1
)
start "" "http://localhost:%PORT%/login.html"
exit /b 0