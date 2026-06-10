const ALLOWED_CATEGORIES = [
  'grant',
  'funding',
  'exhibition',
  'networking',
  'fellowship',
  'training',
  'competition',
  'tender',
  'scholarship',
  'internship',
  'volunteering',
  'startup_programme',
  'other'
];

const ALLOWED_DELIVERY_MODES = [
  'physical',
  'remote',
  'hybrid',
  'general'
];

const ALLOWED_RISK_LEVELS = [
  'low',
  'medium',
  'high',
  'unverified'
];

const ALLOWED_STATUSES = [
  'draft',
  'review',
  'published',
  'personal_research',
  'closed',
  'expired',
  'suspicious'
];

const ALLOWED_VISIBILITY = [
  'public',
  'private',
  'review'
];

const REQUIRED_FIELDS = [
  ['title', 'Title is required'],
  ['organisation', 'Organisation is required'],
  ['category', 'Category is required'],
  ['deadline', 'Deadline is required'],
  ['description', 'Description is required'],
  ['eligibility', 'Eligibility is required'],
  ['applicationLink', 'Application link is required']
];

class Opportunity {
  constructor(data = {}) {
    this.id = data.id || this.generateId();
    this.title = data.title ?? '';
    this.organisation = data.organisation ?? '';
    this.category = data.category ?? '';
    this.description = data.description ?? '';
    this.countryScope = data.countryScope ?? '';
    this.location = data.location ?? '';
    this.deliveryMode = ALLOWED_DELIVERY_MODES.includes(data.deliveryMode) ? data.deliveryMode : '';
    // Deadline may legitimately be unknown for AI-researched opportunities — we
    // never invent one, so null is preserved rather than coerced to a string.
    this.deadline = data.deadline === undefined ? null : data.deadline;
    this.fundingAmount = data.fundingAmount ?? '';
    this.benefits = data.benefits ?? '';
    this.eligibility = data.eligibility ?? '';
    this.requiredDocuments = data.requiredDocuments ?? '';
    this.applicationSteps = data.applicationSteps ?? '';
    this.applicationLink = data.applicationLink ?? '';
    this.sourceUrl = data.sourceUrl ?? '';
    this.riskLevel = data.riskLevel || 'unverified';
    this.status = data.status || 'draft';
    // Ownership + visibility let user-researched opportunities stay private to
    // the person who found them until an admin decides to publish them globally.
    this.createdByUserId = data.createdByUserId ?? null;
    this.visibility = ALLOWED_VISIBILITY.includes(data.visibility) ? data.visibility : 'public';
    this.sourceCitations = Array.isArray(data.sourceCitations) ? data.sourceCitations : [];
    this.rawResearchText = data.rawResearchText ?? '';
    this.createdAt = data.createdAt || new Date().toISOString();
    this.updatedAt = data.updatedAt || new Date().toISOString();
  }

  generateId() {
    return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
  }

  static getCategories() {
    return ALLOWED_CATEGORIES;
  }

  static getRiskLevels() {
    return ALLOWED_RISK_LEVELS;
  }

  static getDeliveryModes() {
    return ALLOWED_DELIVERY_MODES;
  }

  static getStatuses() {
    return ALLOWED_STATUSES;
  }

  static getVisibilities() {
    return ALLOWED_VISIBILITY;
  }

  validate() {
    const errors = [];

    REQUIRED_FIELDS.forEach(([field, message]) => {
      if (Opportunity.isBlank(this[field])) {
        errors.push(message);
      }
    });

    if (!Opportunity.isBlank(this.deadline) && Number.isNaN(Date.parse(this.deadline))) {
      errors.push('Deadline must be a valid date');
    }

    if (!Opportunity.isBlank(this.category) && !Opportunity.getCategories().includes(this.category)) {
      errors.push('Category must be one of the allowed categories');
    }

    if (!Opportunity.isBlank(this.riskLevel) && !Opportunity.getRiskLevels().includes(this.riskLevel)) {
      errors.push('Risk level must be one of the allowed values');
    }

    if (!Opportunity.isBlank(this.deliveryMode) && !Opportunity.getDeliveryModes().includes(this.deliveryMode)) {
      errors.push('Delivery mode must be one of the allowed values');
    }

    if (!Opportunity.isBlank(this.status) && !Opportunity.getStatuses().includes(this.status)) {
      errors.push('Status must be one of the allowed values');
    }

    if (!Opportunity.isBlank(this.applicationLink) && !Opportunity.isValidUrl(this.applicationLink)) {
      errors.push('Application link must be a valid URL');
    }

    if (!Opportunity.isBlank(this.sourceUrl) && !Opportunity.isValidUrl(this.sourceUrl)) {
      errors.push('Source URL must be a valid URL');
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  static isBlank(value) {
    return value === undefined || value === null || String(value).trim() === '';
  }

  static isValidUrl(value) {
    try {
      const url = new URL(value);
      return url.protocol === 'http:' || url.protocol === 'https:';
    } catch (_) {
      return false;
    }
  }

  update(data) {
    Object.keys(data).forEach(key => {
      if (key !== 'id' && key !== 'createdAt') {
        this[key] = data[key];
      }
    });
    this.updatedAt = new Date().toISOString();
  }

  updateStatus(status) {
    if (Opportunity.getStatuses().includes(status)) {
      this.status = status;
      this.updatedAt = new Date().toISOString();
      return true;
    }
    return false;
  }

  isExpired() {
    if (!this.deadline) return true;
    return new Date(this.deadline) < new Date();
  }

  toObject() {
    return {
      id: this.id,
      title: this.title,
      organisation: this.organisation,
      category: this.category,
      description: this.description,
      countryScope: this.countryScope,
      location: this.location,
      deliveryMode: this.deliveryMode,
      deadline: this.deadline,
      fundingAmount: this.fundingAmount,
      benefits: this.benefits,
      eligibility: this.eligibility,
      requiredDocuments: this.requiredDocuments,
      applicationSteps: this.applicationSteps,
      applicationLink: this.applicationLink,
      sourceUrl: this.sourceUrl,
      riskLevel: this.riskLevel,
      status: this.status,
      createdByUserId: this.createdByUserId,
      visibility: this.visibility,
      sourceCitations: this.sourceCitations,
      rawResearchText: this.rawResearchText,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt
    };
  }
}

module.exports = Opportunity;
