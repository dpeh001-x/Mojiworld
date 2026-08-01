@echo off
rem Mojiworld launcher (.cmd) - Smart-App-Control-safe twin of Mojiworld.exe.
rem SAC blocks the unsigned exe stub with no override; cmd.exe and node.exe
rem are Microsoft/OpenJS-signed, so this launcher runs on SAC-enforced
rem machines. Same behaviour as the exe: reuse a running server on :8765,
rem else start `node serve.js 8765` minimized, then open the game in the
rem default browser. If Node.js is missing, fall back to the hosted build.
setlocal
cd /d "%~dp0"
set PORT=8765

if not exist mojiworld_game.html (
  echo mojiworld_game.html was not found next to the launcher.
  echo Put Mojiworld.cmd in the game folder ^(the repo root^).
  pause
  exit /b 1
)

rem Portable-zip builds ship the official OpenJS-signed node.exe in .\node\ so
rem players need NOTHING installed (and SAC/SmartScreen see only signed
rem binaries). Prefer it; fall back to a PATH node; else the hosted build.
set "NODE_BIN=node"
if exist "%~dp0node\node.exe" set "NODE_BIN=%~dp0node\node.exe"

netstat -an | findstr /c:":%PORT% " | findstr LISTENING >nul 2>nul
if not errorlevel 1 goto open

if "%NODE_BIN%"=="node" (
  where node >nul 2>nul
  if errorlevel 1 (
    echo Node.js was not found - opening the hosted build instead.
    start "" "https://raw.githack.com/dpeh001-x/Mojiworld/main/mojiworld_game.html"
    exit /b 0
  )
)

start "Mojiworld server" /min "%NODE_BIN%" serve.js %PORT%

rem wait up to ~8s for the server to come up (each ping -n 2 sleeps ~1s)
for /l %%i in (1,1,8) do (
  netstat -an | findstr /c:":%PORT% " | findstr LISTENING >nul 2>nul
  if not errorlevel 1 goto open
  ping -n 2 127.0.0.1 >nul
)
echo The local server did not come up on port %PORT%.
pause
exit /b 1

:open
start "" "http://localhost:%PORT%/mojiworld_game.html"
exit /b 0
