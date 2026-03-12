const express = require('express');
const router = express.Router();
const analysisController = require('../controllers/analysisController');

// Route pour analyser un duel personnalisé (Home vs Away)
router.get('/duel', analysisController.analyzeDuel);

// Route pour récupérer l'historique complet de l'IA (Track Record)
router.get('/history', analysisController.getHistory);

// Route pour supprimer une archive d'historique IA
router.delete('/history/:id', analysisController.deleteHistory);

// Route principale "Ultra-Scanner" (nécessite une vraie clé API)
router.get('/:fixtureId', analysisController.generateAnalysis);

// Route de Test / Mock pour voir le résultat JSON final sans consommer de crédit API
router.get('/mock/:fixtureId', analysisController.generateMockAnalysis);

module.exports = router;
