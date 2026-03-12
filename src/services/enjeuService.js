// Protocol 1: Calcul de l'EnjeuScore

/**
 * Calcule l'EnjeuScore (0 à 10) d'une équipe basé sur sa position au classement
 * et l'avancement de la saison.
 * 
 * @param {Object} teamStanding - Objet standing de l'équipe depuis l'API-Football
 * @param {Array} fullStandings - Tableau complet du classement pour cette ligue/groupe
 * @returns {Number} EnjeuScore de 0.0 à 10.0
 */
exports.calculateEnjeuScore = (teamStanding, fullStandings) => {
    if (!teamStanding || !fullStandings || fullStandings.length === 0) {
        return 5.0; // Valeur par défaut neutre si stats indisponibles
    }

    const { team_name, standing_PTS, standing_P, description } = teamStanding;
    const matchesPlayed = standing_P || 1;

    // Approximation: Une saison typique a ~38 matchs. On ajuste dynamiquement sur le total max joué.
    const maxMatchesPlayedInLeague = Math.max(...fullStandings.map(s => s.standing_P || 1));
    const totalMatchesEstimated = maxMatchesPlayedInLeague < 30 ? 30 : 38; // Basique

    // Facteur de saison : L'enjeu augmente vers la fin de la saison
    const seasonProgress = Math.min(matchesPlayed / totalMatchesEstimated, 1.0);

    let baseScore = 3.0; // Score de base par défaut (milieu de tableau sans objectif)

    // 1. Analyse de la description (Promotion, Relégation, Titre)
    if (description) {
        const descLower = description.toLowerCase();
        if (descLower.includes('promotion') || descLower.includes('champions league') || descLower.includes('title')) {
            baseScore = 7.0;
        } else if (descLower.includes('relegation')) {
            baseScore = 8.0; // L'instinct de survie donne un enjeu massif
        } else if (descLower.includes('cup')) {
            baseScore = 6.0;
        }
    }

    // 2. Proximité des zones de tension (Titre/Europe ou Relégation)
    // Même si l'équipe n'est pas *dans* la zone, elle peut y accéder
    const firstPlacePoints = fullStandings[0]?.standing_PTS || standing_PTS || 0;

    // Trouver la ligne de relégation (première équipe avec description 'relegation')
    const relegationZoneTeam = fullStandings.find(s => s.description && s.description.toLowerCase().includes('relegation'));
    const relegationLinePoints = relegationZoneTeam ? relegationZoneTeam.standing_PTS : 0;

    // Calcul du delta de points
    const pointsToTitle = Math.max(firstPlacePoints - (standing_PTS || 0), 0);
    let pointsToRelegation = 999;
    if (relegationLinePoints > 0) {
        pointsToRelegation = Math.abs((standing_PTS || 0) - relegationLinePoints);
    }

    // Si on est proche du titre (< 6 points) - Max 3.0
    let tensionBonus = 0;
    if (pointsToTitle <= 6) {
        tensionBonus = Math.max(3.0 - (pointsToTitle * 0.5), 0);
    }

    // Si on est proche de la relégation (< 6 points) - Max 4.0 (La survie > Le titre souvent en fin de saison)
    if (pointsToRelegation <= 6) {
        tensionBonus = Math.max(4.0 - (pointsToRelegation * 0.6), tensionBonus);
    }

    // 3. Application du multiplicateur de fin de saison
    // L'enjeu est décuplé si on est à 80%+ de la saison
    const progressMultiplier = seasonProgress > 0.8 ? 1.5 : (seasonProgress > 0.5 ? 1.2 : 1.0);

    let finalScore = (baseScore + tensionBonus) * progressMultiplier;

    // 4. Cas Spéciaux "Must Win"
    // Finale ou match couperet direct - Pas géré ici mais pourrait forcer à 10

    return Number(Math.min(finalScore, 10.0).toFixed(1));
};
