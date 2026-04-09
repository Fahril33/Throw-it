# ThrowIt (Local-only LAN Share)

ThrowIt adalah aplikasi web **full local-only** untuk transfer file + chat di jaringan lokal (LAN). Server berjalan di **1 PC** dan perangkat lain (HP/laptop/tablet) di Wi‑Fi/LAN yang sama mengakses lewat IP lokal PC tersebut.

## Tech Stack

- Frontend: React + Vite
- Backend: Node.js + Express + Socket.IO (WebSocket)

## Cara Menjalankan (PC Server)

1. Install dependency:
   - `npm install`
2. Jalankan mode development (frontend + backend):
   - `npm run dev`
3. Buka dari perangkat lain di LAN:
   - Buka `http://IP-PC-SERVER:5173` (lihat IP dari output terminal backend)
   - Jika perangkat lain tidak bisa akses, pastikan **Windows Firewall** mengizinkan port `5173` dan `3000`

### Jika port 3000 bentrok (EADDRINUSE)

Kalau backend gagal start karena port `3000` sudah dipakai, jalankan dengan port lain dan set proxy Vite:

- PowerShell:
  - `$env:PORT=3001; $env:VITE_BACKEND_URL='http://localhost:3001'; npm run dev`

## Build & Production (Opsional, tetap lokal)

1. Build frontend:
   - `npm run build`
2. Jalankan backend yang men-serve hasil build:
   - `npm start`
3. Akses dari perangkat lain:
   - Backend akan menampilkan URL seperti `http://192.168.x.x:3000`

## Catatan

- Transfer file dilakukan via WebSocket dengan chunking + pause/resume + auto-resume saat reconnect.
- File dianggap selesai hanya setelah server menerima semua chunk dan meng-assemble file secara utuh (server-side).
- Riwayat file diterima disimpan **di browser perangkat penerima** (localStorage).
- Nama device default untuk user baru akan otomatis dibuat (kombinasi objek angkasa + buah) dan unik di perangkat yang sedang online.
- UI Admin: **hold logo “ThrowIt” selama 5 detik** untuk membuka `/admin` (lihat & hapus file yang tersimpan di server).
