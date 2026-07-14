@echo off
setlocal
cd /d "%~dp0.."

set "SRC=%cd%"
set "DRIVE_ROOT=D:\WebWork\SynologyDrive"
set "DRIVE_SITE=%DRIVE_ROOT%\MyWebsite"

if not exist "%DRIVE_ROOT%" (
  echo Synology Drive folder not found: %DRIVE_ROOT%
  echo Skip deploy.
  exit /b 0
)

if not exist "%DRIVE_SITE%" mkdir "%DRIVE_SITE%"

echo Deploying to Synology Drive...
robocopy "%SRC%" "%DRIVE_SITE%" /E /XD .git Docs .cursor "shots\thumbs" "videos\thumbs" /XF desktop.ini .DS_Store blog-auth.json blog-sessions.json portfolio.json /NFL /NDL /NJH /NJS /nc /ns /np
set "RC1=%ERRORLEVEL%"

robocopy "%SRC%" "%DRIVE_ROOT%" /E /XD .git Docs .cursor "shots\thumbs" "videos\thumbs" MyWebsite git "Unreal Projects" .SynologyWorkingDirectory /XF desktop.ini .DS_Store blog-auth.json blog-sessions.json portfolio.json /NFL /NDL /NJH /NJS /nc /ns /np
set "RC2=%ERRORLEVEL%"

rem robocopy: 0-7 = success with differences
if %RC1% GEQ 8 (
  echo Deploy to MyWebsite failed. robocopy=%RC1%
  exit /b 1
)
if %RC2% GEQ 8 (
  echo Deploy to Drive root failed. robocopy=%RC2%
  exit /b 1
)

echo Deployed to:
echo   %DRIVE_SITE%
echo   %DRIVE_ROOT%
echo Wait for Synology Drive sync, then hard-refresh the live site.
exit /b 0
