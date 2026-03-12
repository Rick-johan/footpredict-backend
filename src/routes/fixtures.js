const express = require('express');
const router = express.Router();
const fixtureController = require('../controllers/fixtureController');

// Route pour récupérer les matchs d'une date spécifique (ex: ?date=2024-03-11)
router.get('/', fixtureController.getFixturesByDate);

module.exports = router;
