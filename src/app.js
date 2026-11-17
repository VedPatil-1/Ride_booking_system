const express = require('express');
const healthRoutes = require('./routes/healthRoutes');
const rideRoutes = require('./routes/rideRoutes');
const adminRoutes = require('./routes/adminRoutes');

const app = express();

app.use(express.json());
app.use(healthRoutes);
app.use(rideRoutes);
app.use('/admin', adminRoutes);

app.use((_request, response) => {
  response.status(404).json({ error: 'Route not found' });
});

app.use((error, _request, response, _next) => {
  console.error('Unhandled request error:', error.message);
  response.status(500).json({ error: 'Internal server error' });
});

module.exports = app;
