@echo off
setlocal
cd /d "%~dp0"

call :ensure_python
if errorlevel 1 exit /b 1

call :run_python "%~dp0generate-media.py"
exit /b %ERRORLEVEL%

:ensure_python
where py >nul 2>&1
if %ERRORLEVEL%==0 (
  py -3 -m pip install -r "%~dp0requirements.txt" -q
  exit /b 0
)

where python3 >nul 2>&1
if %ERRORLEVEL%==0 (
  python3 -m pip install -r "%~dp0requirements.txt" -q
  exit /b 0
)

where python >nul 2>&1
if %ERRORLEVEL%==0 (
  python -m pip install -r "%~dp0requirements.txt" -q
  exit /b 0
)

echo Python 3 is required. Install from https://www.python.org/downloads/
exit /b 1

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
