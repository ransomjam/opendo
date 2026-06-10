const { readJsonArray, writeJsonArray } = require('../utils/jsonStore');
const Opportunity = require('../models/Opportunity');
const UserProfile = require('../models/UserProfile');
const UserDocument = require('../models/UserDocument');
const UserOpportunityMatch = require('../models/UserOpportunityMatch');
const ActionStep = require('../models/ActionStep');

const OPPORTUNITIES_FILE = 'opportunities.json';
const PROFILES_FILE = 'userProfiles.json';
const DOCUMENTS_FILE = 'userDocuments.json';
const MATCHES_FILE = 'userOpportunityMatches.json';
const ACTION_STEPS_FILE = 'actionSteps.json';

// Maps phrases that may appear in an opportunity's requiredDocuments text to the
// document type values used by UserDocument. Order matters: longer / more specific
// phrases are listed first so they win before generic fallbacks.
const DOCUMENT_MATCHERS = [
  { type: 'cv', label: 'CV / Resume', test: text => /\bcv\b/.test(text) || /resume/.test(text) },
  { type: 'business_registration', label: 'Business registration certificate', test: text => /business registration/.test(text) || /registration certificate/.test(text) },
  { type: 'pitch_deck', label: 'Pitch deck', test: text => /pitch deck/.test(text) },
  { type: 'passport', label: 'Passport', test: text => /passport/.test(text) },
  { type: 'recommendation_letter', label: 'Recommendation letter', test: text => /recommendation letter/.test(text) },
  { type: 'concept_note', label: 'Concept note', test: text => /concept note/.test(text) },
  { type: 'academic_transcript', label: 'Academic transcript', test: text => /academic transcript/.test(text) || /\btranscript\b/.test(text) },
  { type: 'tax_certificate', label: 'Tax certificate', test: text => /tax certificate/.test(text) },
  { type: 'portfolio', label: 'Portfolio', test: text => /portfolio/.test(text) },
  { type: 'budget', label: 'Budget', test: text => /budget/.test(text) }
];

async function loadOpportunities() {
  return (await readJsonArray(OPPORTUNITIES_FILE)).map(data => new Opportunity(data));
}

async function loadProfile(userId) {
  const profiles = (await readJsonArray(PROFILES_FILE)).map(data => new UserProfile(data));
  return profiles.find(profile => profile.userId === userId) || null;
}

async function loadDocuments(userId) {
  return (await readJsonArray(DOCUMENTS_FILE))
    .map(data => new UserDocument(data))
    .filter(doc => doc.userId === userId);
}

function lower(value) {
  return String(value || '').toLowerCase();
}

// Detect which document types are explicitly mentioned in requiredDocuments.
function detectRequiredDocuments(opportunity) {
  const text = lower(opportunity.requiredDocuments);
  if (!text.trim()) return [];

  const detected = [];
  DOCUMENT_MATCHERS.forEach(matcher => {
    if (matcher.test(text) && !detected.some(item => item.type === matcher.type)) {
      detected.push({ type: matcher.type, label: matcher.label });
    }
  });
  return detected;
}

function daysUntil(deadline) {
  if (!deadline) return null;
  const time = Date.parse(deadline);
  if (Number.isNaN(time)) return null;
  const diff = time - Date.now();
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
}

// ---- Individual score components ----

function scoreEligibility(profile, opportunity) {
  const reasons = [];
  const concerns = [];
  const eligibilityText = lower(opportunity.eligibility);
  const scopeText = `${lower(opportunity.countryScope)} ${lower(opportunity.location)}`;
  let score = 60; // neutral starting point — we are deliberately cautious

  if (!profile) {
    return {
      score: 40,
      status: 'unclear',
      reasons: [],
      concerns: ['Complete your profile so eligibility can be assessed.']
    };
  }

  const country = lower(profile.country);

  if (country && (eligibilityText.includes(country) || scopeText.includes(country))) {
    score += 20;
    reasons.push('Your country appears to match the eligibility or scope of this opportunity.');
  } else if (country && (scopeText.includes('global') || scopeText.includes('international') || scopeText.includes('worldwide') || (!opportunity.countryScope && !opportunity.location))) {
    score += 10;
    reasons.push('This opportunity appears to be open internationally.');
  } else if (country && opportunity.countryScope) {
    score -= 10;
    concerns.push('Your country may not be covered by this opportunity\'s scope — please confirm.');
  }

  if (eligibilityText.includes('registered business') || eligibilityText.includes('business registration') || eligibilityText.includes('registered company')) {
    if (profile.businessRegistered) {
      score += 10;
      reasons.push('You have a registered business, which this opportunity expects.');
    } else {
      score -= 15;
      concerns.push('This opportunity appears to require a registered business.');
    }
  }

  if ((eligibilityText.includes('travel') || eligibilityText.includes('in person') || eligibilityText.includes('in-person')) && !profile.travelAvailable) {
    score -= 5;
    concerns.push('Travel or in-person attendance may be required.');
  }

  if (profile.profession && eligibilityText.includes(lower(profile.profession))) {
    score += 10;
    reasons.push('Your profession is mentioned in the eligibility criteria.');
  }

  score = Math.max(0, Math.min(100, score));

  let status;
  if (score >= 80) status = 'likely_eligible';
  else if (score >= 60) status = 'possibly_eligible';
  else if (score >= 40) status = 'unclear';
  else status = 'not_eligible';

  return { score, status, reasons, concerns };
}

