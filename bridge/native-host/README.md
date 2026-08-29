# Malesan Bridge (Windows)

Bridge membuat potongan YouTube di komputer pengguna. Video penuh tidak pernah dikirim ke server Malesan.

## Instalasi developer

1. Buka `chrome://extensions`, aktifkan **Developer mode**, lalu **Load unpacked** folder `bridge/extension`.
2. Salin ID extension 32 karakter.
3. Jalankan:

```powershell
powershell -ExecutionPolicy Bypass -File .\bridge\native-host\install.ps1 -ExtensionId ID_EXTENSION
```

4. Isi `NEXT_PUBLIC_MALESAN_BRIDGE_EXTENSION_ID` dengan ID yang sama, lalu restart Next.js dan Chrome.

Installer berjalan tanpa Administrator, menyimpan host di `%LOCALAPPDATA%\Malesan\BridgeHost`, memverifikasi SHA-256 `yt-dlp.exe`, dan mendaftarkan host hanya untuk ID extension tersebut.

## Batas keamanan

- Native Messaging hanya membawa job ID dan token sekali pakai, bukan video.
- Helper hanya menerima origin produksi Malesan atau localhost developer.
- Kredit dipotong server-side setelah file lokal terbukti ada dan tidak kosong.
- Hasil disajikan sekali lewat `127.0.0.1`, origin-locked, lalu dihapus.
- Hak penggunaan konten tetap wajib dikonfirmasi pengguna.
