// Service d'Ingestion des Données via SOFASCORE (Bypass Cloudflare via got-scraping)

/**
 * Helper dynamique pour importer gotScraping (ES Module)
 */
async function fetchFromSofascore(endpoint) {
    const { gotScraping } = await import('got-scraping');
    try {
        const response = await gotScraping.get(`https://api.sofascore.com/api/v1/${endpoint}`, {
            responseType: 'json',
            // Headers automatiques et Fingerprint gérés par gotScraping
            headers: {
                'Accept-Language': 'fr-FR,fr;q=0.9,en-US;q=0.8,en;q=0.7' // Préférence pour la data FR si dispo
            }
        });
        return response.body;
    } catch (error) {
        console.error(`[SofascoreAPI] Erreur sur ${endpoint}:`, error.message);
        throw error;
    }
}

/**
 * Récupère tous les matchs programmés pour une date donnée
 * @param {String} date Format 'YYYY-MM-DD'
 */
exports.getMatchesByDate = async (date) => {
    const response = await fetchFromSofascore(`sport/football/scheduled-events/${date}`);
    return response.events || [];
};

/**
 * Récupère uniquement les matchs actuellement En Cours (Bypass Cache)
 */
exports.getLiveMatches = async () => {
    try {
        const response = await fetchFromSofascore(`sport/football/events/live`);
        return response.events || [];
    } catch (err) {
        console.error(`[SofascoreAPI] Erreur events live:`, err.message);
        return [];
    }
};

/**
 * Récupère l'historique H2H et l'état de forme complet des deux équipes
 * @param {String|Number} eventId ID du match Sofascore
 */
exports.getH2HAndForm = async (eventId) => {
    const response = await fetchFromSofascore(`event/${eventId}/h2h`);
    return response || {};
};

/**
 * Récupère les détails profonds du match (Noms, Heure, Tournoi)
 * @param {String|Number} eventId ID du match Sofascore
 */
exports.getMatchDetails = async (eventId) => {
    try {
        const response = await fetchFromSofascore(`event/${eventId}`);
        return response.event || {};
    } catch (err) {
        console.error(`[SofascoreAPI] Pas de détails d'event pour ${eventId}`);
        return {};
    }
};

/**
 * Récupère les statistiques en direct d'un match (Possession, Tirs, etc)
 * @param {String|Number} eventId ID du match Sofascore
 */
exports.getLiveStatistics = async (eventId) => {
    try {
        const response = await fetchFromSofascore(`event/${eventId}/statistics`);
        return response.statistics || [];
    } catch (err) {
        console.log(`[SofascoreAPI] Stats live indisponibles pour ${eventId}`);
        return [];
    }
};

/**
 * Récupère les derniers matchs joués par une équipe (Forme récente)
 * @param {String|Number} teamId
 */
exports.getTeamLastEvents = async (teamId) => {
    try {
        const response = await fetchFromSofascore(`team/${teamId}/events/last/0`);
        return response.events || [];
    } catch (err) {
        console.error(`[SofascoreAPI] Erreur events équipe ${teamId}:`, err.message);
        return [];
    }
};

/**
 * Récupère les données contextuelles (Classement du match, Proba de gain, etc)
 * @param {String|Number} eventId ID du match Sofascore 
 */
exports.getPregameStats = async (eventId) => {
    try {
        const response = await fetchFromSofascore(`event/${eventId}/pregame-stats`);
        return response || {};
    } catch (err) {
        // Souvent indisponible sur les petits matchs, on gère l'erreur silencieusement
        console.log(`[SofascoreAPI] Pas de Pregame Stats pour ${eventId}`);
        return {};
    }
};

/**
 * (Obsolete/Adaptation) L'ancien getStandings n'est plus pertinent de la même façon,
 * Sofascore inclut les positions dans le "PregameStats" ou directement dans "Event".
 * Cette fonction retourne un stand-in vide pour éviter de casser d'autres vieux modules.
 */
exports.getStandings = async () => {
    return [];
};

/**
 * Récupère les compositions d'équipes (Lineups) pour scrypter les probabilités de buteurs
 * @param {String|Number} eventId ID du match Sofascore
 */
exports.getLineups = async (eventId) => {
    try {
        const response = await fetchFromSofascore(`event/${eventId}/lineups`);
        return response || {};
    } catch (err) {
        console.log(`[SofascoreAPI] Lineups indisponibles pour ${eventId}`);
        return {};
    }
};

/**
 * Récupère le fil des incidents du match (Buts, Cartons, VAR) essentiel pour évaluer le CRON
 * @param {String|Number} eventId ID du match Sofascore
 */
exports.getIncidents = async (eventId) => {
    try {
        const response = await fetchFromSofascore(`event/${eventId}/incidents`);
        return response.incidents || [];
    } catch (err) {
        console.log(`[SofascoreAPI] Incidents indisponibles pour ${eventId}`);
        return [];
    }
};

/**
 * Recherche globale des équipes sur Sofascore
 * @param {String} query Nom de l'équipe
 */
exports.searchTeams = async (query) => {
    try {
        const response = await fetchFromSofascore(`search/all?q=${encodeURIComponent(query)}`);
        return response.results || [];
    } catch (err) {
        console.error(`[SofascoreAPI] Erreur recherche:`, err.message);
        return [];
    }
};

/**
 * Traducteur global pour les noms de championnats / phases provenant de Sofascore
 */
exports.translateTournamentName = (name) => {
    if (!name) return "";
    let t = name;

    // Phases de tournois
    t = t.replace(/Knockout stage/gi, 'Phase finale');
    t = t.replace(/Knockout Phase/gi, 'Phase finale');
    t = t.replace(/Group stage/gi, 'Phase de groupes');
    t = t.replace(/Group Phase/gi, 'Phase de groupes');
    t = t.replace(/Elite round/gi, 'Tour Élite');
    t = t.replace(/Qualification/gi, 'Qualifications');
    t = t.replace(/Qualifiers/gi, 'Qualifications');
    t = t.replace(/Club Friendlies/gi, 'Amicaux Clubs');
    t = t.replace(/Friendlies/gi, 'Amicaux');

    // Mots spécifiques
    t = t.replace(/European Championship/gi, 'Championnat d\'Europe');
    t = t.replace(/World Championship/gi, 'Championnat du Monde');
    t = t.replace(/Championship/gi, 'Championship'); // Sauf pour les noms propres anglais type Championship, le but n'est pas de tout écraser
    t = t.replace(/\bWomen\b/gi, 'Féminin');
    t = t.replace(/\bWoman\b/gi, 'Féminin');
    t = t.replace(/\bYouth\b/gi, 'Jeunes');
    t = t.replace(/\bReserve\b/gi, 'Réserves');
    t = t.replace(/\bReserves\b/gi, 'Réserves');
    t = t.replace(/\bAmateur\b/gi, 'Amateurs');

    return t;
};
