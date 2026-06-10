@echo off
REM Double-click to play LevelX locally. Starts a static server + opens the game.
REM Port 8765 matches the origin where your in-browser dev edits (R offsets,
REM gear-align, gear-erase) are stored in localStorage — keep using this one.
cd /d "%~dp0"
echo Starting LevelX at http://localhost:8765/mojiworld_game.html ...
start "" "http://localhost:8765/mojiworld_game.html"
node serve.js 8765
pause
