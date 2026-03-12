const express = require('express');
const router = express.Router();
const teamController = require('../controllers/teamController');

// Route d'autocomplétion pour trouver une équipe par son nom
router.get('/search', teamController.searchTeams);

module.exports = router;
