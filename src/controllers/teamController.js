const apiService = require('../services/apiFootballService');

/**
 * L'initialisation du cache local est désormais désactivée car
 * la recherche globale en temps réel de Sofascore est très rapide et complète.
 */
exports.initializeTeamsCache = async () => {
    console.log("[TeamsCache] Bypassed (using live Sofascore search for autocomplete)");
};

/**
 * Recherche d'équipes en direct sur Sofascore
 * Endpoint : GET /api/teams/search?q={nom}
 */
exports.searchTeams = async (req, res) => {
    try {
        const query = req.query.q;
        if (!query || query.length < 2) {
            return res.json({ teams: [] });
        }

        const results = await apiService.searchTeams(query);

        // Sofascore search returns various entities (tournaments, players, teams)
        // We filter to keep only "team" types.
        const teams = results
            .filter(item => item.entity && item.type === 'team')
            .map(item => ({
                id: item.entity.id,
                name: item.entity.name,
                logo: `https://api.sofascore.app/api/v1/team/${item.entity.id}/image`
            }));

        res.json({ teams: teams.slice(0, 15) });

    } catch (error) {
        console.error("[TeamController Error]", error.message);
        res.status(500).json({ error: 'Erreur lors de la recherche des équipes' });
    }
};
