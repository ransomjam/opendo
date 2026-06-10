// Online opportunity research + pasted-opportunity extraction.
//
// Flow:
//   1. Ask Gemini with Google Search grounding to find
//      real opportunities and return structured JSON with REAL source links.
//   2. Drop anything without a usable link (research must be verifiable).
//   3. Deduplicate against existing opportunities.
//   4. Save each as a private "personal_research" opportunity owned by the user.
//   5. Match it to the user with the existing rule-based matchingService.
//
// Guardrails honoured here:
//   - We never invent a deadline (missing -> null).
//   - We never invent an application link (missing -> fall back to source link).
//   - Research results without any link are excluded.
//   - Nothing is auto-published globally; everything is private to the user.

const aiProvider = require('./aiProvider');
const matchingService = require('./matchingService');
const Opportunity = require('../models/Opportunity');
const { readJsonArray, writeJsonArray } = require('../utils/jsonStore');

const OPPORTUNITIES_FILE = 'opportunities.json';
const DEFAULT_RESEARCH_LIMIT = 4;
const MAX_RESEARCH_LIMIT = 4;
const MAX_RESEARCH_QUERY_CHARS = 500;
const MAX_PASTED_OPPORTUNITY_CHARS = 6000;
const RESEARCH_OUTPUT_TOKEN_LIMIT = 2200;
const EXTRACTION_OUTPUT_TOKEN_LIMIT = 1200;

const CATEGORY_SYNONYMS = {
  grant: 'grant',
  grants: 'grant',
  funding: 'funding',
  fund: 'funding',
  investment: 'funding',
  loan: 'funding',
  exhibition: 'exhibition',
  expo: 'exhibition',
  fair: 'exhibition',
  tradeshow: 'exhibition',
  networking: 'networking',
  network: 'networking',
  conference: 'networking',
  summit: 'networking',
  meetup: 'networking',
  fellowship: 'fellowship',
  training: 'training',
  course: 'training',
  bootcamp: 'training',
  workshop: 'training',
  competition: 'competition',
  challenge: 'competition',
  hackathon: 'competition',
  award: 'competition',
  prize: 'competition',
  pitch: 'competition',
  tender: 'tender',
  procurement: 'tender',
  scholarship: 'scholarship',
  startup_programme: 'startup_programme',
  'startup program': 'startup_programme',
  accelerator: 'startup_programme',
  incubator: 'startup_programme',
  programme: 'startup_programme',
  program: 'startup_programme'
};

function normaliseCategory(value) {
  const key = String(value || '').trim().toLowerCase();
  if (!key) return 'other';
  if (Opportunity.getCategories().includes(key)) return key;
  if (CATEGORY_SYNONYMS[key]) return CATEGORY_SYNONYMS[key];
  // try loose contains match
  const hit = Object.keys(CATEGORY_SYNONYMS).find(k => key.includes(k));
  return hit ? CATEGORY_SYNONYMS[hit] : 'other';
}

function cleanUrl(value) {
  const v = String(value || '').trim();
  if (!v) return '';
  return Opportunity.isValidUrl(v) ? v : '';
}

function cleanDeadline(value) {
  if (value === null || value === undefined) return null;
  const v = String(value).trim();
  if (!v || /^(n\/?a|none|unknown|null|tbd|tba)$/i.test(v)) return null;
  // Keep ISO-like dates; otherwise keep the raw string only if it parses.
  if (Number.isNaN(Date.parse(v))) return v; // keep descriptive text as-is
  return v;
}

function asText(value) {
  if (value === null || value === undefined) return '';
  if (Array.isArray(value)) return value.join(', ');
  return String(value).trim();
}

function trimForPrompt(value, maxChars) {
  const text = String(value || '').trim();
  if (text.length <= maxChars) return text;
  return `${text.slice(0, maxChars).trim()} [truncated]`;
}

function buildResearchPrompt(query, limit) {
  const safeQuery = trimForPrompt(query, MAX_RESEARCH_QUERY_CHARS);
  return [
    `Find up to ${limit} real, current opportunities matching the request. Use web search.`,
    'Rules: sourceUrl is required; prefer official pages; do not invent deadlines or links; use null/"" when unknown; keep text concise.',
    'Return JSON only: {"opportunities":[{"title":"","organisation":"","category":"one of grant,funding,exhibition,networking,fellowship,training,competition,tender,scholarship,startup_programme,other","description":"1-2 short sentences","countryScope":"","location":"","deadline":null,"fundingAmount":"","benefits":"","eligibility":"","requiredDocuments":"","applicationSteps":"","applicationLink":null,"sourceUrl":""}]}',
    `Request: ${safeQuery}`
  ].join('\n');
}

