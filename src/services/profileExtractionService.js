// AI profile extraction.
//
// Takes free natural-language text the user typed about themselves and updates
// their structured profile — without erasing existing data.
//
// Rules (from the product spec):
//  1. Never overwrite existing fields with empty values.
//  2. Never erase user data (arrays are merged, not replaced).
//  3. If new info conflicts with an existing value, do NOT auto-apply it —
//     instead surface a short confirmation question.
//  4. If the data is clear and not conflicting, apply it automatically.
//  5. Report what changed in simple language.

const aiProvider = require('./aiProvider');
const UserProfile = require('../models/UserProfile');
const { readJsonArray, writeJsonArray } = require('../utils/jsonStore');

const PROFILES_FILE = 'userProfiles.json';
const MAX_PROFILE_TEXT_CHARS = 3000;
const PROFILE_OUTPUT_TOKEN_LIMIT = 700;

const STRING_FIELDS = [
  'country', 'city', 'profession', 'educationLevel',
  'businessType', 'businessStage', 'fundingNeeds', 'bio'
];
const ARRAY_FIELDS = ['skills', 'sectorInterests', 'preferredOpportunityTypes', 'portfolioLinks'];
const BOOLEAN_FIELDS = ['travelAvailable', 'passportAvailable', 'businessRegistered'];

function buildPrompt(text) {
  const safeText = trimForPrompt(text, MAX_PROFILE_TEXT_CHARS);
  return [
    'Extract only clearly stated profile data. Do not guess. Return JSON only; omit unknown fields.',
    'Fields: country, city, profession, educationLevel, skills[], businessType, businessStage, sectorInterests[], fundingNeeds, travelAvailable, passportAvailable, businessRegistered, preferredOpportunityTypes[], bio, portfolioLinks[].',
    'preferredOpportunityTypes values: grant, funding, exhibition, networking, fellowship, training, competition, tender, scholarship, internship, volunteering, startup_programme.',
    `Message: ${safeText}`
  ].join('\n');
}

function trimForPrompt(value, maxChars) {
  const text = String(value || '').trim();
  if (text.length <= maxChars) return text;
  return `${text.slice(0, maxChars).trim()} [truncated]`;
}

function isMeaningful(value) {
  if (value === null || value === undefined) return false;
  if (typeof value === 'string') return value.trim() !== '';
  if (Array.isArray(value)) return value.length > 0;
  return true;
}

async function loadProfileRecord(userId) {
  const profiles = (await readJsonArray(PROFILES_FILE)).map(p => new UserProfile(p));
  const index = profiles.findIndex(p => p.userId === userId);
  return { profiles, index };
}

// Merge extracted fields into the current profile following the rules above.
// Returns { applied, conflicts }.
function mergeExtraction(profile, extracted) {
  const applied = {};
  const conflicts = [];

  STRING_FIELDS.forEach(field => {
    const value = extracted[field];
    if (!isMeaningful(value)) return;
    const current = profile[field];
    const next = String(value).trim();
    if (!isMeaningful(current)) {
      profile[field] = next;
      applied[field] = next;
    } else if (String(current).trim().toLowerCase() !== next.toLowerCase()) {
      conflicts.push({ field, current: String(current).trim(), extracted: next });
    }
  });

  ARRAY_FIELDS.forEach(field => {
    const value = extracted[field];
    if (!Array.isArray(value) || value.length === 0) return;
    const current = Array.isArray(profile[field]) ? profile[field] : [];
    const lowerCurrent = current.map(v => String(v).toLowerCase());
    const additions = [];
    value.forEach(item => {
      const clean = String(item).trim();
      if (clean && !lowerCurrent.includes(clean.toLowerCase())) {
        additions.push(clean);
        lowerCurrent.push(clean.toLowerCase());
      }
    });
    if (additions.length) {
      profile[field] = [...current, ...additions];
      applied[field] = additions;
    }
  });

  BOOLEAN_FIELDS.forEach(field => {
    const value = extracted[field];
    if (typeof value !== 'boolean') return;
    // Booleans default to false in the model, so we can't reliably distinguish
    // "explicitly false" from "unset". We therefore apply a clearly-stated
    // boolean directly (it is authoritative for what the user just told us).
    if (profile[field] !== value) {
      profile[field] = value;
      applied[field] = value;
    }
  });

  return { applied, conflicts };
}

function humanFieldName(field) {
  return field
    .replace(/([A-Z])/g, ' $1')
    .replace(/^./, c => c.toUpperCase())
    .trim();
}

function describeApplied(applied) {
  const parts = [];
  Object.keys(applied).forEach(field => {
    const value = applied[field];
    const name = humanFieldName(field);
    if (Array.isArray(value)) {
      parts.push(`${name}: added ${value.join(', ')}`);
    } else if (typeof value === 'boolean') {
      parts.push(`${name}: ${value ? 'yes' : 'no'}`);
    } else {
      parts.push(`${name}: ${value}`);
    }
  });
  return parts;
}

async function extractAndUpdate(userId, text) {
  if (!aiProvider.isEnabled()) {
    return { aiUsed: false, error: aiProvider.disabledReason() };
  }

  const extracted = await aiProvider.write(buildPrompt(text), { expectJson: true, maxOutputTokens: PROFILE_OUTPUT_TOKEN_LIMIT });

  if (!extracted || typeof extracted !== 'object' || Array.isArray(extracted)) {
    return {
      aiUsed: true,
      applied: {},
      conflicts: [],
      updates: [],
      message: 'I could not confidently extract profile details from that. Try stating your country, profession and what you are looking for.'
    };
  }

  const { profiles, index } = await loadProfileRecord(userId);
  let profile;
  if (index === -1) {
    profile = new UserProfile({ userId });
    profiles.push(profile);
  } else {
    profile = profiles[index];
  }

  const { applied, conflicts } = mergeExtraction(profile, extracted);

  if (Object.keys(applied).length > 0) {
    profile.updatedAt = new Date().toISOString();
    const next = profiles.map(p => p.toObject());
    await writeJsonArray(PROFILES_FILE, next);
  }

  const updates = describeApplied(applied);

  let confirmationQuestion = null;
  if (conflicts.length) {
    const q = conflicts
      .map(c => `${humanFieldName(c.field)} is currently "${c.current}" — change it to "${c.extracted}"?`)
      .join(' ');
    confirmationQuestion = q;
  }

  let message;
  if (updates.length && confirmationQuestion) {
    message = `I updated your profile (${updates.join('; ')}). One thing to confirm: ${confirmationQuestion}`;
  } else if (updates.length) {
    message = `I updated your profile — ${updates.join('; ')}.`;
  } else if (confirmationQuestion) {
    message = `Before I change anything: ${confirmationQuestion}`;
  } else {
    message = 'Your profile already had this information, so nothing changed.';
  }

  return {
    aiUsed: true,
    applied,
    conflicts,
    updates,
    confirmationQuestion,
    message,
    profile: profile.toObject()
  };
}

module.exports = {
  extractAndUpdate
};
