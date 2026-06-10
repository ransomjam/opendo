const express = require('express');
const router = express.Router();
const { requireAuth } = require('../middleware/auth');
const matchingService = require('../services/matchingService');
const UserOpportunityMatch = require('../models/UserOpportunityMatch');

// GET /api/matches - list the current user's matches (with optional filters)
router.get('/', requireAuth, (req, res) => {
  try {
    const matches = matchingService.getMatchesForUser(req.user.id, {
      matchLevel: req.query.matchLevel,
      status: req.query.status,
      eligibilityStatus: req.query.eligibilityStatus,
      minScore: req.query.minScore
    });

    res.json({
      success: true,
      count: matches.length,
      data: matches
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error fetching matches', error: error.message });
  }
});

// POST /api/matches/recalculate - recompute all matches for the current user
router.post('/recalculate', requireAuth, async (req, res) => {
  try {
    const enhance = req.body && req.body.enhance === true;
    const matches = await matchingService.recalculateForUser(req.user.id, { enhance });

    res.json({
      success: true,
      message: 'Matches recalculated',
      count: matches.length,
      data: matches.sort((a, b) => b.matchScore - a.matchScore)
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error recalculating matches', error: error.message });
  }
});

// PATCH /api/matches/:matchId/status - update the status of one of the user's matches
router.patch('/:matchId/status', requireAuth, (req, res) => {
  try {
    const { status } = req.body || {};
    if (!status) {
      return res.status(400).json({ success: false, message: 'Status is required' });
    }

    const result = matchingService.updateMatchStatus(req.user.id, req.params.matchId, status);

    if (result.notFound) {
      return res.status(404).json({ success: false, message: 'Match not found' });
    }
    if (result.invalidStatus) {
      return res.status(400).json({
        success: false,
        message: `Status must be one of: ${UserOpportunityMatch.getStatuses().join(', ')}`
      });
    }

    res.json({ success: true, message: 'Match status updated', data: result.match });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error updating match status', error: error.message });
  }
});

// GET /api/matches/:opportunityId - get a single match for the current user
router.get('/:opportunityId', requireAuth, (req, res) => {
  try {
    const match = matchingService.getMatchForOpportunity(req.user.id, req.params.opportunityId);
    if (!match) {
      return res.status(404).json({
        success: false,
        message: 'No match found for this opportunity. Try recalculating matches.'
      });
    }
    res.json({ success: true, data: match });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error fetching match', error: error.message });
  }
});

module.exports = router;
