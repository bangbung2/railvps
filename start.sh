#!/bin/bash
set -e

echo "==========================================="
echo "  Railway SSH VPS + Web Manager"
echo "==========================================="

# Jalankan setup SSH user (background, dia akan exec sshd -D)
/app/ssh-user-config.sh &
SSHD_PID=$!

# Tunggu sshd siap
sleep 2

echo ">>> Starting Web UI..."
exec node /app/webui/server.js