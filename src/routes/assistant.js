const express = require('express');
const router = express.Router();
const { requireAuth, optionalAuth } = require('../middleware/auth');
const assistantService = require('../services/assistantService');
const aiProvider = require('../services/aiProvider');

// POST /api/assistant/chat
// Body: { message: string, mode?: 'auto'|'profile'|'research'|'opportunity'|'matching'|'action_plan' }
router.post('/chat', requireAuth, async (req, res) => {
  try {
    const { message, mode } = req.body || {};

    if (!message || !String(message).trim()) {
      return res.status(400).json({ success: false, message: 'Please type a message.' });
    }

    const result = await assistantService.chat({
      userId: req.user.id,
      message: String(message),
      mode: mode || 'auto'
    });

    res.json(result);
  } catch (error) {
    res.status(500).json({ success: false, message: 'Assistant error', error: error.message });
  }
});

// GET /api/assistant/status - lets the UI know if AI is available
router.get('/status', optionalAuth, (req, res) => {
  res.json({
    success: true,
    aiEnabled: aiProvider.isEnabled(),
    reason: aiProvider.disabledReason(),
    providers: { gemini: aiProvider.hasGemini() },
    modes: assistantService.VALID_MODES
  });
});

module.exports = router;
