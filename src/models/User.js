const { v4: uuidv4 } = require('uuid');

const ALLOWED_ROLES = [
  'user',
  'admin',
  'super_admin'
];

class User {
  constructor(data = {}) {
    this.id = data.id || uuidv4();
    this.fullName = data.fullName ?? '';
    this.email = data.email ? String(data.email).trim().toLowerCase() : '';
    this.passwordHash = data.passwordHash ?? '';
    this.role = ALLOWED_ROLES.includes(data.role) ? data.role : 'user';
    this.createdAt = data.createdAt || new Date().toISOString();
    this.updatedAt = data.updatedAt || new Date().toISOString();
  }

  static getRoles() {
    return ALLOWED_ROLES;
  }

  toObject() {
    return {
      id: this.id,
      fullName: this.fullName,
      email: this.email,
      passwordHash: this.passwordHash,
      role: this.role,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt
    };
  }

  toPublicObject() {
    return {
      id: this.id,
      fullName: this.fullName,
      email: this.email,
      role: this.role
    };
  }
}

module.exports = User;