function scoreRelevance(profile, opportunity) {
  const reasons = [];
  const concerns = [];
  let score = 40;

  if (!profile) {
    return { score: 30, reasons: [], concerns: [] };
  }

  const category = lower(opportunity.category);
  const preferred = (profile.preferredOpportunityTypes || []).map(lower);
  const sectors = (profile.sectorInterests || []).map(lower);
  const skills = (profile.skills || []).map(lower);
  const haystack = [
    lower(opportunity.title),
    lower(opportunity.description),
    lower(opportunity.benefits),
    category
  ].join(' ');

  if (preferred.includes(category)) {
    score += 25;
    reasons.push('This opportunity type matches your preferred opportunity types.');
  }

  const sectorHit = sectors.find(sector => sector && haystack.includes(sector));
  if (sectorHit) {
    score += 20;
    reasons.push(`This relates to one of your sector interests (${sectorHit}).`);
  }

  const skillHit = skills.find(skill => skill && haystack.includes(skill));
  if (skillHit) {
    score += 10;
    reasons.push(`Your "${skillHit}" skill is relevant here.`);
  }

  if (profile.profession && haystack.includes(lower(profile.profession))) {
    score += 10;
    reasons.push('Your profession is relevant to this opportunity.');
  }

  if (score <= 40) {
    concerns.push('This opportunity is not a strong match for your stated interests.');
  }

  score = Math.max(0, Math.min(100, score));
  return { score, reasons, concerns };
}

function scoreReadiness(detectedDocuments, uploadedTypes) {
  const reasons = [];
  const concerns = [];

  const availableDocuments = [];
  const missingDocuments = [];

  detectedDocuments.forEach(doc => {
    if (uploadedTypes.includes(doc.type)) {
      availableDocuments.push(doc.label);
    } else {
      missingDocuments.push(doc.label);
    }
  });

  let score;
  if (detectedDocuments.length === 0) {
    // No specific documents requested — treat as broadly ready but not certain.
    score = 70;
    reasons.push('No specific documents were listed as required.');
  } else {
    score = Math.round((availableDocuments.length / detectedDocuments.length) * 100);
    if (availableDocuments.length > 0) {
      reasons.push(`You already have ${availableDocuments.length} of ${detectedDocuments.length} required document(s).`);
    }
    if (missingDocuments.length > 0) {
      concerns.push(`You are missing ${missingDocuments.length} required document(s).`);
    }
  }

  return { score, reasons, concerns, availableDocuments, missingDocuments };
}

function scoreUrgency(opportunity) {
  const reasons = [];
  const concerns = [];
  const days = daysUntil(opportunity.deadline);

  let score;
  if (days === null) {
    score = 40;
  } else if (days < 0) {
    score = 0;
    concerns.push('The deadline appears to have passed.');
  } else if (days <= 7) {
    score = 100;
    concerns.push(`The deadline is very soon (in ${days} day(s)).`);
  } else if (days <= 30) {
    score = 80;
    reasons.push(`You have about ${days} days until the deadline.`);
  } else if (days <= 90) {
    score = 60;
  } else {
    score = 40;
  }

  return { score, reasons, concerns, days };
}

function scoreValue(opportunity) {
  const reasons = [];
  const text = `${lower(opportunity.benefits)} ${lower(opportunity.fundingAmount)}`;
  let score = 50;

  if (opportunity.fundingAmount && String(opportunity.fundingAmount).trim()) {
    score += 25;
    reasons.push('This opportunity offers funding.');
  }
  if (text.includes('mentor') || text.includes('training') || text.includes('network')) {
    score += 15;
    reasons.push('This opportunity offers non-financial benefits (mentorship, training or networking).');
  }
  if (opportunity.benefits && String(opportunity.benefits).trim()) {
    score += 10;
  }

  score = Math.max(0, Math.min(100, score));
  return { score, reasons };
}

