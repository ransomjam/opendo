const { v4: uuidv4 } = require('uuid');

const ALLOWED_STATUSES = [
  'not_started',
  'in_progress',
  'completed',
  'skipped'
];

const ALLOWED_PRIORITIES = [
  'low',
  'medium',
  'high',
  'urgent'
];

class ActionStep {
  constructor(data = {}) {
    this.id = data.id || uuidv4();
    this.userId = data.userId;
    this.opportunityId = data.opportunityId;
    this.title = data.title ?? '';
    this.description = data.description ?? '';
    this.status = ALLOWED_STATUSES.includes(data.status) ? data.status : 'not_started';
    this.priority = ALLOWED_PRIORITIES.includes(data.priority) ? data.priority : 'medium';
    this.createdAt = data.createdAt || new Date().toISOString();
    this.updatedAt = data.updatedAt || new Date().toISOString();
  }

  static getStatuses() {
    return ALLOWED_STATUSES;
  }

  static getPriorities() {
    return ALLOWED_PRIORITIES;
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
      title: this.title,
      description: this.description,
      status: this.status,
      priority: this.priority,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt
    };
  }
}

module.exports = ActionStep;
