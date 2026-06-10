// Create or promote an admin user from environment variables.
//
// Usage:
//   ADMIN_FULL_NAME, ADMIN_EMAIL, ADMIN_PASSWORD are read from the environment
//   (or from the project .env file). Run with:  npm run create-admin
//
// If a user with ADMIN_EMAIL already exists, their role is upgraded to "admin"
// (and the password is reset if ADMIN_PASSWORD is provided).

require('../src/config/env'); // loads .env into process.env
const bcrypt = require('bcryptjs');
const User = require('../src/models/User');
const { readJsonArray, writeJsonArray } = require('../src/utils/jsonStore');

const USERS_FILE = 'users.json';

function fail(message) {
  console.error(`\n[create-admin] ${message}\n`);
  process.exit(1);
}

async function main() {
  const fullName = process.env.ADMIN_FULL_NAME || 'Admin User';
  const email = (process.env.ADMIN_EMAIL || '').trim().toLowerCase();
  const password = process.env.ADMIN_PASSWORD || '';

  if (!email) fail('ADMIN_EMAIL is required (set it in .env or the environment).');
  if (!password) fail('ADMIN_PASSWORD is required (set it in .env or the environment).');
  if (password.length < 6) fail('ADMIN_PASSWORD must be at least 6 characters.');

  const users = readJsonArray(USERS_FILE);
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
    writeJsonArray(USERS_FILE, users);
    console.log(`\n[create-admin] Updated existing user "${email}" -> role: admin\n`);
  } else {
    const admin = new User({ fullName, email, passwordHash, role: 'admin' });
    users.push(admin.toObject());
    writeJsonArray(USERS_FILE, users);
    console.log(`\n[create-admin] Created admin user "${email}"\n`);
  }
}

main().catch(error => fail(error.message));
