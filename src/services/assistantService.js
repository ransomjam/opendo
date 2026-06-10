// The Opendo AI assistant.
//
// One endpoint (POST /api/assistant/chat) that lets a user type naturally and
// have the app do the right thing: update their profile, research real
// opportunities online, save a pasted opportunity, show their best matches, or
// build a "what should I do today" plan.
//
// Intent detection is rule-based and cheap (works even with AI off). The heavy
// lifting (research, extraction, profile parsing) delegates to the AI services,
// each of which already degrades gracefully when AI is disabled.

const aiProvider = require('./aiProvider');
const researchService = require('./researchService');
const profileExtractionService = require('./profileExtractionService');
const matchingService = require('./matchingService');
const Opportunity = require('../models/Opportunity');
const { readJsonArray } = require('../utils/jsonStore');

const OPPORTUNITIES_FILE = 'opportunities.json';
const ACTION_STEPS_FILE = 'actionSteps.json';

const MODE_TO_INTENT = {
  profile: 'update_profile',
  research: 'research_opportunities',
  opportunity: 'add_opportunity',
  matching: 'find_matches',
  action_plan: 'action_plan'
};

const VALID_MODES = ['auto', 'profile', 'research', 'opportunity', 'matching', 'action_plan'];

function has(text, ...phrases) {
  return phrases.some(p => text.includes(p));
}

// Best-effort intent detection from the message.
function detectIntent(message) {
  const text = String(message || '').toLowerCase();
  const wordCount = text.trim().split(/\s+/).filter(Boolean).length;

  if (!text.trim()) return 'unclear';

  // "What should I do today / this week / next" -> action plan
  if (has(text, 'what should i do', 'what do i do', 'do today', 'do this week', 'my plan', "what's next", 'what is next', 'priorities today', 'to-do', 'to do today')) {
    return 'action_plan';
  }

  // "What fits me / show my matches"
  if (has(text, 'what opportunities fit', 'what fits me', 'fit me best', 'best match', 'my matches', 'show matches', 'which opportunities suit', 'what suits me')) {
    return 'find_matches';
  }

  // Pasted opportunity (a call/announcement to save)
  if (has(text, 'applications are open', 'application is open', 'call for', 'apply by', 'deadline to apply', 'now accepting applications', 'is inviting applications', 'request for proposals')) {
    return 'add_opportunity';
  }

  // Research: find/search verbs combined with opportunity nouns
  const findVerb = has(text, 'find', 'search', 'look for', 'looking for', 'show me', 'get me', 'discover', 'list', 'recommend');
  const oppNoun = has(text, 'grant', 'fund', 'opportunit', 'exhibition', 'expo', 'networking', 'fellowship', 'scholarship', 'competition', 'accelerator', 'incubator', 'training', 'tender', 'event', 'programme', 'program');
  if (findVerb && oppNoun) {
    return 'research_opportunities';
  }

  // Profile self-description
  if (has(text, 'i am ', "i'm ", 'i am a', 'i run', 'i have a', 'i have an', 'based in', 'my business', 'my startup', 'update my profile', 'about myself', 'my profile', 'i work', 'i live in', 'my company', 'my passport', 'my cv')) {
    return 'update_profile';
  }

  // A long pasted block is most likely an opportunity to save.
  if (wordCount > 45) {
    return 'add_opportunity';
  }

  // A short question.
  if (text.includes('?') || has(text, 'how', 'what', 'can you', 'help', 'explain')) {
    return 'general_question';
  }

  return 'unclear';
}

async function loadOpportunityMap() {
  const map = new Map();
  (await readJsonArray(OPPORTUNITIES_FILE)).forEach(data => {
    const opp = new Opportunity(data);
    map.set(opp.id, opp.toObject());
  });
  return map;
}

