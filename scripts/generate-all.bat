@echo off
setlocal
cd /d "%~dp0"

call "%~dp0generate-projects.bat"
if errorlevel 1 exit /b 1

call "%~dp0generate-media.bat"
exit /b %ERRORLEVEL%
