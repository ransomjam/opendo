const { createClient } = require('@supabase/supabase-js');

let cachedClient;

function getSupabaseUrl() {
  return String(process.env.SUPABASE_URL || '').trim();
}

function getSupabaseKey() {
  return String(process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_KEY || '').trim();
}

function isSupabaseConfigured() {
  return !!(getSupabaseUrl() && getSupabaseKey());
}

function getSupabaseClient() {
  if (!isSupabaseConfigured()) return null;
  if (!cachedClient) {
    cachedClient = createClient(getSupabaseUrl(), getSupabaseKey(), {
      auth: {
        persistSession: false,
        autoRefreshToken: false
      }
    });
  }
  return cachedClient;
}

function getSupabaseJsonTable() {
  return String(process.env.SUPABASE_JSON_TABLE || 'opendo_json_store').trim();
}

function getSupabaseStorageBucket() {
  return String(process.env.SUPABASE_STORAGE_BUCKET || '').trim();
}

function isSupabaseStorageConfigured() {
  return !!(isSupabaseConfigured() && getSupabaseStorageBucket());
}

module.exports = {
  getSupabaseClient,
  getSupabaseJsonTable,
  getSupabaseStorageBucket,
  isSupabaseConfigured,
  isSupabaseStorageConfigured
};
