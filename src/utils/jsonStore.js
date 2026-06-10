const fs = require('fs');
const path = require('path');
const { getDataDir } = require('../config/storage');

function resolveDataPath(fileName) {
  return path.join(getDataDir(), fileName);
}

function readJsonArray(fileName) {
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

function writeJsonArray(fileName, data) {
  const filePath = resolveDataPath(fileName);
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(data, null, 2)}\n`);
}

module.exports = {
  readJsonArray,
  writeJsonArray
};
