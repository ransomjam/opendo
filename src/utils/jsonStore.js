const fs = require('fs');
const path = require('path');
const { getDataDir } = require('../config/storage');
const {
  getSupabaseClient,
  getSupabaseJsonTable,
  isSupabaseConfigured
} = require('../config/supabase');

function resolveDataPath(fileName) {
  return path.join(getDataDir(), fileName);
}

function readJsonArrayFromFile(fileName) {
  const filePath = resolveDataPath(fileName);

  if (!fs.existsSync(filePath)) {
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    fs.writeFileSync(filePath, '[]');
  }

  const content = fs.readFileSync(filePath, 'utf8').trim();

  if (!content) {
    return [];
  }

  return JSON.parse(content);
}

function writeJsonArrayToFile(fileName, data) {
  const filePath = resolveDataPath(fileName);
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(data, null, 2)}\n`);
}

async function readJsonArray(fileName) {
  if (!isSupabaseConfigured()) {
    return readJsonArrayFromFile(fileName);
  }

  const supabase = getSupabaseClient();
  const table = getSupabaseJsonTable();
  const { data, error } = await supabase
    .from(table)
    .select('data')
    .eq('file_name', fileName)
    .maybeSingle();

  if (error) {
    throw new Error(`Supabase read failed for ${fileName}: ${error.message}`);
  }

  if (!data) {
    await writeJsonArray(fileName, []);
    return [];
  }

  return Array.isArray(data.data) ? data.data : [];
}

async function writeJsonArray(fileName, data) {
  if (!Array.isArray(data)) {
    throw new Error(`writeJsonArray expected an array for ${fileName}`);
  }

  if (!isSupabaseConfigured()) {
    writeJsonArrayToFile(fileName, data);
    return;
  }

  const supabase = getSupabaseClient();
  const table = getSupabaseJsonTable();
  const { error } = await supabase
    .from(table)
    .upsert({
      file_name: fileName,
      data,
      updated_at: new Date().toISOString()
    }, { onConflict: 'file_name' });

  if (error) {
    throw new Error(`Supabase write failed for ${fileName}: ${error.message}`);
  }
}

module.exports = {
  readJsonArray,
  writeJsonArray
};
