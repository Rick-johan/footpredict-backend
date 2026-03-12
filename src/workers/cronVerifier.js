const mongoose = require('mongoose');
const cron = require('node-cron');
const Prediction = require('../models/Prediction');
const { evaluatePrediction } = require('../services/evaluationService');
const apiService = require('../services/apiFootballService');
require('dotenv').config();

console.log("🛠️  [CRON] Service de vérification automatique activé.");

// Fonction principale pour vérifier les paris en attente
async function verifyPendingMatches() {
    console.log(`[CRON] ${new Date().toISOString()} : Lancement de la vérification des matchs...`);

    try {
        // 1. Trouver les matchs non résolus en DB
        const pendingPredictions = await Prediction.find({ 'actual_result.status': 'PENDING' });

        if (pendingPredictions.length === 0) {
            console.log("[CRON] Aucun match en attente de vérification.");
            return;
        }

        console.log(`[CRON] ${pendingPredictions.length} matchs à vérifier trouvés dans l'historique.`);

        // 2. Extraire toutes les dates uniques pour optimiser les appels API
        const datesToFetch = [...new Set(pendingPredictions.map(p => p.match_info.date.split('T')[0]))];
        const allFixturesData = {};

        // 3. Appel API par date (Sofascore via got-scraping)
        for (const date of datesToFetch) {
            try {
                console.log(`[CRON] Interrogation API Sofascore pour la date: ${date}`);
                const events = await apiService.getMatchesByDate(date);

                if (events && events.length > 0) {
                    // Indexer les matchs reçus par ID d'équipe domicile et extérieur
                    events.forEach(f => {
                        if (f.homeTeam && f.awayTeam) {
                            const searchKey = `${f.homeTeam.name.toLowerCase()}-${f.awayTeam.name.toLowerCase()}`;
                            allFixturesData[searchKey] = f;
                        }
                    });
                }
            } catch (err) {
                console.error(`[CRON] Erreur d'API pour la date ${date}:`, err.message);
            }
        }

        // 4. Evaluer les matchs PENDING
        let updatedCount = 0;

        for (const doc of pendingPredictions) {
            const hTeam = doc.match_info.home_name.toLowerCase();
            const aTeam = doc.match_info.away_name.toLowerCase();
            const searchKey = `${hTeam}-${aTeam}`;

            const realMatch = allFixturesData[searchKey];

            if (realMatch && realMatch.status?.type === 'finished') {
                const homeScore = parseInt(realMatch.homeScore?.current, 10) || 0;
                const awayScore = parseInt(realMatch.awayScore?.current, 10) || 0;

                let homeCorners = null, awayCorners = null;
                let homeYellowCards = null, awayYellowCards = null;
                let incidents = [];
                try {
                    homeCorners = 0; awayCorners = 0;
                    homeYellowCards = 0; awayYellowCards = 0;

                    const stats = await apiService.getLiveStatistics(realMatch.id);
                    if (stats && stats.length > 0) {
                        const allGroup = stats.find(s => s.period === 'ALL');
                        if (allGroup && allGroup.groups) {
                            allGroup.groups.forEach(g => {
                                g.statisticsItems.forEach(item => {
                                    if (item.name === 'Corner kicks') { homeCorners = parseInt(item.home) || 0; awayCorners = parseInt(item.away) || 0; }
                                    if (item.name === 'Yellow cards') { homeYellowCards = parseInt(item.home) || 0; awayYellowCards = parseInt(item.away) || 0; }
                                });
                            });
                        }
                    }

                    // Extract exact goalscorers for niche player bets
                    const rawIncidents = await apiService.getIncidents(realMatch.id);
                    if (rawIncidents) incidents = rawIncidents;

                } catch (e) {
                    console.error("[CRON] Error extracting deep live stats for match " + realMatch.id);
                    homeCorners = null; awayCorners = null;
                    homeYellowCards = null; awayYellowCards = null;
                }

                // Mettre a jour le resultat reel
                doc.actual_result = {
                    status: 'COMPLETED',
                    home_goals: homeScore,
                    away_goals: awayScore,
                    home_goals_ht: realMatch.homeScore?.period1,
                    away_goals_ht: realMatch.awayScore?.period1,
                    home_corners: homeCorners,
                    away_corners: awayCorners,
                    home_yellow_cards: homeYellowCards,
                    away_yellow_cards: awayYellowCards,
                    incidents: incidents
                };

                // 5. Evaluer chaque Prediction dynamiquement
                for (let i = 0; i < doc.ai_predictions.length; i++) {
                    doc.ai_predictions[i].is_won = evaluatePrediction(doc.ai_predictions[i], doc.actual_result);
                }

                doc.markModified('ai_predictions');
                await doc.save();
                updatedCount++;
                console.log(`[CRON] ✅ Match Résolu : ${hTeam} ${homeScore}-${awayScore} ${aTeam}`);
            }
        }

        console.log(`[CRON] Vérification terminée. ${updatedCount} matchs mis à jour en base de données.`);

    } catch (e) {
        console.error("[CRON] Erreur fatale dans le worker:", e);
    }
}

// Planifier l'exécution tous les jours à 04:00 AM
cron.schedule('0 4 * * *', () => {
    verifyPendingMatches();
});

// Permettre l'exécution manuelle
module.exports = { verifyPendingMatches };