// Join matches with their opportunity details into card-shaped results.
async function shapeMatches(userId) {
  const oppMap = await loadOpportunityMap();
  const matches = await matchingService.getMatchesForUser(userId);
  return matches
    .map(match => {
      const opp = oppMap.get(match.opportunityId);
      if (!opp) return null;
      return {
        ...opp,
        match: {
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
      };
    })
    .filter(Boolean);
}

// ---- "What should I do today?" ---------------------------------------------

async function buildTodayPlan(userId) {
  const oppMap = await loadOpportunityMap();
  const matches = await matchingService.getMatchesForUser(userId); // sorted by score desc
  const actionSteps = (await readJsonArray(ACTION_STEPS_FILE)).filter(s => s.userId === userId);

  // Ignore matches the user explicitly set aside.
  const active = matches.filter(m => m.status !== 'ignored' && m.status !== 'submitted');

  if (!active.length) {
    return {
      hasPlan: false,
      message: 'You have no active matches yet. Tell me what you are looking for (e.g. "find grants for my tech startup in Cameroon") and I will research opportunities for you.'
    };
  }

  // Pick the focus: prefer the strongest match whose deadline is closest.
  const withDays = active.map(m => {
    const opp = oppMap.get(m.opportunityId) || {};
    const days = matchingService.daysUntil(opp.deadline);
    return { match: m, opp, days };
  });

  // Sort: soonest valid deadline first, then highest score.
  const focus = [...withDays].sort((a, b) => {
    const ad = a.days === null ? Infinity : (a.days < 0 ? Infinity : a.days);
    const bd = b.days === null ? Infinity : (b.days < 0 ? Infinity : b.days);
    if (ad !== bd) return ad - bd;
    return b.match.matchScore - a.match.matchScore;
  })[0];

  const focusSteps = actionSteps.filter(
    s => s.opportunityId === focus.match.opportunityId && (s.status === 'not_started' || s.status === 'in_progress')
  );

  const urgentDeadlines = withDays
    .filter(x => x.days !== null && x.days >= 0 && x.days <= 14)
    .sort((a, b) => a.days - b.days)
    .map(x => ({ title: x.opp.title, deadline: x.opp.deadline, days: x.days, applicationLink: x.opp.applicationLink || x.opp.sourceUrl || '' }));

  const doToday = focusSteps
    .filter(s => s.priority === 'urgent' || s.priority === 'high')
    .map(s => s.title);
  // Ensure there is always something to do today.
  if (!doToday.length) {
    doToday.push(...(focus.match.recommendedNextSteps || []).slice(0, 3));
  }
  const doThisWeek = focusSteps
    .filter(s => s.priority === 'medium' || s.priority === 'low')
    .map(s => s.title);

  const reasonBits = [];
  reasonBits.push(`it is one of your strongest matches (score ${focus.match.matchScore})`);
  if (focus.days !== null && focus.days >= 0) {
    reasonBits.push(`the deadline is ${focus.days === 0 ? 'today' : `in ${focus.days} day(s)`}`);
  }

  return {
    hasPlan: true,
    focus: {
      title: focus.opp.title,
      organisation: focus.opp.organisation,
      deadline: focus.opp.deadline,
      days: focus.days,
      matchScore: focus.match.matchScore,
      applicationLink: focus.opp.applicationLink || focus.opp.sourceUrl || '',
      sourceUrl: focus.opp.sourceUrl || ''
    },
    why: reasonBits.join(' and '),
    doToday,
    doThisWeek,
    missingDocuments: focus.match.missingDocuments || [],
    urgentDeadlines
  };
}

function renderTodayMessage(plan) {
  if (!plan.hasPlan) return plan.message;
  const lines = [];
  lines.push(`Today, focus on ${plan.focus.title}${plan.focus.organisation ? ` (${plan.focus.organisation})` : ''}.`);
  lines.push('');
  lines.push(`Why: ${plan.why}.`);
  if (plan.doToday.length) {
    lines.push('');
    lines.push('Do today:');
    plan.doToday.forEach((s, i) => lines.push(`${i + 1}. ${s}`));
  }
  if (plan.missingDocuments.length) {
    lines.push('');
    lines.push('Missing documents:');
    plan.missingDocuments.forEach(d => lines.push(`- ${d}`));
  }
  if (plan.focus.applicationLink) {
    lines.push('');
    lines.push(`Application link: ${plan.focus.applicationLink}`);
  }
  return lines.join('\n');
}

// ---- General question -------------------------------------------------------

async function answerGeneral(message) {
  if (aiProvider.isEnabled()) {
    const prompt = [
      'You are Opendo, a friendly assistant that helps people in Africa find and apply to',
      'opportunities (grants, funding, exhibitions, networking, fellowships, scholarships).',
      'Answer the user briefly and practically. If they should use a feature, tell them they can:',
      'type what they are looking for to research opportunities, paste an opportunity to save it,',
      'paste info about themselves to update their profile, or ask "what should I do today?".',
      '',
      `User: ${message}`
    ].join('\n');
    const text = await aiProvider.write(prompt, { expectJson: false });
    if (text) return text;
  }
  return [
    'I can help you find and organise opportunities. Try one of these:',
    '- "Find grants for my tech startup in Cameroon" (I research real opportunities)',
    '- Paste a few lines about yourself to update your profile',
    '- Paste an opportunity announcement to save it',
    '- Ask "What opportunities fit me best?" or "What should I do today?"'
  ].join('\n');
}

// ---- Main entry -------------------------------------------------------------

async function chat({ userId, message, mode }) {
  const safeMode = VALID_MODES.includes(mode) ? mode : 'auto';
  const intent = safeMode === 'auto' ? detectIntent(message) : (MODE_TO_INTENT[safeMode] || 'general_question');

  const base = { success: true, mode: safeMode, intent };

  switch (intent) {
    case 'update_profile': {
      const result = await profileExtractionService.extractAndUpdate(userId, message);
      if (result.error) {
        return { ...base, success: false, message: result.error };
      }
      return {
        ...base,
        message: result.message,
        profile: result.profile,
        updates: result.updates,
        conflicts: result.conflicts,
        confirmationQuestion: result.confirmationQuestion || null
      };
    }

    case 'research_opportunities': {
      const result = await researchService.researchOpportunities(userId, { query: message });
      return { ...base, ...result };
    }

    case 'add_opportunity': {
      const result = await researchService.extractFromText(userId, message);
      return { ...base, ...result };
    }

    case 'find_matches': {
      try {
        await matchingService.recalculateForUser(userId, { enhance: false });
      } catch (_) {
        // matching still returns whatever is stored
      }
      const matches = await shapeMatches(userId);
      const top = matches[0];
      const message = matches.length
        ? `You have ${matches.length} match${matches.length === 1 ? '' : 'es'}.${top ? ` Your best fit is "${top.title}" (${top.match.matchScore}%).` : ''}`
        : 'You have no matches yet. Try "find grants for my business" so I can research opportunities, or complete your profile.';
      return { ...base, message, opportunities: matches };
    }

    case 'action_plan': {
      const plan = await buildTodayPlan(userId);
      return { ...base, message: renderTodayMessage(plan), plan };
    }

    case 'general_question': {
      const answer = await answerGeneral(message);
      return { ...base, message: answer };
    }

    default:
      return {
        ...base,
        message: 'I\'m not sure what you need. You can: research opportunities ("find grants for my startup"), update your profile (describe yourself), paste an opportunity to save it, ask "what fits me best?", or ask "what should I do today?".'
      };
  }
}

module.exports = {
  chat,
  detectIntent,
  buildTodayPlan,
  VALID_MODES
};
