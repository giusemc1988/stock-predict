@echo off
rem Jarvis Dev menu: fix and upgrade Jarvis OS offline (see tools\jarvis-dev\README.md)
title Jarvis Dev
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0tools\jarvis-dev\jarvis-dev.ps1" %*
if errorlevel 1 pause
