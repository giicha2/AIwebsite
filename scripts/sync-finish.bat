@echo off
setlocal
cd /d "%~dp0.."

if "%~1"=="" (
  echo Usage: %~nx0 "commit message"
  exit /b 1
)

set "DID_PUSH=0"

git add -A
git diff --cached --quiet
if errorlevel 1 (
  git commit -m "%~1"
  if errorlevel 1 exit /b 1

  git push
  if errorlevel 1 exit /b 1

  set "DID_PUSH=1"
  echo Changes pushed.
) else (
  echo No new commit. Working tree clean for git.
)

call "%~dp0deploy-to-synology.bat"
if errorlevel 1 exit /b 1

if "%DID_PUSH%"=="1" (
  echo Done: GitHub push + Synology Drive deploy.
) else (
  echo Done: Synology Drive deploy only.
)
exit /b 0
