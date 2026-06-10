const { port } = require('./config/env');
const app = require('./app');
const { createOrPromoteAdminFromEnv } = require('./services/adminBootstrapService');

async function start() {
  try {
    const result = await createOrPromoteAdminFromEnv();
    if (result.configured) {
      console.log(`[admin-bootstrap] ${result.action} admin user "${result.email}"`);
    }
  } catch (error) {
    console.error(`[admin-bootstrap] ${error.message}`);
  }

  app.listen(port, () => {
    console.log(`Opportunity Tracker API running on port ${port}`);
  });
}

start();
