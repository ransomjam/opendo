const fs = require('fs');
const path = require('path');
const { getDataDir } = require('../config/storage');
const { isSupabaseConfigured } = require('../config/supabase');
const {
  readStructuredCollection,
  writeStructuredCollection
} = require('../repositories/supabaseStructuredStore');

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

  return readStructuredCollection(fileName);
}

async function writeJsonArray(fileName, data) {
  if (!Array.isArray(data)) {
    throw new Error(`writeJsonArray expected an array for ${fileName}`);
  }

  if (!isSupabaseConfigured()) {
    writeJsonArrayToFile(fileName, data);
    return;
  }

  await writeStructuredCollection(fileName, data);
}

module.exports = {
  readJsonArray,
  writeJsonArray
};
