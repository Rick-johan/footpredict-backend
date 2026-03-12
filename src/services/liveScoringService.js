// Phase 9: Live In-Play Prediction Engine
const scoringService = require('./scoringService');

/**
 * Adjusts predictions based on real-time match events (Minute, Score, Red Cards).
 * @param {Object} mirrorScan - The pre-match analytical scan.
 * @param {Object} h2hData - Historical H2H data.
 * @param {Object} context - Standings and Enjeu data.
 * @param {Object} liveData - The current state of the match { minute, scoreHome, scoreAway, status }
 */
exports.generateLivePredictions = (mirrorScan, h2hData, context, liveData) => {
    // 1. D'abord, on génère les prédictions "de base" comme si le match n'avait pas commencé 
    // pour avoir la baseline statistique.
    const basePredictions = scoringService.classifyPredictions(mirrorScan, h2hData, context);

    const { minute, scoreHome, scoreAway, possession, shotsOnTarget } = liveData;
    const { isA_Dominating, isB_Dominating, metrics } = mirrorScan;
    const probaHome = metrics.advantageA;
    const probaAway = metrics.advantageB;
    const totalGoals = scoreHome + scoreAway;

    // Parse Live Stats safely
    const possH = parseInt(possession?.home) || 50;
    const possA = parseInt(possession?.away) || 50;
    const shotsH = shotsOnTarget?.home || 0;
    const shotsA = shotsOnTarget?.away || 0;

    // Simulations IA Live
    const factor = Math.random();

    // Helper pour générer des prédictions live spécifiques
    const generateLivePred = (cat, market, selection, confAdjust, logic) => {
        let conf = Math.min(99, Math.max(40, 60 + confAdjust + Math.floor(factor * 15)));
        return {
            category: cat,
            market: market,
            selection: selection,
            confidence: conf,
            justification: { mirror_scan: "AJUSTEMENT EN DIRECT", context_impact: logic }
        };
    };

    const livePredictions = [];

    // --- ALGORITHMES DE SCÉNARIOS EN DIRECT (Basés sur les vraies stats) ---

    // SCENARIO 1 : Équipe qui domine outrageusement mais qui ne mène pas
    if (possH > 60 && shotsH >= shotsA + 3 && scoreHome <= scoreAway && minute < 80) {
        livePredictions.push(generateLivePred('🔥 Alerte en Direct', 'Prochain But', 'Domicile marque le prochain but', 35, `Domination totale en live (${possH}% poss, ${shotsH} tirs cadrés). Le but chauffe.`));
        livePredictions.push(generateLivePred('🔥 Alerte en Direct', 'Double Chance', '1X (Domicile ou Nul)', 25, `L'équipe locale dicte le jeu et devrait revenir.`));
    }
    else if (possA > 60 && shotsA >= shotsH + 3 && scoreAway <= scoreHome && minute < 80) {
        livePredictions.push(generateLivePred('🔥 Alerte en Direct', 'Prochain But', 'Extérieur marque le prochain but', 35, `Domination visiteuse écrasante (${possA}% poss, ${shotsA} tirs cadrés).`));
    }

    // SCENARIO 2 : Fin de match imminente, équipe menée d'un but attaquant à fond
    if (Math.abs(scoreHome - scoreAway) === 1 && minute >= 75 && minute <= 90) {
        const trailingAttacking = (scoreHome < scoreAway && possH > 55) || (scoreAway < scoreHome && possA > 55);
        if (trailingAttacking) {
            livePredictions.push(generateLivePred('Corners & Stats', 'Prochain Corner', 'L\'équipe menée', 40, `Pression totale "All-in" confirmée par la possession en fin de match.`));
            livePredictions.push(generateLivePred('Corners & Stats', 'Total Cartons', 'Plus de 1.5 cartons restants', 20, `Tension maximale et fautes d'antijeu attendues.`));
        }
    }

    // SCENARIO 3 : Match nul (80e+) avec grosse intensité de tirs
    if (scoreHome === scoreAway && minute >= 75 && (shotsH + shotsA > 8)) {
        livePredictions.push(generateLivePred('Buts', 'But dans le dernier 1/4 d\'heure', `Plus de ${totalGoals + 0.5} Buts`, 30, `Le match est très ouvert (${shotsH + shotsA} tirs cadrés), le chaos est proche.`));
    }

    // SCENARIO 4 : Début de match explosif (Buts très tôt)
    if (totalGoals >= 2 && minute <= 30) {
        livePredictions.push(generateLivePred('Buts', 'Over/Under (Live)', `Plus de ${totalGoals + 1.5} Buts`, 30, `Match débridé. Les défenses sont complètement absentes.`));
        livePredictions.push(generateLivePred('Mi-Temps', 'Buts 1ère MT', `Plus de ${totalGoals + 0.5} Buts`, 15, `Le rythme est infernal jusqu'à la pause.`));
    }

    // SCENARIO 5 : Match verrouillé et stérile à l'heure de jeu
    if (totalGoals === 0 && minute >= 60 && probaHome < 1.5 && probaAway < 1.5) {
        livePredictions.push(generateLivePred('Score', 'Score Exact', '0-0', 40, `Aucun xG majeur détecté. Match s'acheminant vers un nul vierge.`));
        livePredictions.push(generateLivePred('Buts', 'Over/Under (Live)', 'Moins de 1.5 Buts', 45, `Verrouillage tactique. Un but au maximum est attendu.`));
    }

    // Concaténer les alertes live en haut de la liste, puis rajouter les prédictions de base pertinentes
    // (On peut filtrer les prédictions de base qui ne sont plus possibles, ex: 0-0 si y a déjà 1 but)

    let filteredBase = basePredictions.filter(p => {
        if (p.market === 'Score Exact (Multi-choix)' || p.market === 'Score à la Mi-Temps') return false; // Trop complexe à adapter en live textuel pour l'instant
        if (totalGoals > 0 && p.selection.includes('Moins de 0.5')) return false;
        if (totalGoals > 2 && p.selection.includes('Moins de 2.5')) return false;
        if (totalGoals > 3 && p.selection.includes('Moins de 3.5')) return false;
        return true;
    });

    // Tag UI pour différencier
    livePredictions.forEach(lp => lp.is_live = true);

    return [...livePredictions, ...filteredBase];
};
