@echo off
setlocal
chcp 65001 >nul
title Convertir reporte de inventario

rem Arrastra el "Reporte de Inventario .xlsx" sobre este archivo.
rem Deja 1_carga_productos_<fecha>.xlsx y 2_carga_stock_<fecha>.xlsx junto al reporte.

set "REPORTE=%~1"
if not "%REPORTE%"=="" goto :tiene_reporte
echo.
set /p "REPORTE=Arrastra aqui el Excel del reporte y presiona Enter: "
if "%REPORTE%"=="" goto :sin_archivo
set "REPORTE=%REPORTE:"=%"

:tiene_reporte
if not exist "%REPORTE%" goto :sin_archivo

where node >nul 2>nul
if errorlevel 1 goto :sin_node

cd /d "%~dp0..\..\api"
if exist "node_modules\.bin\tsx.cmd" goto :convertir
echo Instalando dependencias del API (solo la primera vez)...
call npm install --no-audit --no-fund
if errorlevel 1 goto :fallo

:convertir
call "node_modules\.bin\tsx.cmd" scripts\convert-inventory-report.ts "%REPORTE%"
set "RESULTADO=%ERRORLEVEL%"
if "%RESULTADO%"=="2" echo ATENCION: las plantillas tienen errores de prevalidacion. Corrigelos antes de subirlas.
echo.
pause
exit /b %RESULTADO%

:sin_archivo
echo.
echo No se encontro el archivo: "%REPORTE%"
echo.
pause
exit /b 1

:sin_node
echo.
echo Node.js no esta instalado. Instalalo desde https://nodejs.org y vuelve a intentar.
echo.
pause
exit /b 1

:fallo
echo.
echo No se pudieron instalar las dependencias del API.
echo.
pause
exit /b 1
