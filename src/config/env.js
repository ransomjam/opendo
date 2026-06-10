const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { getDataDir } = require('./storage');

const envPath = path.join(__dirname, '..', '..', '.env');

if (fs.existsSync(envPath)) {
  const lines = fs.readFileSync(envPath, 'utf8').split(/\r?\n/);

  lines.forEach(line => {
    const trimmed = line.trim();

    if (!trimmed || trimmed.startsWith('#')) {
      return;
    }

    const separatorIndex = trimmed.indexOf('=');

    if (separatorIndex === -1) {
      return;
    }

    const key = trimmed.slice(0, separatorIndex).trim();
    const value = trimmed.slice(separatorIndex + 1).trim().replace(/^["']|["']$/g, '');

    if (key && process.env[key] === undefined) {
      process.env[key] = value;
    }
  });
}

// Resolve a STABLE JWT secret.
//  - If JWT_SECRET is set in the environment/.env, always use that.
//  - Otherwise persist a generated secret to disk so tokens stay valid across
//    server restarts (e.g. nodemon). Without this, a fresh random secret on
//    every boot invalidates existing logins and every request returns 401.
function resolveJwtSecret() {
  if (process.env.JWT_SECRET && process.env.JWT_SECRET.trim()) {
    return process.env.JWT_SECRET.trim();
  }

  const secretPath = path.join(getDataDir(), '.jwt_secret');
  try {
    if (fs.existsSync(secretPath)) {
      const existing = fs.readFileSync(secretPath, 'utf8').trim();
      if (existing) return existing;
    }
    const generated = crypto.randomBytes(32).toString('hex');
    fs.mkdirSync(path.dirname(secretPath), { recursive: true });
    fs.writeFileSync(secretPath, generated);
    console.warn(`[env] JWT_SECRET not set; generated a persistent dev secret at ${secretPath}. Set JWT_SECRET in .env for production.`);
    return generated;
  } catch (error) {
    // Last resort: ephemeral secret (tokens won't survive a restart).
    return crypto.randomBytes(32).toString('hex');
  }
}

module.exports = {
  port: process.env.PORT || 5000,
  jwtSecret: resolveJwtSecret(),
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '7d'
};
