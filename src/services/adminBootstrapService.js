const bcrypt = require('bcryptjs');
const User = require('../models/User');
const { readJsonArray, writeJsonArray } = require('../utils/jsonStore');

const USERS_FILE = 'users.json';

function getAdminEnv() {
  return {
    fullName: process.env.ADMIN_FULL_NAME || 'Admin User',
    email: String(process.env.ADMIN_EMAIL || '').trim().toLowerCase(),
    password: process.env.ADMIN_PASSWORD || ''
  };
}

async function createOrPromoteAdminFromEnv({ requireConfigured = false } = {}) {
  const { fullName, email, password } = getAdminEnv();

  if (!email || !password) {
    if (requireConfigured) {
      throw new Error('ADMIN_EMAIL and ADMIN_PASSWORD are required.');
    }
    return { configured: false, changed: false };
  }

  if (password.length < 6) {
    throw new Error('ADMIN_PASSWORD must be at least 6 characters.');
  }

  const users = await readJsonArray(USERS_FILE);
  const passwordHash = await bcrypt.hash(password, 10);
  const existingIndex = users.findIndex(
    user => String(user.email).trim().toLowerCase() === email
  );

  if (existingIndex !== -1) {
    const existing = new User(users[existingIndex]);
    existing.role = 'admin';
    existing.passwordHash = passwordHash;
    existing.fullName = fullName || existing.fullName;
    existing.updatedAt = new Date().toISOString();
    users[existingIndex] = existing.toObject();
    await writeJsonArray(USERS_FILE, users);
    return { configured: true, changed: true, action: 'updated', email };
  }

  const admin = new User({ fullName, email, passwordHash, role: 'admin' });
  users.push(admin.toObject());
  await writeJsonArray(USERS_FILE, users);
  return { configured: true, changed: true, action: 'created', email };
}

module.exports = {
  createOrPromoteAdminFromEnv
};
