#!/bin/bash
set -e

# ============== DEFAULT CREDENTIALS ==============
# Langsung pakai tanpa perlu set variable apapun
: ${SSH_USERNAME:="kopi"}
: ${SSH_PASSWORD:="kapal"}
: ${ROOT_PASSWORD:="kapal"}
: ${AUTHORIZED_KEYS:=""}

echo ">>> SSH setup: user=$SSH_USERNAME"

# Pastikan config sshd: root login & password auth
sed -i 's/^#\?PermitRootLogin.*/PermitRootLogin yes/' /etc/ssh/sshd_config
sed -i 's/^#\?PasswordAuthentication.*/PasswordAuthentication yes/' /etc/ssh/sshd_config

# Set root password
if [ -n "$ROOT_PASSWORD" ]; then
    echo "root:$ROOT_PASSWORD" | chpasswd
    echo ">>> Root password set"
fi

# Validasi
if [ -z "$SSH_USERNAME" ] || [ -z "$SSH_PASSWORD" ]; then
    echo "Error: SSH_USERNAME dan SSH_PASSWORD wajib diisi." >&2
    exit 1
fi

# Buat / update user
if id "$SSH_USERNAME" &>/dev/null; then
    echo ">>> User $SSH_USERNAME sudah ada, update password"
else
    useradd -ms /bin/bash "$SSH_USERNAME"
    echo ">>> User $SSH_USERNAME dibuat"
fi
echo "$SSH_USERNAME:$SSH_PASSWORD" | chpasswd
usermod -aG sudo "$SSH_USERNAME" 2>/dev/null || true
echo ">>> Password $SSH_USERNAME di-set, ditambahkan ke grup sudo"

# Authorized keys (opsional)
if [ -n "$AUTHORIZED_KEYS" ]; then
    mkdir -p "/home/$SSH_USERNAME/.ssh"
    echo "$AUTHORIZED_KEYS" > "/home/$SSH_USERNAME/.ssh/authorized_keys"
    chown -R "$SSH_USERNAME:$SSH_USERNAME" "/home/$SSH_USERNAME/.ssh"
    chmod 700 "/home/$SSH_USERNAME/.ssh"
    chmod 600 "/home/$SSH_USERNAME/.ssh/authorized_keys"
    echo ">>> Authorized keys di-set"
fi

echo ">>> Starting SSH server..."
exec /usr/sbin/sshd -D -e