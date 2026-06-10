// Create or promote an admin user from environment variables.
//
// Usage:
//   ADMIN_FULL_NAME, ADMIN_EMAIL, ADMIN_PASSWORD are read from the environment
//   (or from the project .env file). Run with:  npm run create-admin
//
// If a user with ADMIN_EMAIL already exists, their role is upgraded to "admin"
// (and the password is reset if ADMIN_PASSWORD is provided).

require('../src/config/env'); // loads .env into process.env
const { createOrPromoteAdminFromEnv } = require('../src/services/adminBootstrapService');

function fail(message) {
  console.error(`\n[create-admin] ${message}\n`);
  process.exit(1);
}

async function main() {
  const result = await createOrPromoteAdminFromEnv({ requireConfigured: true });
  console.log(`\n[create-admin] ${result.action === 'created' ? 'Created' : 'Updated'} admin user "${result.email}"\n`);
}

main().catch(error => fail(error.message));
