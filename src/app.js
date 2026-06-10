const express = require('express');
const cors = require('cors');
const path = require('path');

const app = express();

// Middleware
app.use(cors());
app.use(express.json());
app.use('/assets', express.static(path.join(__dirname, '..', 'assets')));

// Health check route
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    message: 'Opportunity Tracker API is running'
  });
});

app.get('/favicon.ico', (req, res) => {
  res.status(204).end();
});

// Static HTML pages
function sendPage(fileName) {
  return (req, res) => res.sendFile(path.join(__dirname, '..', fileName));
}

app.get(['/', '/dashboard.html'], sendPage('dashboard.html'));
app.get('/admin_page.html', sendPage('admin_page.html'));
app.get('/opportunity_page.html', sendPage('opportunity_page.html'));
app.get('/profile_page.html', sendPage('profile_page.html'));

// Routes
const authRouter = require('./routes/auth');
const profileRouter = require('./routes/profiles');
const documentsRouter = require('./routes/documents');
const opportunitiesRouter = require('./routes/opportunities');
const matchesRouter = require('./routes/matches');
const actionStepsRouter = require('./routes/actionSteps');
const dashboardRouter = require('./routes/dashboard');
const assistantRouter = require('./routes/assistant');
const researchRouter = require('./routes/research');

app.use('/api/auth', authRouter);
app.use('/api/profile', profileRouter);
app.use('/api/documents', documentsRouter);
app.use('/api/opportunities', opportunitiesRouter);
app.use('/api/matches', matchesRouter);
app.use('/api/action-steps', actionStepsRouter);
app.use('/api/dashboard', dashboardRouter);
app.use('/api/assistant', assistantRouter);
app.use('/api/research', researchRouter);

// Not found handler
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: 'Route not found'
  });
});

// Error handler
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({
    success: false,
    message: 'Internal server error'
  });
});

module.exports = app;
