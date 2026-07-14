@echo off
setlocal
cd /d "%~dp0.."

git pull --rebase
if errorlevel 1 (
  echo git pull failed.
  exit /b 1
)

echo Ready to work. Run scripts\sync-finish.bat when done.
echo Also read Docs\SESSION_HANDOFF.md (Cursor rule does this after pull).
