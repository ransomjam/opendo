const express = require('express');
const { requireAuth } = require('../middleware/auth');
const applicationWorkspaceService = require('../services/applicationWorkspaceService');

const router = express.Router();

router.get('/', requireAuth, async (req, res) => {
  try {
    const workspace = await applicationWorkspaceService.getWorkspace(req.user.id);
    res.json(workspace);
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error building application workspace',
      error: error.message
    });
  }
});

router.put('/:opportunityId/note', requireAuth, async (req, res) => {
  try {
    const content = String((req.body && req.body.content) || '').slice(0, 5000);
    const note = await applicationWorkspaceService.saveNote(req.user.id, req.params.opportunityId, content);
    res.json({
      success: true,
      message: 'Application note saved',
      note
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error saving application note',
      error: error.message
    });
  }
});

module.exports = router;
