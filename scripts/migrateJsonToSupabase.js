// Copy local JSON data files into Supabase.
//
// Requires SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.
// Optional: DATA_DIR points to the local JSON directory to import.

require('../src/config/env');
const fs = require('fs');
const path = require('path');
const { getDataDir } = require('../src/config/storage');
const { isSupabaseConfigured } = require('../src/config/supabase');
const { upsertStructuredCollection } = require('../src/repositories/supabaseStructuredStore');

const FILES = [
  'users.json',
  'userProfiles.json',
  'userDocuments.json',
  'opportunities.json',
  'userOpportunityMatches.json',
  'actionSteps.json'
];

function fail(message) {
  console.error(`\n[migrate-json-to-supabase] ${message}\n`);
  process.exit(1);
}

async function main() {
  if (!isSupabaseConfigured()) {
    fail('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required.');
  }

  const dataDir = getDataDir();
  for (const fileName of FILES) {
    const filePath = path.join(dataDir, fileName);
    const data = fs.existsSync(filePath)
      ? JSON.parse(fs.readFileSync(filePath, 'utf8') || '[]')
      : [];
    if (!Array.isArray(data)) {
      fail(`${fileName} must contain a JSON array.`);
    }
    await upsertStructuredCollection(fileName, data);
    console.log(`[migrate-json-to-supabase] ${fileName}: ${data.length} record(s)`);
  }
}

main().catch(error => fail(error.message));
