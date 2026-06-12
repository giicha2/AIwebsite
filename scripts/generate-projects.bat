@echo off
setlocal
cd /d "%~dp0"

call :run_python "%~dp0generate-projects.py"
exit /b %ERRORLEVEL%

:run_python
where py >nul 2>&1
if %ERRORLEVEL%==0 (
  py -3 "%~1"
  exit /b %ERRORLEVEL%
)

where python3 >nul 2>&1
if %ERRORLEVEL%==0 (
  python3 "%~1"
  exit /b %ERRORLEVEL%
)

where python >nul 2>&1
if %ERRORLEVEL%==0 (
  python "%~1"
  exit /b %ERRORLEVEL%
)

echo Python 3 is required. Install from https://www.python.org/downloads/
exit /b 1
