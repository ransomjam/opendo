const express = require('express');
const router = express.Router();
const { requireAuth } = require('../middleware/auth');
const researchService = require('../services/researchService');

// POST /api/research/opportunities
// Body: { query, saveResults=true, matchResults=true, limit=10 }
router.post('/opportunities', requireAuth, async (req, res) => {
  try {
    const { query, saveResults, matchResults, limit } = req.body || {};

    const result = await researchService.researchOpportunities(req.user.id, {
      query,
      saveResults,
      matchResults,
      limit
    });

    // Failures here are user/config issues (e.g. AI not configured), surfaced in
    // the body with success:false — the request itself succeeded.
    res.json(result);
  } catch (error) {
    res.status(500).json({ success: false, message: 'Research error', error: error.message });
  }
});

// POST /api/research/extract
// Body: { text, matchResults=true }  — extract a single pasted opportunity.
router.post('/extract', requireAuth, async (req, res) => {
  try {
    const { text, matchResults } = req.body || {};
    const result = await researchService.extractFromText(req.user.id, text, { matchResults });
    res.json(result);
  } catch (error) {
    res.status(500).json({ success: false, message: 'Extraction error', error: error.message });
  }
});

module.exports = router;
