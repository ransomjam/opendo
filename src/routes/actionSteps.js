const express = require('express');
const router = express.Router();
const { requireAuth } = require('../middleware/auth');
const { readJsonArray, writeJsonArray } = require('../utils/jsonStore');
const ActionStep = require('../models/ActionStep');

const ACTION_STEPS_FILE = 'actionSteps.json';

async function loadSteps() {
  return readJsonArray(ACTION_STEPS_FILE);
}

// GET /api/action-steps - all of the current user's action steps
router.get('/', requireAuth, async (req, res) => {
  try {
    const steps = (await loadSteps())
      .filter(step => step.userId === req.user.id)
      .sort((a, b) => (a.createdAt < b.createdAt ? -1 : 1));

    res.json({ success: true, count: steps.length, data: steps });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error fetching action steps', error: error.message });
  }
});

// GET /api/action-steps/:opportunityId - the user's action steps for one opportunity
router.get('/:opportunityId', requireAuth, async (req, res) => {
  try {
    const steps = (await loadSteps()).filter(
      step => step.userId === req.user.id && step.opportunityId === req.params.opportunityId
    );

    res.json({ success: true, count: steps.length, data: steps });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error fetching action steps', error: error.message });
  }
});

// PATCH /api/action-steps/:stepId/status - update one of the user's own steps
router.patch('/:stepId/status', requireAuth, async (req, res) => {
  try {
    const { status } = req.body || {};
    if (!status) {
      return res.status(400).json({ success: false, message: 'Status is required' });
    }

    const all = await loadSteps();
    const index = all.findIndex(step => step.id === req.params.stepId && step.userId === req.user.id);

    if (index === -1) {
      return res.status(404).json({ success: false, message: 'Action step not found' });
    }

    const step = new ActionStep(all[index]);
    if (!step.updateStatus(status)) {
      return res.status(400).json({
        success: false,
        message: `Status must be one of: ${ActionStep.getStatuses().join(', ')}`
      });
    }

    all[index] = step.toObject();
    await writeJsonArray(ACTION_STEPS_FILE, all);

    res.json({ success: true, message: 'Action step updated', data: all[index] });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error updating action step', error: error.message });
  }
});

// PATCH /api/action-steps/:stepId - update status, due date, priority, or notes
router.patch('/:stepId', requireAuth, async (req, res) => {
  try {
    const all = await loadSteps();
    const index = all.findIndex(step => step.id === req.params.stepId && step.userId === req.user.id);

    if (index === -1) {
      return res.status(404).json({ success: false, message: 'Action step not found' });
    }

    const step = new ActionStep(all[index]);
    const allowed = {};
    ['status', 'priority', 'dueDate', 'notes'].forEach(key => {
      if (req.body && req.body[key] !== undefined) {
        allowed[key] = req.body[key];
      }
    });

    if (!step.update(allowed)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid action step update'
      });
    }

    all[index] = step.toObject();
    await writeJsonArray(ACTION_STEPS_FILE, all);

    res.json({ success: true, message: 'Action step updated', data: all[index] });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error updating action step', error: error.message });
  }
});

module.exports = router;
