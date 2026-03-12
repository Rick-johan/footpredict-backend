const apiService = require('../services/apiFootballService');

/**
 * Récupère les matchs du jour triés par championnat depuis Sofascore
 * Convertit le format Sofascore vers le format attendu par le Frontend actuel.
 * Endpoint : /api/fixtures?date=YYYY-MM-DD
 */
exports.getFixturesByDate = async (req, res) => {
    try {
        const date = req.query.date || new Date().toISOString().split('T')[0];

        // Appel via got-scraping (Sofascore Bypass)
        // Parallélisation : on récupère le planning de la journée ET les matchs actuellement en direct.
        // Le endpoint /scheduled-events/ est massivement mis en cache par Sofascore, on doit l'écraser avec le /live/
        const [events, liveEvents] = await Promise.all([
            apiService.getMatchesByDate(date),
            apiService.getLiveMatches()
        ]);

        const liveEventsMap = new Map();
        liveEvents.forEach(e => liveEventsMap.set(e.id, e));

        // Mettre à jour la liste des scheduledEvents avec les live events s'ils y sont absents (sécurité)
        const scheduledIds = new Set(events.map(e => e.id));
        liveEvents.forEach(e => {
            if (!scheduledIds.has(e.id)) {
                events.push(e);
            }
        });

        // On mappe les propriétés Sofascore vers les clés que le Frontend actuel s'attend à lire
        const mappedFixtures = events.map(scheduledEvent => {
            // Fusionner si le match est en cours (bypass cache)
            const event = liveEventsMap.has(scheduledEvent.id) ? liveEventsMap.get(scheduledEvent.id) : scheduledEvent;

            const startDate = new Date(event.startTimestamp * 1000);

            let statusInfo = event.status?.description || 'À venir';
            let live_timestamp = null;
            let live_initial = null;

            if (event.status?.type === 'inprogress') {
                const desc = event.status?.description;

                if (event.time && event.time.currentPeriodStartTimestamp) {
                    live_timestamp = event.time.currentPeriodStartTimestamp;
                    live_initial = event.time.initial || 0;
                }

                if (desc === 'Halftime') {
                    statusInfo = 'MT';
                } else if (desc === 'Extra time halftime') {
                    statusInfo = 'MT Prol.';
                } else if (event.time) {
                    let min = event.time.played || 0;

                    // Match native Sofascore formatting with added injury time
                    if (event.time.injuryTime1 && min >= 45 && desc === '1st half') {
                        statusInfo = `45+${event.time.injuryTime1}'`;
                    } else if (event.time.injuryTime2 && min >= 90 && desc === '2nd half') {
                        statusInfo = `90+${event.time.injuryTime2}'`;
                    } else if (event.time.injuryTime3 && min >= 105 && desc === '1st extra') {
                        statusInfo = `105+${event.time.injuryTime3}'`;
                    } else if (event.time.injuryTime4 && min >= 120 && desc === '2nd extra') {
                        statusInfo = `120+${event.time.injuryTime4}'`;
                    } else {
                        statusInfo = min > 0 ? `${min}'` : 'En Cours';
                    }
                } else {
                    if (desc === '1st half') statusInfo = '1ère MT';
                    else if (desc === '2nd half') statusInfo = '2ème MT';
                }
            } else if (statusInfo === 'Halftime') {
                statusInfo = 'MT';
            }

            let event_2nd_result = null;
            if (event.homeScore?.period1 !== undefined && event.homeScore?.current !== undefined) {
                const desc = event.status?.description || '';
                if (event.status?.type === 'finished' || statusInfo.includes('2ème') || desc.includes('2nd half') || desc === 'Halftime') {
                    // Si c'est MT, la 2ème n'a pas commencé mais on peut l'initialiser ou la laisser nulle
                    if (desc !== 'Halftime' && !statusInfo.includes('MT')) {
                        const h2 = Math.max(0, event.homeScore.current - event.homeScore.period1);
                        const a2 = Math.max(0, event.awayScore.current - event.awayScore.period1);
                        event_2nd_result = `${h2} - ${a2}`;
                    }
                }
            }

            return {
                event_key: event.id,
                league_key: event.tournament.uniqueTournament?.id || event.tournament.id,
                league_name: apiService.translateTournamentName(event.tournament.name),
                league_country: event.tournament.category?.name || 'International',
                league_logo: `https://api.sofascore.app/api/v1/unique-tournament/${event.tournament.uniqueTournament?.id}/image`,
                event_date: startDate.toISOString().split('T')[0],
                event_time: startDate.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }),
                event_home_team: event.homeTeam.name,
                home_team_logo: `https://api.sofascore.app/api/v1/team/${event.homeTeam.id}/image`,
                event_away_team: event.awayTeam.name,
                away_team_logo: `https://api.sofascore.app/api/v1/team/${event.awayTeam.id}/image`,
                event_status: event.status?.type || 'notstarted', // 'inprogress', 'finished'
                event_final_result: event.homeScore?.current !== undefined ? `${event.homeScore?.current} - ${event.awayScore?.current}` : '-',
                event_ht_result: event.homeScore?.period1 !== undefined ? `${event.homeScore?.period1} - ${event.awayScore?.period1}` : null,
                event_2nd_result: event_2nd_result,
                event_status_info: statusInfo,
                live_timestamp: live_timestamp,
                live_desc: event.status?.description,
                live_initial: live_initial || 0
            };
        });

        res.json({ fixtures: mappedFixtures });

    } catch (error) {
        console.error("[FixtureController Error]", error.message);
        res.status(500).json({ error: 'Erreur lors de la récupération des matchs' });
    }
};
