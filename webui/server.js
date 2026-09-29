const express = require('express');
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');

const app = express();
const PORT = process.env.PORT || 8080;
const ADMIN_USER = process.env.ADMIN_USER || process.env.SSH_USERNAME || 'kopi';
const ADMIN_PASS = process.env.ADMIN_PASS || process.env.SSH_PASSWORD || 'kapal';

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ================= Basic Auth =================
function basicAuth(req, res, next) {
  const auth = req.headers.authorization;
  if (!auth || !auth.startsWith('Basic ')) {
    res.set('WWW-Authenticate', 'Basic realm="SSH Manager"');
    return res.status(401).send('Auth required');
  }
  const decoded = Buffer.from(auth.slice(6), 'base64').toString();
  const idx = decoded.indexOf(':');
  const user = decoded.slice(0, idx);
  const pass = decoded.slice(idx + 1);
  if (user === ADMIN_USER && pass === ADMIN_PASS) return next();
  res.set('WWW-Authenticate', 'Basic realm="SSH Manager"');
  return res.status(401).send('Invalid credentials');
}

app.use(basicAuth);

// ================= Helpers =================
function spawnCmd(cmd, args = [], input = null) {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args);
    let stdout = '', stderr = '';
    child.stdout.on('data', d => stdout += d);
    child.stderr.on('data', d => stderr += d);
    child.on('error', reject);
    child.on('close', code => {
      if (code === 0) resolve(stdout);
      else reject(new Error(stderr.trim() || `Command failed: ${cmd}`));
    });
    if (input !== null) {
      child.stdin.write(input);
    }
    child.stdin.end();
  });
}

function chpasswd(username, password) {
  return spawnCmd('chpasswd', [], `${username}:${password}\n`);
}

function getGroups(username) {
  try {
    const groups = fs.readFileSync('/etc/group', 'utf8');
    const list = [];
    for (const line of groups.split('\n')) {
      if (!line) continue;
      const parts = line.split(':');
      if (parts[3] && parts[3].split(',').includes(username)) list.push(parts[0]);
    }
    return list;
  } catch (e) { return []; }
}

function listUsers() {
  const passwd = fs.readFileSync('/etc/passwd', 'utf8');
  const users = [];
  for (const line of passwd.split('\n')) {
    if (!line) continue;
    const parts = line.split(':');
    const [name, , uid, gid, , home, shell] = parts;
    const uidN = parseInt(uid, 10);
    if (
      uidN >= 1000 && uidN < 65534 &&
      shell && !shell.includes('nologin') && !shell.includes('false')
    ) {
      const groups = getGroups(name);
      users.push({
        username: name,
        uid: uidN,
        gid: parseInt(gid, 10),
        home,
        shell,
        sudo: groups.includes('sudo'),
        groups
      });
    }
  }
  return users;
}

function validateUsername(u) {
  return typeof u === 'string' && /^[a-z_][a-z0-9_-]{0,31}$/.test(u);
}

// ================= API =================
app.get('/api/info', (req, res) => {
  let ip = '';
  try {
    const nets = os.networkInterfaces();
    for (const name of Object.keys(nets)) {
      for (const net of nets[name] || []) {
        if (net.family === 'IPv4' && !net.internal) { ip = net.address; break; }
      }
      if (ip) break;
    }
  } catch (e) {}

  const tcpDomain = process.env.RAILWAY_TCP_PROXY_DOMAIN || '';
  const tcpPort = process.env.RAILWAY_TCP_PROXY_PORT || '22';
  const httpDomain = process.env.RAILWAY_PUBLIC_DOMAIN || req.headers.host || '';

  res.json({
    hostname: os.hostname(),
    ip,
    sshPort: 22,
    tcpDomain,
    tcpPort,
    httpDomain,
    adminUser: ADMIN_USER,
    sshCommand: tcpDomain
      ? `ssh ${ADMIN_USER}@${tcpDomain} -p ${tcpPort}`
      : `ssh ${ADMIN_USER}@${ip || 'your-host'} -p 22`
  });
});

app.get('/api/users', (req, res) => {
  try {
    res.json(listUsers());
  } catch (e) {
    res.status(500).json({ error: String(e.message || e) });
  }
});

app.post('/api/users', async (req, res) => {
  const { username, password, sudo } = req.body || {};
  if (!username || !password) {
    return res.status(400).json({ error: 'Username dan password wajib diisi' });
  }
  if (!validateUsername(username)) {
    return res.status(400).json({ error: 'Username tidak valid (huruf kecil, angka, _, -)' });
  }
  if (password.length < 3) {
    return res.status(400).json({ error: 'Password minimal 3 karakter' });
  }
  try {
    await spawnCmd('useradd', ['-ms', '/bin/bash', username]);
    await chpasswd(username, password);
    if (sudo) {
      await spawnCmd('usermod', ['-aG', 'sudo', username]);
    }
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: String(e.message || e) });
  }
});

app.delete('/api/users/:username', async (req, res) => {
  const { username } = req.params;
  if (!validateUsername(username)) {
    return res.status(400).json({ error: 'Username tidak valid' });
  }
  if (username === ADMIN_USER) {
    return res.status(400).json({ error: 'Tidak bisa menghapus user admin utama' });
  }
  try {
    try { await spawnCmd('pkill', ['-u', username]); } catch (e) {}
    try {
      await spawnCmd('userdel', ['-r', username]);
    } catch (e) {
      await spawnCmd('userdel', [username]);
    }
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: String(e.message || e) });
  }
});

app.post('/api/users/:username/password', async (req, res) => {
  const { username } = req.params;
  const { password } = req.body || {};
  if (!validateUsername(username)) {
    return res.status(400).json({ error: 'Username tidak valid' });
  }
  if (!password || password.length < 3) {
    return res.status(400).json({ error: 'Password minimal 3 karakter' });
  }
  try {
    await chpasswd(username, password);
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: String(e.message || e) });
  }
});

app.post('/api/users/:username/sudo', async (req, res) => {
  const { username } = req.params;
  const { enable } = req.body || {};
  if (!validateUsername(username)) {
    return res.status(400).json({ error: 'Username tidak valid' });
  }
  try {
    if (enable) {
      await spawnCmd('usermod', ['-aG', 'sudo', username]);
    } else {
      try {
        await spawnCmd('gpasswd', ['-d', username, 'sudo']);
      } catch (e) {
        await spawnCmd('deluser', [username, 'sudo']);
      }
    }
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: String(e.message || e) });
  }
});

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`>>> SSH Manager UI: http://0.0.0.0:${PORT}`);
  console.log(`>>> Login: ${ADMIN_USER} / ${ADMIN_PASS}`);
});