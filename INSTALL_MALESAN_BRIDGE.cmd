@echo off
setlocal
title Malesan Bridge 1-Click Installer
cls
echo ================================================================
echo         MALESAN AUTO-CLIP LOCAL BRIDGE - 1-CLICK INSTALLER
echo ================================================================
echo.
echo [1/2] Mendaftarkan Native Host ke Chrome, Brave, Edge, Chromium...
echo.

set "EXT_ID=ckpiijmjnnekfolkhhnoiifjgnbgbpjl"
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0bridge\native-host\install.ps1" -ExtensionId "%EXT_ID%"

if %ERRORLEVEL% NEQ 0 goto :FAILED

:SUCCESS
echo.
echo ================================================================
echo [SUKSES] Malesan Native Host Berhasil Terpasang!
echo ================================================================
echo.
echo Langkah Terakhir (Cuma 10 detik):
echo 1. Buka browser kamu (Brave / Chrome / Edge).
echo 2. Buka menu Extensions (ketik brave://extensions atau chrome://extensions).
echo 3. Aktifkan 'Developer mode' di pojok kanan atas.
echo 4. Klik tombol 'Load unpacked' (Muat ekstensi yang belum dibongkar).
echo 5. Pilih folder berikut:
echo    %~dp0bridge\extension
echo.
echo 6. Buka kembali https://malesan.my.id - Auto Clip siap dipakai!
echo ================================================================
echo.
goto :END

:FAILED
echo.
echo ================================================================
echo [GAGAL] Terjadi kesalahan saat instalasi.
echo Coba klik kanan file ini lalu pilih 'Run as Administrator'.
echo ================================================================
echo.

:END
pause
