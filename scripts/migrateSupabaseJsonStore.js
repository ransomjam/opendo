// Copy existing rows from the legacy opendo_json_store table into the
// structured Supabase tables.
//
// Requires SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.
// Optional: SUPABASE_JSON_TABLE changes the legacy source table name.

require('../src/config/env');
const {
  getSupabaseClient,
  getSupabaseJsonTable,
  isSupabaseConfigured
} = require('../src/config/supabase');
const { upsertStructuredCollection } = require('../src/repositories/supabaseStructuredStore');

const FILES = [
  'users.json',
  'opportunities.json',
  'userProfiles.json',
  'userDocuments.json',
  'userOpportunityMatches.json',
  'actionSteps.json'
];

function fail(message) {
  console.error(`\n[migrate-supabase-json-store] ${message}\n`);
  process.exit(1);
}

function assertArray(fileName, value) {
  if (!Array.isArray(value)) {
    fail(`${fileName} in ${getSupabaseJsonTable()} must contain a JSON array.`);
  }
}

async function main() {
  if (!isSupabaseConfigured()) {
    fail('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required.');
  }

  const supabase = getSupabaseClient();
  const table = getSupabaseJsonTable();
  const { data, error } = await supabase
    .from(table)
    .select('file_name, data')
    .in('file_name', FILES);

  if (error) {
    fail(`Could not read ${table}: ${error.message}`);
  }

  const rowsByFile = new Map((data || []).map(row => [row.file_name, row.data]));

  for (const fileName of FILES) {
    const records = rowsByFile.get(fileName) || [];
    assertArray(fileName, records);
    await upsertStructuredCollection(fileName, records);
    console.log(`[migrate-supabase-json-store] ${fileName}: ${records.length} record(s)`);
  }
}

main().catch(error => fail(error.message));
