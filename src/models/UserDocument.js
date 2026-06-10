const { v4: uuidv4 } = require('uuid');

const ALLOWED_DOCUMENT_TYPES = [
  'cv',
  'business_registration',
  'pitch_deck',
  'portfolio',
  'passport',
  'tax_certificate',
  'recommendation_letter',
  'concept_note',
  'budget',
  'academic_transcript',
  'other'
];

const ALLOWED_STATUSES = [
  'uploaded',
  'reviewed',
  'rejected'
];

class UserDocument {
  constructor(data = {}) {
    this.id = data.id || uuidv4();
    this.userId = data.userId;
    this.documentType = data.documentType ?? '';
    this.originalName = data.originalName ?? '';
    this.storedName = data.storedName ?? '';
    this.filePath = data.filePath ?? '';
    this.mimeType = data.mimeType ?? '';
    this.size = data.size ?? 0;
    this.status = ALLOWED_STATUSES.includes(data.status) ? data.status : 'uploaded';
    this.createdAt = data.createdAt || new Date().toISOString();
    this.updatedAt = data.updatedAt || new Date().toISOString();
  }

  static getDocumentTypes() {
    return ALLOWED_DOCUMENT_TYPES;
  }

  static getStatuses() {
    return ALLOWED_STATUSES;
  }

  toObject() {
    return {
      id: this.id,
      userId: this.userId,
      documentType: this.documentType,
      originalName: this.originalName,
      storedName: this.storedName,
      filePath: this.filePath,
      mimeType: this.mimeType,
      size: this.size,
      status: this.status,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt
    };
  }
}

module.exports = UserDocument;
