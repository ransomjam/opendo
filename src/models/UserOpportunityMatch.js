const { v4: uuidv4 } = require('uuid');

const ALLOWED_STATUSES = [
  'new',
  'saved',
  'ignored',
  'interested',
  'applying',
  'submitted'
];

const ALLOWED_MATCH_LEVELS = [
  'excellent_fit',
  'strong_fit',
  'possible_fit',
  'weak_fit',
  'not_recommended'
];

const ALLOWED_ELIGIBILITY_STATUSES = [
  'likely_eligible',
  'possibly_eligible',
  'unclear',
  'not_eligible'
];

function toArray(value) {
  return Array.isArray(value) ? value : [];
}

function toScore(value) {
  const num = Number(value);
  if (Number.isNaN(num)) return 0;
  return Math.max(0, Math.min(100, Math.round(num)));
}

class UserOpportunityMatch {
  constructor(data = {}) {
    this.id = data.id || uuidv4();
    this.userId = data.userId;
    this.opportunityId = data.opportunityId;
    this.matchScore = toScore(data.matchScore);
    this.matchLevel = ALLOWED_MATCH_LEVELS.includes(data.matchLevel) ? data.matchLevel : 'not_recommended';
    this.eligibilityStatus = ALLOWED_ELIGIBILITY_STATUSES.includes(data.eligibilityStatus)
      ? data.eligibilityStatus
      : 'unclear';
    this.eligibilityScore = toScore(data.eligibilityScore);
    this.relevanceScore = toScore(data.relevanceScore);
    this.readinessScore = toScore(data.readinessScore);
    this.urgencyScore = toScore(data.urgencyScore);
    this.valueScore = toScore(data.valueScore);
    this.matchReasons = toArray(data.matchReasons);
    this.possibleConcerns = toArray(data.possibleConcerns);
    this.availableDocuments = toArray(data.availableDocuments);
    this.missingDocuments = toArray(data.missingDocuments);
    this.recommendedNextSteps = toArray(data.recommendedNextSteps);
    this.status = ALLOWED_STATUSES.includes(data.status) ? data.status : 'new';
    this.aiEnhanced = typeof data.aiEnhanced === 'boolean' ? data.aiEnhanced : false;
    this.createdAt = data.createdAt || new Date().toISOString();
    this.updatedAt = data.updatedAt || new Date().toISOString();
  }

  static getStatuses() {
    return ALLOWED_STATUSES;
  }

  static getMatchLevels() {
    return ALLOWED_MATCH_LEVELS;
  }

  static getEligibilityStatuses() {
    return ALLOWED_ELIGIBILITY_STATUSES;
  }

  static levelForScore(score) {
    const value = toScore(score);
    if (value >= 90) return 'excellent_fit';
    if (value >= 75) return 'strong_fit';
    if (value >= 55) return 'possible_fit';
    if (value >= 35) return 'weak_fit';
    return 'not_recommended';
  }

  updateStatus(status) {
    if (ALLOWED_STATUSES.includes(status)) {
      this.status = status;
      this.updatedAt = new Date().toISOString();
      return true;
    }
    return false;
  }

  toObject() {
    return {
      id: this.id,
      userId: this.userId,
      opportunityId: this.opportunityId,
      matchScore: this.matchScore,
      matchLevel: this.matchLevel,
      eligibilityStatus: this.eligibilityStatus,
      eligibilityScore: this.eligibilityScore,
      relevanceScore: this.relevanceScore,
      readinessScore: this.readinessScore,
      urgencyScore: this.urgencyScore,
      valueScore: this.valueScore,
      matchReasons: this.matchReasons,
      possibleConcerns: this.possibleConcerns,
      availableDocuments: this.availableDocuments,
      missingDocuments: this.missingDocuments,
      recommendedNextSteps: this.recommendedNextSteps,
      status: this.status,
      aiEnhanced: this.aiEnhanced,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt
    };
  }
}

module.exports = UserOpportunityMatch;