// Build the action steps for a given match (without persisting).
function buildActionSteps(opportunity, missingDocuments, urgency) {
  const steps = [];

  missingDocuments.forEach(label => {
    steps.push({
      title: `Prepare your ${label}`,
      description: `This opportunity lists "${label}" as a required document. Upload it to improve your readiness.`,
      priority: 'high'
    });
  });

  steps.push({
    title: 'Review eligibility requirements',
    description: 'Read the eligibility section carefully and confirm you qualify before applying.',
    priority: 'medium'
  });

  steps.push({
    title: 'Open the application link and confirm the deadline',
    description: opportunity.applicationLink
      ? `Visit ${opportunity.applicationLink} and verify the official requirements and deadline.`
      : 'Find the official application page and verify the requirements and deadline.',
    priority: 'medium'
  });

  let submitPriority = 'medium';
  if (urgency.days !== null && urgency.days >= 0 && urgency.days <= 7) submitPriority = 'urgent';
  else if (urgency.days !== null && urgency.days <= 30) submitPriority = 'high';

  steps.push({
    title: 'Submit before the deadline',
    description: opportunity.deadline
      ? `Make sure your application is submitted before ${opportunity.deadline}.`
      : 'Submit your application before the stated deadline.',
    priority: submitPriority
  });

  return steps;
}

// Compute a full match object (pure — no persistence, no AI).
function computeMatch(profile, documents, opportunity) {
  const uploadedTypes = documents.map(doc => doc.documentType);
  const detectedDocuments = detectRequiredDocuments(opportunity);

  const eligibility = scoreEligibility(profile, opportunity);
  const relevance = scoreRelevance(profile, opportunity);
  const readiness = scoreReadiness(detectedDocuments, uploadedTypes);
  const urgency = scoreUrgency(opportunity);
  const value = scoreValue(opportunity);

  const matchScore = Math.round(
    eligibility.score * 0.35 +
    relevance.score * 0.25 +
    readiness.score * 0.20 +
    urgency.score * 0.10 +
    value.score * 0.10
  );

  const matchReasons = [
    ...eligibility.reasons,
    ...relevance.reasons,
    ...readiness.reasons,
    ...urgency.reasons,
    ...value.reasons
  ];

  const possibleConcerns = [
    ...eligibility.concerns,
    ...relevance.concerns,
    ...readiness.concerns,
    ...urgency.concerns
  ];

  const actionStepDrafts = buildActionSteps(opportunity, readiness.missingDocuments, urgency);
  const recommendedNextSteps = actionStepDrafts.map(step => step.title);

  const match = new UserOpportunityMatch({
    userId: profile ? profile.userId : null,
    opportunityId: opportunity.id,
    matchScore,
    matchLevel: UserOpportunityMatch.levelForScore(matchScore),
    eligibilityStatus: eligibility.status,
    eligibilityScore: eligibility.score,
    relevanceScore: relevance.score,
    readinessScore: readiness.score,
    urgencyScore: urgency.score,
    valueScore: value.score,
    matchReasons,
    possibleConcerns,
    availableDocuments: readiness.availableDocuments,
    missingDocuments: readiness.missingDocuments,
    recommendedNextSteps,
    status: 'new'
  });

  return { match, actionStepDrafts };
}

// ---- Persistence helpers ----

async function readMatches() {
  return readJsonArray(MATCHES_FILE);
}

async function readActionSteps() {
  return readJsonArray(ACTION_STEPS_FILE);
}

// Persist (or refresh) action steps for one user + opportunity, avoiding duplicates
// (matched by title). Existing steps keep their status so user progress is preserved.
async function persistActionSteps(userId, opportunityId, drafts) {
  const all = await readActionSteps();
  const existing = all.filter(step => step.userId === userId && step.opportunityId === opportunityId);
  const others = all.filter(step => !(step.userId === userId && step.opportunityId === opportunityId));

  const kept = [];
  drafts.forEach(draft => {
    const previous = existing.find(step => step.title === draft.title);
    if (previous) {
      // Preserve user progress but refresh description/priority.
      previous.description = draft.description;
      previous.priority = draft.priority;
      previous.updatedAt = new Date().toISOString();
      kept.push(previous);
    } else {
      kept.push(new ActionStep({ userId, opportunityId, ...draft }).toObject());
    }
  });

  await writeJsonArray(ACTION_STEPS_FILE, [...others, ...kept]);
  return kept;
}

async function persistMatch(matchObject) {
  const all = await readMatches();
  const index = all.findIndex(
    item => item.userId === matchObject.userId && item.opportunityId === matchObject.opportunityId
  );

  if (index === -1) {
    all.push(matchObject);
  } else {
    // Preserve the user-chosen status and original id/createdAt.
    matchObject.id = all[index].id;
    matchObject.status = all[index].status;
    matchObject.createdAt = all[index].createdAt;
    all[index] = matchObject;
  }

  await writeJsonArray(MATCHES_FILE, all);
  return matchObject;
}

