const express = require('express');
const fs = require('fs');
const path = require('path');
const multer = require('multer');
const { v4: uuidv4 } = require('uuid');
const UserDocument = require('../models/UserDocument');
const { requireAuth } = require('../middleware/auth');
const {
  getDocumentsUploadDir,
  getDocumentMetadataPath,
  resolveDocumentFilePath
} = require('../config/storage');
const { readJsonArray, writeJsonArray } = require('../utils/jsonStore');

const router = express.Router();
const uploadDirectory = getDocumentsUploadDir();
const maxFileSize = 10 * 1024 * 1024;

const allowedMimeTypes = [
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'image/png',
  'image/jpeg'
];

const allowedExtensions = [
  '.pdf',
  '.doc',
  '.docx',
  '.png',
  '.jpg',
  '.jpeg'
];

fs.mkdirSync(uploadDirectory, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDirectory);
  },
  filename: (req, file, cb) => {
    const extension = path.extname(file.originalname).toLowerCase();
    cb(null, `${uuidv4()}${extension}`);
  }
});

const upload = multer({
  storage,
  limits: {
    fileSize: maxFileSize
  },
  fileFilter: (req, file, cb) => {
    const extension = path.extname(file.originalname).toLowerCase();

    if (!allowedMimeTypes.includes(file.mimetype) || !allowedExtensions.includes(extension)) {
      return cb(new Error('File type must be PDF, DOC, DOCX, PNG, JPG, or JPEG'));
    }

    return cb(null, true);
  }
});

function validationError(res, errors) {
  return res.status(400).json({
    success: false,
    message: 'Validation failed',
    errors
  });
}

function removeUploadedFile(file) {
  if (file && file.path && fs.existsSync(file.path)) {
    fs.unlinkSync(file.path);
  }
}

function handleUpload(req, res, next) {
  upload.single('file')(req, res, error => {
    if (!error) {
      return next();
    }

    if (error instanceof multer.MulterError && error.code === 'LIMIT_FILE_SIZE') {
      return validationError(res, ['File size must not exceed 10MB']);
    }

    return validationError(res, [error.message]);
  });
}

router.get('/', requireAuth, (req, res) => {
  const documents = readJsonArray('userDocuments.json')
    .map(document => new UserDocument(document))
    .filter(document => document.userId === req.user.id)
    .map(document => document.toObject());

  return res.json({
    success: true,
    count: documents.length,
    documents
  });
});

router.post('/', requireAuth, handleUpload, (req, res) => {
  const { documentType } = req.body;
  const errors = [];

  if (!documentType) {
    errors.push('Document type is required');
  } else if (!UserDocument.getDocumentTypes().includes(documentType)) {
    errors.push('Document type must be one of the allowed values');
  }

  if (!req.file) {
    errors.push('File is required');
  }

  if (errors.length > 0) {
    removeUploadedFile(req.file);
    return validationError(res, errors);
  }

  const document = new UserDocument({
    userId: req.user.id,
    documentType,
    originalName: req.file.originalname,
    storedName: req.file.filename,
    filePath: getDocumentMetadataPath(req.file.filename),
    mimeType: req.file.mimetype,
    size: req.file.size
  });

  const documents = readJsonArray('userDocuments.json').map(item => new UserDocument(item));
  documents.push(document);
  writeJsonArray('userDocuments.json', documents.map(item => item.toObject()));

  return res.status(201).json({
    success: true,
    message: 'Document uploaded successfully',
    document: document.toObject()
  });
});

router.get('/:id', requireAuth, (req, res) => {
  const documents = readJsonArray('userDocuments.json').map(document => new UserDocument(document));
  const document = documents.find(item => item.id === req.params.id && item.userId === req.user.id);

  if (!document) {
    return res.status(404).json({
      success: false,
      message: 'Document not found'
    });
  }

  return res.json({
    success: true,
    document: document.toObject()
  });
});

router.delete('/:id', requireAuth, (req, res) => {
  const documents = readJsonArray('userDocuments.json').map(document => new UserDocument(document));
  const documentIndex = documents.findIndex(item => item.id === req.params.id && item.userId === req.user.id);

  if (documentIndex === -1) {
    return res.status(404).json({
      success: false,
      message: 'Document not found'
    });
  }

  const [document] = documents.splice(documentIndex, 1);
  const absolutePath = resolveDocumentFilePath(document);

  if (absolutePath && fs.existsSync(absolutePath)) {
    fs.unlinkSync(absolutePath);
  }

  writeJsonArray('userDocuments.json', documents.map(item => item.toObject()));

  return res.json({
    success: true,
    message: 'Document deleted successfully'
  });
});

module.exports = router;
