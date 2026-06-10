const { v4: uuidv4 } = require('uuid');

const ARRAY_FIELDS = [
  'skills',
  'sectorInterests',
  'preferredOpportunityTypes',
  'portfolioLinks'
];

const BOOLEAN_FIELDS = [
  'travelAvailable',
  'passportAvailable',
  'businessRegistered'
];

class UserProfile {
  constructor(data = {}) {
    this.id = data.id || uuidv4();
    this.userId = data.userId;
    this.country = data.country ?? '';
    this.city = data.city ?? '';
    this.profession = data.profession ?? '';
    this.educationLevel = data.educationLevel ?? '';
    this.skills = Array.isArray(data.skills) ? data.skills : [];
    this.businessType = data.businessType ?? '';
    this.businessStage = data.businessStage ?? '';
    this.sectorInterests = Array.isArray(data.sectorInterests) ? data.sectorInterests : [];
    this.fundingNeeds = data.fundingNeeds ?? '';
    this.travelAvailable = typeof data.travelAvailable === 'boolean' ? data.travelAvailable : false;
    this.passportAvailable = typeof data.passportAvailable === 'boolean' ? data.passportAvailable : false;
    this.businessRegistered = typeof data.businessRegistered === 'boolean' ? data.businessRegistered : false;
    this.preferredOpportunityTypes = Array.isArray(data.preferredOpportunityTypes) ? data.preferredOpportunityTypes : [];
    this.bio = data.bio ?? '';
    this.portfolioLinks = Array.isArray(data.portfolioLinks) ? data.portfolioLinks : [];
    this.createdAt = data.createdAt || new Date().toISOString();
    this.updatedAt = data.updatedAt || new Date().toISOString();
  }

  static validatePayload(data = {}) {
    const errors = [];

    ARRAY_FIELDS.forEach(field => {
      if (data[field] !== undefined && !Array.isArray(data[field])) {
        errors.push(`${field} must be an array`);
      }
    });

    BOOLEAN_FIELDS.forEach(field => {
      if (data[field] !== undefined && typeof data[field] !== 'boolean') {
        errors.push(`${field} must be a boolean`);
      }
    });

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  update(data = {}) {
    Object.keys(data).forEach(key => {
      if (key !== 'id' && key !== 'userId' && key !== 'createdAt') {
        this[key] = data[key];
      }
    });
    this.updatedAt = new Date().toISOString();
  }

  toObject() {
    return {
      id: this.id,
      userId: this.userId,
      country: this.country,
      city: this.city,
      profession: this.profession,
      educationLevel: this.educationLevel,
      skills: this.skills,
      businessType: this.businessType,
      businessStage: this.businessStage,
      sectorInterests: this.sectorInterests,
      fundingNeeds: this.fundingNeeds,
      travelAvailable: this.travelAvailable,
      passportAvailable: this.passportAvailable,
      businessRegistered: this.businessRegistered,
      preferredOpportunityTypes: this.preferredOpportunityTypes,
      bio: this.bio,
      portfolioLinks: this.portfolioLinks,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt
    };
  }
}

module.exports = UserProfile;
