const Opportunity = require('../models/Opportunity');
const ActionStep = require('../models/ActionStep');
const ApplicationNote = require('../models/ApplicationNote');
const { readJsonArray, writeJsonArray } = require('../utils/jsonStore');
const matchingService = require('./matchingService');

const OPPORTUNITIES_FILE = 'opportunities.json';
const ACTION_STEPS_FILE = 'actionSteps.json';
const NOTES_FILE = 'applicationNotes.json';

const STATUS_ORDER = {
  applying: 0,
  interested: 1,
  saved: 2,
  new: 3,
  submitted: 4,
  ignored: 5
};

const PRIORITY_ORDER = {
  urgent: 0,
  high: 1,
  medium: 2,
  low: 3
};

function todayDateOnly() {
  return new Date().toISOString().slice(0, 10);
}

function activeStep(step) {
  return step.status === 'not_started' || step.status === 'in_progress';
}

function compareSteps(a, b) {
  if (activeStep(a) !== activeStep(b)) return activeStep(a) ? -1 : 1;
  if ((a.dueDate || '') !== (b.dueDate || '')) {
    if (!a.dueDate) return 1;
    if (!b.dueDate) return -1;
    return a.dueDate.localeCompare(b.dueDate);
  }
  return (PRIORITY_ORDER[a.priority] ?? 9) - (PRIORITY_ORDER[b.priority] ?? 9);
}

function compareWorkspaceItems(a, b) {
  const statusDiff = (STATUS_ORDER[a.match.status] ?? 9) - (STATUS_ORDER[b.match.status] ?? 9);
  if (statusDiff !== 0) return statusDiff;

  const aDays = a.daysUntilDeadline === null || a.daysUntilDeadline < 0 ? Infinity : a.daysUntilDeadline;
  const bDays = b.daysUntilDeadline === null || b.daysUntilDeadline < 0 ? Infinity : b.daysUntilDeadline;
  if (aDays !== bDays) return aDays - bDays;

  return b.match.matchScore - a.match.matchScore;
}

async function loadOpportunityMap() {
  const map = new Map();
  (await readJsonArray(OPPORTUNITIES_FILE)).forEach(data => {
    const opportunity = new Opportunity(data);
    map.set(opportunity.id, opportunity.toObject());
  });
  return map;
}

async function getWorkspace(userId) {
  const [matches, opportunityMap, allSteps, allNotes] = await Promise.all([
    matchingService.getMatchesForUser(userId),
    loadOpportunityMap(),
    readJsonArray(ACTION_STEPS_FILE),
    readJsonArray(NOTES_FILE)
  ]);

  const stepsByOpportunity = new Map();
  allSteps
    .filter(step => step.userId === userId)
    .map(step => new ActionStep(step).toObject())
    .forEach(step => {
      const list = stepsByOpportunity.get(step.opportunityId) || [];
      list.push(step);
      stepsByOpportunity.set(step.opportunityId, list);
    });

  const noteByOpportunity = new Map();
  allNotes
    .filter(note => note.userId === userId)
    .map(note => new ApplicationNote(note).toObject())
    .forEach(note => noteByOpportunity.set(note.opportunityId, note));

  const items = matches
    .map(match => {
      const opportunity = opportunityMap.get(match.opportunityId);
      if (!opportunity) return null;

      const steps = (stepsByOpportunity.get(match.opportunityId) || []).sort(compareSteps);
      const nextStep = steps.find(activeStep) || null;
      const missingDocuments = match.missingDocuments || [];
      const availableDocuments = match.availableDocuments || [];
      const daysUntilDeadline = matchingService.daysUntil(opportunity.deadline);

      return {
        opportunity,
        match,
        daysUntilDeadline,
        nextStep,
        steps,
        note: noteByOpportunity.get(match.opportunityId) || null,
        documents: {
          available: availableDocuments,
          missing: missingDocuments,
          readyCount: availableDocuments.length,
          missingCount: missingDocuments.length,
          readinessLabel: missingDocuments.length ? `${missingDocuments.length} missing` : 'ready'
        }
      };
    })
    .filter(Boolean)
    .sort(compareWorkspaceItems);

  const today = todayDateOnly();
  const activeItems = items.filter(item => item.match.status !== 'ignored' && item.match.status !== 'submitted');
  const dueNow = activeItems
    .flatMap(item => item.steps
      .filter(step => activeStep(step) && step.dueDate && step.dueDate <= today)
      .map(step => ({
        step,
        opportunity: item.opportunity,
        match: item.match,
        daysUntilDeadline: item.daysUntilDeadline
      })))
    .sort((a, b) => compareSteps(a.step, b.step))
    .slice(0, 8);

  const urgentDeadlines = activeItems
    .filter(item => item.daysUntilDeadline !== null && item.daysUntilDeadline >= 0 && item.daysUntilDeadline <= 14)
    .sort((a, b) => a.daysUntilDeadline - b.daysUntilDeadline)
    .slice(0, 5)
    .map(item => ({
      title: item.opportunity.title,
      organisation: item.opportunity.organisation,
      deadline: item.opportunity.deadline,
      daysUntilDeadline: item.daysUntilDeadline,
      applicationLink: item.opportunity.applicationLink || item.opportunity.sourceUrl || ''
    }));

  return {
    success: true,
    today,
    summary: {
      activeApplications: activeItems.length,
      applying: items.filter(item => item.match.status === 'applying').length,
      submitted: items.filter(item => item.match.status === 'submitted').length,
      dueNow: dueNow.length,
      urgentDeadlines: urgentDeadlines.length
    },
    dueNow,
    urgentDeadlines,
    items
  };
}

async function saveNote(userId, opportunityId, content) {
  const notes = (await readJsonArray(NOTES_FILE)).map(note => new ApplicationNote(note));
  const index = notes.findIndex(note => note.userId === userId && note.opportunityId === opportunityId);
  let note;

  if (index === -1) {
    note = new ApplicationNote({ userId, opportunityId, content });
    notes.push(note);
  } else {
    note = notes[index];
    note.update({ content });
    notes[index] = note;
  }

  await writeJsonArray(NOTES_FILE, notes.map(item => item.toObject()));
  return note.toObject();
}

module.exports = {
  getWorkspace,
  saveNote
};
