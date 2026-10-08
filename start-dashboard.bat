@echo off
cd /d "%~dp0"
echo Getting the latest version from GitHub...
git pull --ff-only
call npm install --no-audit --no-fund
start "" http://localhost:5173
npm run dev
