@echo off
setlocal
cd /d "%~dp0.."

if "%~1"=="" (
  echo Usage: %~nx0 "commit message"
  exit /b 1
)

git add -A
git diff --cached --quiet
if not errorlevel 1 (
  echo No changes to commit.
  exit /b 0
)

git commit -m "%~1"
if errorlevel 1 exit /b 1

git push
if errorlevel 1 exit /b 1

echo Changes pushed.
