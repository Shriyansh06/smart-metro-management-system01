@echo off
cd /d "%~dp0"
where py >nul 2>nul
if errorlevel 1 (
    echo Please install Python 3.10 or newer, then run this file again.
    pause
    exit /b 1
)
if not exist "backend\.venv\Scripts\python.exe" (
    py -3 setup.py
    if errorlevel 1 (
        pause
        exit /b 1
    )
)
py -3 run.py
pause
