const express = require('express');
const cors = require('cors');
const authRoutes = require('./routes/authRoutes');
const tripRoutes = require('./routes/tripRoutes');
const matchRoutes = require('./routes/matchRoutes');
const notificationRoutes = require('./routes/notificationRoutes');
const userRoutes = require('./routes/userRoutes');
const vehicleRoutes = require('./routes/vehicleRoutes');
const preferenceRoutes = require('./routes/preferenceRoutes');
const { geocode } = require('./controllers/tripController');

const app = express();
app.use(cors());
app.use(express.json());
app.use('/api/auth', authRoutes);
app.get('/api/geocode', geocode);
app.use('/api/trips', tripRoutes);
app.use('/api/users', userRoutes);
app.use('/api/vehicles', vehicleRoutes);
app.use('/api/preferences', preferenceRoutes);
app.use('/api', matchRoutes); // exposes POST /api/matches/search and POST /api/matches
app.use('/api/alerts', notificationRoutes); // POST/GET notification endpoints per traceability matrix

module.exports = app;
