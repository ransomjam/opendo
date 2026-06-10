// Optional AI enhancement layer backed by the Gemini-only aiProvider.
//
// The rule-based match score remains the source of truth. AI may only improve
// narrative fields and must never change official opportunity facts.

const aiProvider = require('./aiProvider');
const MATCH_OUTPUT_TOKEN_LIMIT = 600;
const MAX_MATCH_FIELD_CHARS = 700;

function isEnabled() {
  return aiProvider.isEnabled();
}

function buildPrompt(match, profile, opportunity) {
  const safeProfile = profile
    ? {
        country: profile.country,
        profession: profile.profession,
        skills: profile.skills,
        sectorInterests: profile.sectorInterests,
        businessStage: profile.businessStage
      }
    : {};

  return [
    'Improve only matchReasons, possibleConcerns, recommendedNextSteps. Keep rule result true; do not invent eligibility, deadlines, links, or documents. Be concise. JSON only.',
    `Profile: ${JSON.stringify(safeProfile)}`,
    `Opp: ${JSON.stringify({
      title: opportunity.title,
      category: opportunity.category,
      eligibility: truncate(opportunity.eligibility),
      benefits: truncate(opportunity.benefits),
      deadline: opportunity.deadline
    })}`,
    `Rule: ${JSON.stringify({
      matchScore: match.matchScore,
      matchLevel: match.matchLevel,
      eligibilityStatus: match.eligibilityStatus,
      matchReasons: truncateArray(match.matchReasons),
      possibleConcerns: truncateArray(match.possibleConcerns),
      missingDocuments: match.missingDocuments,
      recommendedNextSteps: truncateArray(match.recommendedNextSteps)
    })}`
  ].join('\n');
}

function truncate(value, maxChars = MAX_MATCH_FIELD_CHARS) {
  const text = String(value || '').trim();
  if (text.length <= maxChars) return text;
  return `${text.slice(0, maxChars).trim()} [truncated]`;
}

function truncateArray(value) {
  return Array.isArray(value) ? value.map(item => truncate(item, 220)).slice(0, 5) : [];
}

async function enhanceMatch({ match, profile, opportunity }) {
  if (!isEnabled()) return null;

  const parsed = await aiProvider.write(buildPrompt(match, profile, opportunity), { expectJson: true, maxOutputTokens: MATCH_OUTPUT_TOKEN_LIMIT });
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return null;

  return {
    matchReasons: Array.isArray(parsed.matchReasons) ? parsed.matchReasons : undefined,
    possibleConcerns: Array.isArray(parsed.possibleConcerns) ? parsed.possibleConcerns : undefined,
    recommendedNextSteps: Array.isArray(parsed.recommendedNextSteps) ? parsed.recommendedNextSteps : undefined
  };
}

module.exports = {
  isEnabled,
  enhanceMatch
};