function buildExtractionPrompt(text) {
  const safeText = trimForPrompt(text, MAX_PASTED_OPPORTUNITY_CHARS);
  return [
    'Extract one opportunity. Do not invent missing deadlines or links; only use URLs present in the text.',
    'Return JSON only: {"title":"","organisation":"","category":"one of grant,funding,exhibition,networking,fellowship,training,competition,tender,scholarship,startup_programme,other","description":"","countryScope":"","location":"","deadline":null,"fundingAmount":"","benefits":"","eligibility":"","requiredDocuments":"","applicationSteps":"","applicationLink":null,"sourceUrl":null}',
    `Text: ${safeText}`
  ].join('\n');
}

async function loadOpportunities() {
  return (await readJsonArray(OPPORTUNITIES_FILE)).map(data => new Opportunity(data));
}

async function saveOpportunities(opportunities) {
  await writeJsonArray(OPPORTUNITIES_FILE, opportunities.map(opp => opp.toObject()));
}

// Find an existing opportunity that matches by source link, application link,
// or title + organisation (case-insensitive).
function findDuplicate(opportunities, candidate) {
  const src = candidate.sourceUrl && candidate.sourceUrl.toLowerCase();
  const app = candidate.applicationLink && candidate.applicationLink.toLowerCase();
  const titleOrg = `${candidate.title}|${candidate.organisation}`.toLowerCase();

  return opportunities.find(opp => {
    if (src && opp.sourceUrl && opp.sourceUrl.toLowerCase() === src) return true;
    if (app && opp.applicationLink && opp.applicationLink.toLowerCase() === app) return true;
    const oppTitleOrg = `${opp.title}|${opp.organisation}`.toLowerCase();
    return candidate.title && candidate.organisation && oppTitleOrg === titleOrg;
  }) || null;
}

// Fill blank fields on an existing record from a candidate, without weakening it.
// Never overwrites a published opportunity's status or existing non-empty fields.
function enrichExisting(existing, candidate) {
  let changed = false;
  const fillable = [
    'description', 'countryScope', 'location', 'deadline', 'fundingAmount',
    'benefits', 'eligibility', 'requiredDocuments', 'applicationSteps',
    'applicationLink', 'sourceUrl'
  ];
  fillable.forEach(field => {
    const current = existing[field];
    const incoming = candidate[field];
    const currentBlank = current === null || current === undefined || String(current).trim() === '';
    const incomingPresent = incoming !== null && incoming !== undefined && String(incoming).trim() !== '';
    if (currentBlank && incomingPresent) {
      existing[field] = incoming;
      changed = true;
    }
  });
  if (changed) {
    existing.updatedAt = new Date().toISOString();
  }
  return changed;
}

// Turn one raw AI object into a normalised candidate. Returns null if it has no
// usable link (research results must be verifiable).
function normaliseCandidate(raw, { requireLink }) {
  if (!raw || typeof raw !== 'object') return null;

  const sourceUrl = cleanUrl(raw.sourceUrl);
  let applicationLink = cleanUrl(raw.applicationLink);

  // If there's no application link but there is a source link, use the source.
  if (!applicationLink && sourceUrl) applicationLink = sourceUrl;
  const finalSource = sourceUrl || applicationLink;

  if (requireLink && !finalSource) return null;

  return {
    title: asText(raw.title),
    organisation: asText(raw.organisation),
    category: normaliseCategory(raw.category),
    description: asText(raw.description),
    countryScope: asText(raw.countryScope),
    location: asText(raw.location),
    deadline: cleanDeadline(raw.deadline),
    fundingAmount: asText(raw.fundingAmount),
    benefits: asText(raw.benefits),
    eligibility: asText(raw.eligibility),
    requiredDocuments: asText(raw.requiredDocuments),
    applicationSteps: asText(raw.applicationSteps),
    applicationLink: applicationLink || '',
    sourceUrl: finalSource || ''
  };
}

// Shape a saved opportunity + its stored match into the response card format.
function shapeResult(opportunity, match) {
  const obj = opportunity.toObject ? opportunity.toObject() : opportunity;
  return {
    ...obj,
    match: match
      ? {
          matchId: match.id,
          matchScore: match.matchScore,
          matchLevel: match.matchLevel,
          eligibilityStatus: match.eligibilityStatus,
          missingDocuments: match.missingDocuments || [],
          availableDocuments: match.availableDocuments || [],
          recommendedNextSteps: match.recommendedNextSteps || [],
          possibleConcerns: match.possibleConcerns || [],
          status: match.status
        }
      : null
  };
}

