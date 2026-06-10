const path = require('path');

const projectRoot = path.join(__dirname, '..', '..');

function resolveConfiguredPath(value, fallback) {
  const trimmed = String(value || '').trim();
  return trimmed ? path.resolve(trimmed) : fallback;
}

function getDataDir() {
  return resolveConfiguredPath(process.env.DATA_DIR, path.join(projectRoot, 'src', 'data'));
}

function getUploadsDir() {
  return resolveConfiguredPath(process.env.UPLOADS_DIR, path.join(projectRoot, 'uploads'));
}

function getDocumentsUploadDir() {
  return path.join(getUploadsDir(), 'documents');
}

function getDocumentMetadataPath(fileName) {
  return path.posix.join('uploads', 'documents', fileName);
}

function resolveDocumentFilePath(document) {
  const storedName = document && document.storedName;
  if (storedName) return path.join(getDocumentsUploadDir(), storedName);

  const filePath = document && document.filePath;
  if (!filePath) return '';

  return path.join(getUploadsDir(), ...String(filePath).split(/[\\/]/).slice(1));
}

module.exports = {
  getDataDir,
  getUploadsDir,
  getDocumentsUploadDir,
  getDocumentMetadataPath,
  resolveDocumentFilePath
};
