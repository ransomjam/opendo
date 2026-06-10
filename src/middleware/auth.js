const jwt = require('jsonwebtoken');
const { jwtSecret } = require('../config/env');
const User = require('../models/User');
const { readJsonArray } = require('../utils/jsonStore');

function authError(res) {
  return res.status(401).json({
    success: false,
    message: 'Authentication required'
  });
}

async function requireAuth(req, res, next) {
  const header = req.get('Authorization') || '';
  const [scheme, token] = header.split(' ');

  if (scheme !== 'Bearer' || !token) {
    return authError(res);
  }

  try {
    const payload = jwt.verify(token, jwtSecret);
    const users = (await readJsonArray('users.json')).map(user => new User(user));
    const user = users.find(item => item.id === payload.sub);

    if (!user) {
      return authError(res);
    }

    req.user = user.toPublicObject();
    return next();
  } catch (error) {
    return authError(res);
  }
}

// Like requireAuth, but never rejects the request. If a valid token is present
// req.user is populated; otherwise the request continues anonymously. Used by
// endpoints that are public but behave differently for signed-in users.
async function optionalAuth(req, res, next) {
  const header = req.get('Authorization') || '';
  const [scheme, token] = header.split(' ');

  if (scheme === 'Bearer' && token) {
    try {
      const payload = jwt.verify(token, jwtSecret);
      const users = (await readJsonArray('users.json')).map(user => new User(user));
      const user = users.find(item => item.id === payload.sub);
      if (user) {
        req.user = user.toPublicObject();
      }
    } catch (error) {
      // Ignore invalid tokens for optional auth.
    }
  }

  return next();
}

function requireAdmin(req, res, next) {
  if (!req.user || !['admin', 'super_admin'].includes(req.user.role)) {
    return res.status(403).json({
      success: false,
      message: 'Admin access required'
    });
  }

  return next();
}

module.exports = {
  requireAuth,
  optionalAuth,
  requireAdmin
};
