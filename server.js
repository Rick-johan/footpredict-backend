const express = require('express');
const cors = require('cors');
const connectDB = require('./src/config/db');
require('dotenv').config();

const app = express();

// Connect to MongoDB
connectDB();

// Middleware
app.use(cors());
app.use(express.json());

// Serve Frontend Static Files
app.use(express.static('Frontend'));

// Routes API
app.use('/api/analysis', require('./src/routes/analysis'));
app.use('/api/predictions', require('./src/routes/Prediction'));
app.use('/api/fixtures', require('./src/routes/fixtures'));
app.use('/api/teams', require('./src/routes/teams'));

const teamController = require('./src/controllers/teamController');

const PORT = process.env.PORT || 5000;

app.listen(PORT, async () => {
    console.log(`[Ultra-Scanner] 🚀 Server running on port ${PORT}`);

    // Charger le cache des équipes en mémoire pour l'autocomplétion globale
    await teamController.initializeTeamsCache();
});
