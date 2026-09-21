@echo off
REM Double-click this to start the Gift Storage app and open it in your browser.
REM To stop the app, just close the "Gift Storage Server" console window.

cd /d "%~dp0"

set PORT=3000
if exist .env (
  for /f "usebackq tokens=1,2 delims==" %%a in (".env") do (
    if "%%a"=="PORT" set PORT=%%b
  )
)

start "Gift Storage Server" cmd /k "npm start"

echo Starting server, opening browser in a few seconds...
timeout /t 4 /nobreak >nul
start "" "http://localhost:%PORT%/login.html"
