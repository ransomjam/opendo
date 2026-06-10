const express = require('express');
const router = express.Router();
const { requireAuth } = require('../middleware/auth');
const { readJsonArray } = require('../utils/jsonStore');
const matchingService = require('../services/matchingService');
const Opportunity = require('../models/Opportunity');

const OPPORTUNITIES_FILE = 'opportunities.json';
const ACTION_STEPS_FILE = 'actionSteps.json';

// GET /api/dashboard/summary - high level numbers for the current user
router.get('/summary', requireAuth, async (req, res) => {
  try {
    const userId = req.user.id;
    const matches = await matchingService.getMatchesForUser(userId);
    const actionSteps = (await readJsonArray(ACTION_STEPS_FILE)).filter(step => step.userId === userId);
    const opportunities = (await readJsonArray(OPPORTUNITIES_FILE)).map(data => new Opportunity(data));
    const opportunityById = new Map(opportunities.map(opp => [opp.id, opp]));

    let deadlinesThisWeek = 0;
    let missingDocumentsCount = 0;

    matches.forEach(match => {
      missingDocumentsCount += (match.missingDocuments || []).length;
      const opportunity = opportunityById.get(match.opportunityId);
      if (opportunity) {
        const days = matchingService.daysUntil(opportunity.deadline);
        if (days !== null && days >= 0 && days <= 7) {
          deadlinesThisWeek += 1;
        }
      }
    });

    const summary = {
      totalMatches: matches.length,
      excellentFits: matches.filter(match => match.matchLevel === 'excellent_fit').length,
      strongFits: matches.filter(match => match.matchLevel === 'strong_fit').length,
      deadlinesThisWeek,
      missingDocumentsCount,
      pendingActionSteps: actionSteps.filter(
        step => step.status === 'not_started' || step.status === 'in_progress'
      ).length,
      savedOpportunities: matches.filter(match => match.status === 'saved').length,
      interestedOpportunities: matches.filter(match => match.status === 'interested').length
    };

    res.json({ success: true, summary });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error building dashboard summary', error: error.message });
  }
});

module.exports = router;
