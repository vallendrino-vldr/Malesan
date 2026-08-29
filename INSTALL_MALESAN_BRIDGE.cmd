@echo off
title Malesan Bridge 1-Click Installer
echo ===================================================
echo     MALESAN AUTO-CLIP LOCAL BRIDGE INSTALLER
echo ===================================================
echo.
echo Memasang Malesan Native Host ke Chrome, Brave, Edge...
echo.

set EXT_ID=ckpiijmjnnekfolkhhnoiifjgnbgbpjl

powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0bridge\native-host\install.ps1" -ExtensionId "%EXT_ID%"

if %ERRORLEVEL% EQU 0 (
    echo.
    echo ===================================================
    echo [SUKSES] Malesan Bridge berhasil terpasang!
    echo Silakan restart browser kamu (Chrome / Brave / Edge)
    echo lalu buka kembali https://malesan.my.id
    echo ===================================================
) else (
    echo.
    echo [ERROR] Instalasi gagal. Silakan coba jalankan 'Run as Administrator'.
)
echo.
pause
