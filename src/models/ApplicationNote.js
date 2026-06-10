const { v4: uuidv4 } = require('uuid');

class ApplicationNote {
  constructor(data = {}) {
    this.id = data.id || uuidv4();
    this.userId = data.userId;
    this.opportunityId = data.opportunityId;
    this.content = data.content ?? '';
    this.createdAt = data.createdAt || new Date().toISOString();
    this.updatedAt = data.updatedAt || new Date().toISOString();
  }

  update(data = {}) {
    if (data.content !== undefined) {
      this.content = String(data.content || '');
    }
    this.updatedAt = new Date().toISOString();
  }

  toObject() {
    return {
      id: this.id,
      userId: this.userId,
      opportunityId: this.opportunityId,
      content: this.content,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt
    };
  }
}

module.exports = ApplicationNote;
