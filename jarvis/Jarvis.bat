@echo off
chcp 65001 >nul
title JARVIS
cd /d "%~dp0"
if not exist ".venv\Scripts\python.exe" (
    echo Jarvis n'est pas encore installe : double-clique d'abord sur installer.bat
    pause
    exit /b 1
)
".venv\Scripts\python.exe" jarvis.py %*
pause
