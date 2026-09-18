const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const Sentry = require('@sentry/node');
const authRoutes = require('./routes/authRoutes');
const tripRoutes = require('./routes/tripRoutes');
const matchRoutes = require('./routes/matchRoutes');
const notificationRoutes = require('./routes/notificationRoutes');
const userRoutes = require('./routes/userRoutes');
const vehicleRoutes = require('./routes/vehicleRoutes');
const preferenceRoutes = require('./routes/preferenceRoutes');
const reportRoutes = require('./routes/reportRoutes');
const { geocode } = require('./controllers/tripController');
const { authenticate } = require('./middleware/authenticate');

const app = express();

// Baseline security headers (X-Content-Type-Options, X-Frame-Options,
// Content-Security-Policy, etc.) — this is a pure JSON API, never renders
// HTML, so helmet's defaults are safe here with nothing to configure around
// (no inline scripts/styles of our own for a CSP to break). Avatar images are
// served from the Next.js app's own public/ dir, not from this server, so
// that's unaffected too.
app.use(helmet());

// Credentialed CORS: the browser sends the httpOnly `rsu_session` cookie on
// cross-origin apiFetch calls only when the response echoes a specific origin
// (not `*`) and allows credentials. Dev default is the Next server on :3000 —
// set CORS_ORIGIN (comma-separated) if it runs elsewhere or for deployment.
// NOTE: production also needs the cookie set with `sameSite: 'none'; secure`
// (see src/app/api/session/route.ts) once frontend and API are on different
// domains — not handled here.
const corsOrigins = (process.env.CORS_ORIGIN || 'http://localhost:3000')
  .split(',')
  .map((o) => o.trim())
  .filter(Boolean);
app.use(cors({ origin: corsOrigins, credentials: true }));
app.use(express.json());

// Public — no session required (registration, login, email verification, reset).
app.use('/api/auth', authRoutes);

// Everything past this line requires a valid session token. Phase 1 only
// verifies it and sets req.user.id; controllers still trust the client-supplied
// identity field until phase 2 migrates them.
app.use('/api', authenticate);

app.get('/api/geocode', geocode);
app.use('/api/trips', tripRoutes);
app.use('/api/users', userRoutes);
app.use('/api/vehicles', vehicleRoutes);
app.use('/api/preferences', preferenceRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api', matchRoutes); // exposes POST /api/matches/search and POST /api/matches
app.use('/api/alerts', notificationRoutes); // POST/GET notification endpoints per traceability matrix

// Reports the error to Sentry, then calls next(err) itself so the existing
// handler below still runs unchanged — same response shape for clients,
// errors just also show up in the Sentry dashboard now.
Sentry.setupExpressErrorHandler(app);

// Catch-all error handler. Without this, an async controller rejection (e.g. a
// transient DB connection drop) falls through to Express's default handler,
// which returns an unlogged raw HTML page — the client's apiFetch then sees a
// non-JSON body and the frontend can't tell "backend errored" from "not found".
// Log it and return clean JSON so a 500 stays a recognisable 500.
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, _next) => {
  console.error(`[api error] ${req.method} ${req.originalUrl} — ${err.code || err.name}: ${err.message}`);
  res.status(500).json({ error: 'INTERNAL_ERROR' });
});

module.exports = app;