// Which opportunities should be matched for a given user.
//  - Globally published + public opportunities are matched for everyone.
//  - A user's OWN researched / private opportunities are matched only for them,
//    so they get value immediately without waiting for admin review.
function isMatchableForUser(opportunity, userId) {
  if (opportunity.status === 'published' && opportunity.visibility !== 'private') {
    return true;
  }
  if (userId && opportunity.createdByUserId === userId) {
    return ['personal_research', 'review', 'draft', 'published'].includes(opportunity.status);
  }
  return false;
}

async function recalculateForUser(userId, { enhance } = {}) {
  const profile = await loadProfile(userId);
  const documents = await loadDocuments(userId);
  const opportunities = (await loadOpportunities()).filter(opp => isMatchableForUser(opp, userId));

  const results = [];
  for (const opportunity of opportunities) {
    const { match, actionStepDrafts } = computeMatch(profile, documents, opportunity);
    match.userId = userId;

    if (enhance) {
      await maybeEnhance(match, profile, opportunity);
    }

    const stored = await persistMatch(match.toObject());
    await persistActionSteps(userId, opportunity.id, actionStepDrafts);
    results.push(stored);
  }

  return results;
}

async function matchOpportunityForUser(userId, opportunityId, { enhance } = {}) {
  const opportunity = (await loadOpportunities()).find(opp => opp.id === opportunityId);
  if (!opportunity) return null;

  const profile = await loadProfile(userId);
  const documents = await loadDocuments(userId);
  const { match, actionStepDrafts } = computeMatch(profile, documents, opportunity);
  match.userId = userId;

  if (enhance) {
    await maybeEnhance(match, profile, opportunity);
  }

  const stored = await persistMatch(match.toObject());
  await persistActionSteps(userId, opportunityId, actionStepDrafts);
  return stored;
}

// AI is optional. The rule-based result is always the source of truth; AI may only
// refine the narrative fields and silently falls back on any failure.
async function maybeEnhance(match, profile, opportunity) {
  try {
    const aiService = require('./aiService');
    if (!aiService.isEnabled()) return;
    const enhanced = await aiService.enhanceMatch({ match: match.toObject(), profile, opportunity });
    if (enhanced) {
      if (Array.isArray(enhanced.matchReasons) && enhanced.matchReasons.length) {
        match.matchReasons = enhanced.matchReasons;
      }
      if (Array.isArray(enhanced.possibleConcerns) && enhanced.possibleConcerns.length) {
        match.possibleConcerns = enhanced.possibleConcerns;
      }
      if (Array.isArray(enhanced.recommendedNextSteps) && enhanced.recommendedNextSteps.length) {
        match.recommendedNextSteps = enhanced.recommendedNextSteps;
      }
      match.aiEnhanced = true;
    }
  } catch (error) {
    // Silent fallback to rule-based result.
  }
}

async function getMatchesForUser(userId, filters = {}) {
  let matches = (await readMatches()).filter(match => match.userId === userId);

  if (filters.matchLevel) {
    matches = matches.filter(match => match.matchLevel === filters.matchLevel);
  }
  if (filters.status) {
    matches = matches.filter(match => match.status === filters.status);
  }
  if (filters.eligibilityStatus) {
    matches = matches.filter(match => match.eligibilityStatus === filters.eligibilityStatus);
  }
  if (filters.minScore !== undefined && filters.minScore !== '') {
    const min = Number(filters.minScore);
    if (!Number.isNaN(min)) {
      matches = matches.filter(match => match.matchScore >= min);
    }
  }

  return matches.sort((a, b) => b.matchScore - a.matchScore);
}

async function getMatchForOpportunity(userId, opportunityId) {
  return (await readMatches()).find(
    match => match.userId === userId && match.opportunityId === opportunityId
  ) || null;
}

async function updateMatchStatus(userId, matchId, status) {
  const all = await readMatches();
  const index = all.findIndex(match => match.id === matchId && match.userId === userId);
  if (index === -1) return { notFound: true };

  const match = new UserOpportunityMatch(all[index]);
  if (!match.updateStatus(status)) {
    return { invalidStatus: true };
  }

  all[index] = match.toObject();
  await writeJsonArray(MATCHES_FILE, all);
  return { match: all[index] };
}

module.exports = {
  DOCUMENT_MATCHERS,
  detectRequiredDocuments,
  computeMatch,
  recalculateForUser,
  matchOpportunityForUser,
  getMatchesForUser,
  getMatchForOpportunity,
  updateMatchStatus,
  daysUntil
};
