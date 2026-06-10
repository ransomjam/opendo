const express = require('express');
const UserProfile = require('../models/UserProfile');
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

router.get('/', requireAuth, async (req, res) => {
  try {
    const profiles = (await readJsonArray('userProfiles.json')).map(profile => new UserProfile(profile));
    const profile = profiles.find(item => item.userId === req.user.id);

    return res.json({
      success: true,
      profile: profile ? profile.toObject() : null
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Error fetching profile', error: error.message });
  }
});

router.put('/', requireAuth, async (req, res) => {
  try {
    const validation = UserProfile.validatePayload(req.body);

    if (!validation.isValid) {
      return validationError(res, validation.errors);
    }

    const profiles = (await readJsonArray('userProfiles.json')).map(profile => new UserProfile(profile));
    const profileIndex = profiles.findIndex(item => item.userId === req.user.id);
    let profile;

    if (profileIndex === -1) {
      profile = new UserProfile({
        ...req.body,
        userId: req.user.id
      });
      profiles.push(profile);
    } else {
      profile = profiles[profileIndex];
      profile.update(req.body);
      profiles[profileIndex] = profile;
    }

    await writeJsonArray('userProfiles.json', profiles.map(item => item.toObject()));

    return res.json({
      success: true,
      message: 'Profile saved successfully',
      profile: profile.toObject()
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Error saving profile', error: error.message });
  }
});

module.exports = router;