// Persist one candidate (dedup-aware) and match it to the user.
async function saveAndMatch(candidate, userId, { matchResults, citations }) {
  const opportunities = await loadOpportunities();
  const duplicate = findDuplicate(opportunities, candidate);

  let opportunity;
  if (duplicate) {
    // Keep published records authoritative — only fill blanks.
    enrichExisting(duplicate, candidate);
    opportunity = duplicate;
    await saveOpportunities(opportunities);
  } else {
    opportunity = new Opportunity({
      ...candidate,
      status: 'personal_research',
      visibility: 'private',
      riskLevel: 'unverified',
      createdByUserId: userId,
      sourceCitations: Array.isArray(citations) ? citations : []
    });
    opportunities.push(opportunity);
    await saveOpportunities(opportunities);
  }

  let match = null;
  if (matchResults) {
    try {
      match = await matchingService.matchOpportunityForUser(userId, opportunity.id, { enhance: false });
    } catch (_) {
      match = null;
    }
  }

  return shapeResult(opportunity, match);
}

function envFlag(name, fallback) {
  const value = process.env[name];
  if (value === undefined || value === '') return fallback;
  return String(value).toLowerCase() === 'true';
}

// ---- Public API -------------------------------------------------------------

async function researchOpportunities(userId, options = {}) {
  const query = (options.query || '').trim();
  const requestedLimit = Number(options.limit);
  const limit = Math.max(
    1,
    Math.min(Number.isFinite(requestedLimit) && requestedLimit > 0 ? requestedLimit : DEFAULT_RESEARCH_LIMIT, MAX_RESEARCH_LIMIT)
  );
  const saveResults = options.saveResults !== undefined ? options.saveResults : envFlag('AUTO_SAVE_RESEARCH_RESULTS', true);
  const matchResults = options.matchResults !== undefined ? options.matchResults : envFlag('AUTO_MATCH_RESEARCH_RESULTS', true);

  if (!query) {
    return { success: false, message: 'Please describe what opportunities you are looking for.' };
  }

  if (!aiProvider.isEnabled()) {
    return {
      success: false,
      message: 'AI research is not configured. Add GEMINI_API_KEY in .env.'
    };
  }

  const result = await aiProvider.research(buildResearchPrompt(query, limit), { maxOutputTokens: RESEARCH_OUTPUT_TOKEN_LIMIT });
  if (result.error) {
    return { success: false, message: result.error };
  }

  const parsed = aiProvider.parseJsonLoose(result.text);
  const rawList = Array.isArray(parsed)
    ? parsed
    : (parsed && Array.isArray(parsed.opportunities) ? parsed.opportunities : []);

  const candidates = rawList
    .map(raw => normaliseCandidate(raw, { requireLink: true }))
    .filter(Boolean)
    .filter(c => c.title) // need at least a title
    .slice(0, limit);

  if (!candidates.length) {
    return {
      success: true,
      provider: result.provider,
      query,
      opportunities: [],
      message: 'I searched but could not find opportunities with verifiable links for that request. Try rephrasing or adding your country and sector.'
    };
  }

  const opportunities = [];
  if (saveResults) {
    for (const candidate of candidates) {
      // Citations are about the whole search; attach the same set to each saved item.
      const shaped = await saveAndMatch(candidate, userId, { matchResults, citations: result.citations });
      opportunities.push(shaped);
    }
  } else {
    candidates.forEach(c => opportunities.push(shapeResult(c, null)));
  }

  return {
    success: true,
    provider: result.provider,
    query,
    opportunities,
    message: `I found and matched ${opportunities.length} opportunit${opportunities.length === 1 ? 'y' : 'ies'} for you.`
  };
}

async function extractFromText(userId, text, options = {}) {
  const matchResults = options.matchResults !== undefined ? options.matchResults : true;

  if (!text || !text.trim()) {
    return { success: false, message: 'Please paste the opportunity text.' };
  }

  if (!aiProvider.isEnabled()) {
    return {
      success: false,
      message: 'AI extraction is not configured. Add GEMINI_API_KEY in .env.'
    };
  }

  const parsed = await aiProvider.write(buildExtractionPrompt(text), { expectJson: true, maxOutputTokens: EXTRACTION_OUTPUT_TOKEN_LIMIT });
  // A pasted opportunity is allowed even without a link (kept as a private note),
  // but we still mark it unverified.
  const candidate = normaliseCandidate(parsed, { requireLink: false });

  if (!candidate || !candidate.title) {
    return {
      success: false,
      message: 'I could not extract a clear opportunity from that text. Make sure it includes a title and details.'
    };
  }

  const shaped = await saveAndMatch(candidate, userId, { matchResults, citations: [] });

  return {
    success: true,
    opportunity: shaped,
    message: `Saved "${candidate.title}" to your private opportunities and matched it to your profile.`
  };
}

module.exports = {
  researchOpportunities,
  extractFromText,
  normaliseCategory
};
