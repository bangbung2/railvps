# Railway Ubuntu SSH VPS + Web Manager

Auto-built image untuk Railway VPS (SSH server, root login enabled) **plus Web UI** untuk manage user SSH.

## Default Credentials (langsung pakai, tanpa setting apapun)

- **SSH User**: `kopi`
- **SSH Password**: `kapal`
- **Root Password**: `kapal`
- **Web UI Login**: `kopi` / `kapal`

> Semua value di atas bisa dioverride via Railway Variables:
> `SSH_USERNAME`, `SSH_PASSWORD`, `ROOT_PASSWORD`, `ADMIN_USER`, `ADMIN_PASS`

## Akses Web UI

Web UI otomatis jalan di **port 8080**. Setelah deploy, buka domain yang di-generate Railway
(Settings → Networking → Generate Domain). Login pakai Basic Auth.

Fitur Web UI:
- Lihat daftar user SSH
- Tambah / hapus user
- Ubah password user
- Toggle akses sudo
- Info koneksi SSH (host, port, command)

## Akses SSH dari luar

Railway hanya mengekspos 1 port HTTP secara default. Untuk SSH:

1. Railway Dashboard → Settings → Networking → **TCP Proxy**
2. Tambahkan TCP Proxy yang mengarah ke port **22**
3. Copy `Domain` + `Port` yang di-generate
4. Connect: `ssh kopi@<tcp-domain> -p <tcp-port>`

## Deploy

Push ke repo GitHub, hubungkan ke Railway. Selesai.