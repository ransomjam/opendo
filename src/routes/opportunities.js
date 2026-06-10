const express = require('express');
const router = express.Router();
const Opportunity = require('../models/Opportunity');
const { requireAuth, optionalAuth, requireAdmin } = require('../middleware/auth');
const { readJsonArray, writeJsonArray } = require('../utils/jsonStore');
const matchingService = require('../services/matchingService');

const OPPORTUNITIES_FILE = 'opportunities.json';

// Opportunities are persisted to JSON so admin changes survive restarts and are
// visible to the matching service (a single source of truth).
function loadOpportunities() {
  return readJsonArray(OPPORTUNITIES_FILE).map(data => new Opportunity(data));
}

function saveOpportunities(opportunities) {
  writeJsonArray(OPPORTUNITIES_FILE, opportunities.map(opp => opp.toObject()));
}

function validationError(res, errors) {
  return res.status(400).json({
    success: false,
    message: 'Validation failed',
    errors
  });
}

function contains(value, searchTerm) {
  return String(value || '').toLowerCase().includes(searchTerm);
}

function isValidDateFilter(value) {
  return !Number.isNaN(Date.parse(value));
}

// Decide whether a given viewer is allowed to see an opportunity.
//  - Admins see everything.
//  - The creator always sees their own opportunities.
//  - Everyone else only sees globally published + public opportunities.
function canView(opportunity, user) {
  if (user && ['admin', 'super_admin'].includes(user.role)) {
    return true;
  }
  if (user && opportunity.createdByUserId && opportunity.createdByUserId === user.id) {
    return true;
  }
  return opportunity.status === 'published' && opportunity.visibility !== 'private';
}

// GET /api/opportunities - Get all opportunities with filtering
router.get('/', optionalAuth, (req, res) => {
  try {
    const errors = [];

    if (req.query.category && !Opportunity.getCategories().includes(req.query.category)) {
      errors.push('Category must be one of the allowed categories');
    }

    if (req.query.status && !Opportunity.getStatuses().includes(req.query.status)) {
      errors.push('Status must be one of the allowed values');
    }

    if (req.query.riskLevel && !Opportunity.getRiskLevels().includes(req.query.riskLevel)) {
      errors.push('Risk level must be one of the allowed values');
    }

    if (req.query.deadlineBefore && !isValidDateFilter(req.query.deadlineBefore)) {
      errors.push('Deadline before must be a valid date');
    }

    if (req.query.deadlineAfter && !isValidDateFilter(req.query.deadlineAfter)) {
      errors.push('Deadline after must be a valid date');
    }

    if (errors.length > 0) {
      return validationError(res, errors);
    }

    // Respect visibility first so private research is never leaked to others.
    let filteredOpportunities = loadOpportunities().filter(opp => canView(opp, req.user));

    // Allow callers to scope to only their own researched/private opportunities.
    if (req.query.mine === 'true' && req.user) {
      filteredOpportunities = filteredOpportunities.filter(opp => opp.createdByUserId === req.user.id);
    }

    if (req.query.visibility) {
      filteredOpportunities = filteredOpportunities.filter(opp => opp.visibility === req.query.visibility);
    }

    // Apply filters
    if (req.query.category) {
      filteredOpportunities = filteredOpportunities.filter(opp => opp.category === req.query.category);
    }

    if (req.query.status) {
      filteredOpportunities = filteredOpportunities.filter(opp => opp.status === req.query.status);
    }

    if (req.query.riskLevel) {
      filteredOpportunities = filteredOpportunities.filter(opp => opp.riskLevel === req.query.riskLevel);
    }

    if (req.query.country) {
      const country = req.query.country.toLowerCase();
      filteredOpportunities = filteredOpportunities.filter(opp =>
        contains(opp.countryScope, country) ||
        contains(opp.location, country)
      );
    }

    if (req.query.search) {
      const searchTerm = req.query.search.toLowerCase();
      filteredOpportunities = filteredOpportunities.filter(opp =>
        contains(opp.title, searchTerm) ||
        contains(opp.organisation, searchTerm) ||
        contains(opp.description, searchTerm) ||
        contains(opp.eligibility, searchTerm) ||
        contains(opp.location, searchTerm)
      );
    }

    if (req.query.deadlineBefore) {
      const deadlineBefore = new Date(req.query.deadlineBefore);
      filteredOpportunities = filteredOpportunities.filter(opp =>
        opp.deadline && new Date(opp.deadline) <= deadlineBefore
      );
    }

    if (req.query.deadlineAfter) {
      const deadlineAfter = new Date(req.query.deadlineAfter);
      filteredOpportunities = filteredOpportunities.filter(opp =>
        opp.deadline && new Date(opp.deadline) >= deadlineAfter
      );
    }

    // Convert to plain objects
    const result = filteredOpportunities.map(opp => opp.toObject());

    res.json({
      success: true,
      count: result.length,
      data: result
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error fetching opportunities',
      error: error.message
    });
  }
});

