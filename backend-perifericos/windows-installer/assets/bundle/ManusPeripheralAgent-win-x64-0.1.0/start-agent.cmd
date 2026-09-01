@echo off
setlocal
set "AGENT_ROOT=%~dp0"
if not defined PERIPHERALS_CONFIG_PATH set "PERIPHERALS_CONFIG_PATH=%AGENT_ROOT%config\agent.config.local.json"
if not defined PERIPHERALS_VERSION set "PERIPHERALS_VERSION=0.1.0"
if not exist "%LOCALAPPDATA%\Manus\PeripheralAgent\logs" mkdir "%LOCALAPPDATA%\Manus\PeripheralAgent\logs"
if not exist "%LOCALAPPDATA%\Manus\PeripheralAgent\state" mkdir "%LOCALAPPDATA%\Manus\PeripheralAgent\state"
"%AGENT_ROOT%runtime\node.exe" "%AGENT_ROOT%app\main.js"
