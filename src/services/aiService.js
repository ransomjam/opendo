// Optional AI enhancement layer backed by the Gemini-only aiProvider.
//
// The rule-based match score remains the source of truth. AI may only improve
// narrative fields and must never change official opportunity facts.

const aiProvider = require('./aiProvider');

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
    'You are an assistant that helps a user understand an opportunity match.',
    'You are given a rule-based match result that is the source of truth.',
    'Rewrite and improve ONLY these fields: matchReasons, possibleConcerns, recommendedNextSteps.',
    'Constraints:',
    '- Do NOT say the user is guaranteed eligible.',
    '- Do NOT invent or change the deadline, application link, or required documents.',
    '- Be concise, practical and honest about uncertainty.',
    '- Respond ONLY with valid JSON of the shape:',
    '  {"matchReasons": [string], "possibleConcerns": [string], "recommendedNextSteps": [string]}',
    '',
    `User profile: ${JSON.stringify(safeProfile)}`,
    `Opportunity: ${JSON.stringify({
      title: opportunity.title,
      category: opportunity.category,
      eligibility: opportunity.eligibility,
      benefits: opportunity.benefits,
      deadline: opportunity.deadline
    })}`,
    `Rule-based result: ${JSON.stringify({
      matchScore: match.matchScore,
      matchLevel: match.matchLevel,
      eligibilityStatus: match.eligibilityStatus,
      matchReasons: match.matchReasons,
      possibleConcerns: match.possibleConcerns,
      missingDocuments: match.missingDocuments,
      recommendedNextSteps: match.recommendedNextSteps
    })}`
  ].join('\n');
}

async function enhanceMatch({ match, profile, opportunity }) {
  if (!isEnabled()) return null;

  const parsed = await aiProvider.write(buildPrompt(match, profile, opportunity), { expectJson: true });
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