// GET /api/opportunities/:id - Get a single opportunity
router.get('/:id', optionalAuth, (req, res) => {
  try {
    const opportunity = loadOpportunities().find(opp => opp.id === req.params.id);

    if (!opportunity || !canView(opportunity, req.user)) {
      return res.status(404).json({
        success: false,
        message: 'Opportunity not found'
      });
    }

    res.json({
      success: true,
      data: opportunity.toObject()
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error fetching opportunity',
      error: error.message
    });
  }
});

// POST /api/opportunities/:id/match - compute & store this user's match for one opportunity
router.post('/:id/match', requireAuth, async (req, res) => {
  try {
    const enhance = req.body && req.body.enhance === true;
    const match = await matchingService.matchOpportunityForUser(req.user.id, req.params.id, { enhance });

    if (!match) {
      return res.status(404).json({ success: false, message: 'Opportunity not found' });
    }

    res.json({ success: true, message: 'Match computed', data: match });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error computing match', error: error.message });
  }
});

// POST /api/opportunities - Create a new opportunity
router.post('/', requireAuth, requireAdmin, (req, res) => {
  try {
    const opportunity = new Opportunity(req.body);

    // Validate the opportunity
    const validation = opportunity.validate();
    if (!validation.isValid) {
      return validationError(res, validation.errors);
    }

    const opportunities = loadOpportunities();
    opportunities.push(opportunity);
    saveOpportunities(opportunities);

    res.status(201).json({
      success: true,
      message: 'Opportunity created successfully',
      data: opportunity.toObject()
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error creating opportunity',
      error: error.message
    });
  }
});

// PUT /api/opportunities/:id - Update an opportunity
router.put('/:id', requireAuth, requireAdmin, (req, res) => {
  try {
    const opportunities = loadOpportunities();
    const opportunityIndex = opportunities.findIndex(opp => opp.id === req.params.id);

    if (opportunityIndex === -1) {
      return res.status(404).json({
        success: false,
        message: 'Opportunity not found'
      });
    }

    const updatedOpportunity = opportunities[opportunityIndex];
    updatedOpportunity.update(req.body);

    // Validate the updated opportunity
    const validation = updatedOpportunity.validate();
    if (!validation.isValid) {
      return validationError(res, validation.errors);
    }

    opportunities[opportunityIndex] = updatedOpportunity;
    saveOpportunities(opportunities);

    res.json({
      success: true,
      message: 'Opportunity updated successfully',
      data: updatedOpportunity.toObject()
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error updating opportunity',
      error: error.message
    });
  }
});

// DELETE /api/opportunities/:id - Delete an opportunity
router.delete('/:id', requireAuth, requireAdmin, (req, res) => {
  try {
    const opportunities = loadOpportunities();
    const opportunityIndex = opportunities.findIndex(opp => opp.id === req.params.id);

    if (opportunityIndex === -1) {
      return res.status(404).json({
        success: false,
        message: 'Opportunity not found'
      });
    }

    opportunities.splice(opportunityIndex, 1);
    saveOpportunities(opportunities);

    res.json({
      success: true,
      message: 'Opportunity deleted successfully'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error deleting opportunity',
      error: error.message
    });
  }
});

// POST /api/opportunities/:id/publish - admin publishes a (researched) opportunity
// globally: status -> published, visibility -> public. This is the ONLY way a
// personal_research opportunity becomes visible to all users.
router.post('/:id/publish', requireAuth, requireAdmin, (req, res) => {
  try {
    const opportunities = loadOpportunities();
    const opportunity = opportunities.find(opp => opp.id === req.params.id);

    if (!opportunity) {
      return res.status(404).json({ success: false, message: 'Opportunity not found' });
    }

    opportunity.update({ status: 'published', visibility: 'public' });
    saveOpportunities(opportunities);

    res.json({
      success: true,
      message: 'Opportunity published globally',
      data: opportunity.toObject()
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error publishing opportunity', error: error.message });
  }
});

// PATCH /api/opportunities/:id/status - Update opportunity status
router.patch('/:id/status', requireAuth, requireAdmin, (req, res) => {
  try {
    const opportunities = loadOpportunities();
    const opportunity = opportunities.find(opp => opp.id === req.params.id);

    if (!opportunity) {
      return res.status(404).json({
        success: false,
        message: 'Opportunity not found'
      });
    }

    const { status } = req.body;

    if (!status) {
      return validationError(res, ['Status is required']);
    }

    const updated = opportunity.updateStatus(status);

    if (!updated) {
      return validationError(res, ['Status must be one of the allowed values']);
    }

    saveOpportunities(opportunities);

    res.json({
      success: true,
      message: 'Opportunity status updated successfully',
      data: opportunity.toObject()
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error updating opportunity status',
      error: error.message
    });
  }
});

module.exports = router;
