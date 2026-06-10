const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const { jwtSecret, jwtExpiresIn } = require('../config/env');
const { requireAuth } = require('../middleware/auth');
const { readJsonArray, writeJsonArray } = require('../utils/jsonStore');

const router = express.Router();

function validationError(res, errors) {
  return res.status(400).json({
    success: false,
    message: 'Validation failed',
    errors
  });
}

function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function signToken(user) {
  return jwt.sign(
    {
      role: user.role
    },
    jwtSecret,
    {
      subject: user.id,
      expiresIn: jwtExpiresIn
    }
  );
}

router.post('/register', async (req, res) => {
  try {
    const { fullName, email, password } = req.body;
    const normalizedEmail = email ? String(email).trim().toLowerCase() : '';
    const errors = [];

    if (!fullName || !String(fullName).trim()) {
      errors.push('Full name is required');
    }

    if (!normalizedEmail) {
      errors.push('Email is required');
    } else if (!isValidEmail(normalizedEmail)) {
      errors.push('Email must be valid');
    }

    if (!password) {
      errors.push('Password is required');
    } else if (String(password).length < 6) {
      errors.push('Password must be at least 6 characters');
    }

    const users = readJsonArray('users.json').map(user => new User(user));
    const emailExists = users.some(user => user.email === normalizedEmail);

    if (emailExists) {
      errors.push('Email must be unique');
    }

    if (errors.length > 0) {
      return validationError(res, errors);
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const user = new User({
      fullName: String(fullName).trim(),
      email: normalizedEmail,
      passwordHash
    });

    users.push(user);
    writeJsonArray('users.json', users.map(item => item.toObject()));

    return res.status(201).json({
      success: true,
      message: 'Account created successfully',
      token: signToken(user),
      user: user.toPublicObject()
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Error creating account',
      error: error.message
    });
  }
});

router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    const normalizedEmail = email ? String(email).trim().toLowerCase() : '';
    const errors = [];

    if (!normalizedEmail) {
      errors.push('Email is required');
    }

    if (!password) {
      errors.push('Password is required');
    }

    if (errors.length > 0) {
      return validationError(res, errors);
    }

    const users = readJsonArray('users.json').map(user => new User(user));
    const user = users.find(item => item.email === normalizedEmail);
    const passwordMatches = user ? await bcrypt.compare(password, user.passwordHash) : false;

    if (!user || !passwordMatches) {
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password'
      });
    }

    return res.json({
      success: true,
      message: 'Login successful',
      token: signToken(user),
      user: user.toPublicObject()
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Error logging in',
      error: error.message
    });
  }
});

router.get('/me', requireAuth, (req, res) => {
  res.json({
    success: true,
    user: req.user
  });
});

module.exports = router;
