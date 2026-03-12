const ingestionService = require('../services/ingestionService');
const mirrorScanService = require('../services/mirrorScanService');
const scoringService = require('../services/scoringService');
const liveScoringService = require('../services/liveScoringService'); // Phase 9 Live Engine
const apiService = require('../services/apiFootballService');
const evaluationService = require('../services/evaluationService'); // Added for Dynamic Live Engine evaluation

/**
 * Controller principal pour générer l'analyse "Ultra-Scanner" complète
 */
exports.generateAnalysis = async (req, res) => {
    try {
        const { fixtureId } = req.params;

        // --- SYSTEME DE CACHE OBLIGATOIRE ---
        const Prediction = require('../models/Prediction');
        const existingAnalysis = await Prediction.findOne({ fixture_id: String(fixtureId) });

        if (existingAnalysis && existingAnalysis.raw_response) {
            console.log(`[CACHE HIT] Renvoi de l'analyse ${fixtureId} depuis MongoDB !`);

            return res.json({
                message: "Analyse récupérée depuis le Cache (0 requête API)",
                data: existingAnalysis.raw_response
            });
        }
        console.log(`[CACHE MISS] Analyse ${fixtureId} introuvable. Lancement requête API...`);
        // ------------------------------------

        // 1. Ingestion via Sofascore (Protocole 1)
        const h2hData = await apiService.getH2HAndForm(fixtureId);
        const pregameStats = await apiService.getPregameStats(fixtureId);

        // On récupère les détails profonds du match (Noms réels, ligue, date)
        const matchInfo = await apiService.getMatchDetails(fixtureId);

        // 2. Récupération des statistiques poussées pour le Scan Miroir
        // On transforme le "Form" liste de Sofascore en stats moyennes pour le Mirror Scan
        const extractGoalStats = (events, teamId) => {
            if (!events || events.length === 0) return { goals: { for: { average: { home: 1.0, away: 1.0 } }, against: { average: { home: 1.0, away: 1.0 } } } };

            let scored = 0, conceded = 0;
            events.forEach(e => {
                const isHome = e.homeTeam.id === teamId;
                const scoreHome = e.homeScore?.current || 0;
                const scoreAway = e.awayScore?.current || 0;
                scored += isHome ? scoreHome : scoreAway;
                conceded += isHome ? scoreAway : scoreHome;
            });
            const avgScored = scored / events.length;
            const avgConceded = conceded / events.length;

            return {
                goals: {
                    for: { average: { home: avgScored, away: avgScored } },
                    against: { average: { home: avgConceded, away: avgConceded } }
                }
            };
        };

        const homeTeamId = matchInfo.homeTeam?.id || pregameStats?.team1Id || 1;
        const awayTeamId = matchInfo.awayTeam?.id || pregameStats?.team2Id || 2;
        const homeName = matchInfo.homeTeam?.name || "Domicile";
        const awayName = matchInfo.awayTeam?.name || "Extérieur";

        const team1Events = await apiService.getTeamLastEvents(homeTeamId);
        const team2Events = await apiService.getTeamLastEvents(awayTeamId);

        const homeStats = extractGoalStats(team1Events, homeTeamId);
        const awayStats = extractGoalStats(team2Events, awayTeamId);

        // 3. Scan Miroir (Protocole 2)
        const mirrorScan = mirrorScanService.runMirrorScan(homeStats, awayStats);

        // 3.5 Traitement du Head-to-Head Historique & Forme Récente (3 Ans Max)
        let h2hStats = { homeWins: 0, draws: 0, awayWins: 0, totalValid: 0, homeWinRate: 0, awayWinRate: 0 };
        const THREE_YEARS_MS = 3 * 365 * 24 * 60 * 60 * 1000;
        const nowMs = Date.now();

        // Helper to process any array of events and attribute wins/losses properly to the target teams
        const processEvents = (eventsArray, trackDrawsForH2H = false, maxMatches = null) => {
            if (!eventsArray || eventsArray.length === 0) return;

            // Si c'est l'historique récent d'une équipe, on s'assure que le tableau est trié du plus récent au plus ancien (normalement oui via API)
            // et on prend uniquement les X derniers matchs
            const targetArray = maxMatches ? eventsArray.slice(0, maxMatches) : eventsArray;

            targetArray.forEach(match => {
                const matchTimeMs = match.startTimestamp * 1000;
                if ((nowMs - matchTimeMs) <= THREE_YEARS_MS) {
                    if (match.homeScore?.current !== undefined && match.awayScore?.current !== undefined) {
                        const homeGoals = match.homeScore.current;
                        const awayGoals = match.awayScore.current;

                        // Check if our tracked teams are involved
                        const isOurHomePlayingHome = match.homeTeam?.id === homeTeamId;
                        const isOurHomePlayingAway = match.awayTeam?.id === homeTeamId;
                        const isOurAwayPlayingHome = match.homeTeam?.id === awayTeamId;
                        const isOurAwayPlayingAway = match.awayTeam?.id === awayTeamId;

                        const ourHomeInvolved = isOurHomePlayingHome || isOurHomePlayingAway;
                        const ourAwayInvolved = isOurAwayPlayingHome || isOurAwayPlayingAway;

                        // We only track valid matches where at least one team is involved
                        if (ourHomeInvolved || ourAwayInvolved) {
                            h2hStats.totalValid++;
                        } else {
                            return; // Skip if neither is involved (safety check)
                        }

                        if (homeGoals === awayGoals) {
                            if (trackDrawsForH2H) h2hStats.draws++;
                        } else if (homeGoals > awayGoals) { // Home team won
                            if (isOurHomePlayingHome) h2hStats.homeWins++;
                            if (isOurAwayPlayingHome) h2hStats.awayWins++;
                        } else { // Away team won
                            if (isOurHomePlayingAway) h2hStats.homeWins++;
                            if (isOurAwayPlayingAway) h2hStats.awayWins++;
                        }
                    }
                }
            });
        };

        // Process direct confrontation (H2H): No match limit, only the 3-year time limit applies
        if (h2hData && h2hData.events) processEvents(h2hData.events, true, null);

        // Process individual recent forms: Strict limit of 7 matches maximum per user request
        processEvents(team1Events, false, 7);
        processEvents(team2Events, false, 7);

        if (h2hStats.totalValid > 0) {
            // Use precise calculation against their specifically tracked matches count (7 max for form + Valid H2H matches)
            const trueHomeSample = Math.min(team1Events?.length || 0, 7);
            const trueAwaySample = Math.min(team2Events?.length || 0, 7);
            const directH2HValidCount = (h2hData?.events || []).filter(m => (nowMs - (m.startTimestamp * 1000)) <= THREE_YEARS_MS).length;

            const homeMatchesSample = trueHomeSample + directH2HValidCount;
            const awayMatchesSample = trueAwaySample + directH2HValidCount;

            h2hStats.homeWinRate = Math.min(1.0, h2hStats.homeWins / (homeMatchesSample > 0 ? homeMatchesSample : 1));
            h2hStats.awayWinRate = Math.min(1.0, h2hStats.awayWins / (awayMatchesSample > 0 ? awayMatchesSample : 1));

            // Re-calculate pure direct H2H for exact draws indicator
            let directDraws = 0, directValid = 0;
            if (h2hData && h2hData.events) {
                h2hData.events.forEach(m => {
                    const matchTimeMs = m.startTimestamp * 1000;
                    if ((nowMs - matchTimeMs) <= THREE_YEARS_MS && m.homeScore?.current !== undefined) {
                        directValid++;
                        if (m.homeScore.current === m.awayScore?.current) directDraws++;
                    }
                });
            }
            h2hStats.draws = directDraws;
            h2hStats.directValidUrl = directValid;
        }

        // 4. Moteur de prédictions (Protocole 3 & Phase 9 Live)
        const contextMock = { home_enjeu_score: 5, away_enjeu_score: 5, narrative: "Analyse experte via base de données avancée Sofascore." };

        // [Phase 15: Omni-Market Deep Data] Fetch Lineups to empower Goalscorer markets
        const lineupsRaw = await apiService.getLineups(fixtureId);
        let lineups = { home: [], away: [] };
        try {
            if (lineupsRaw.home?.players) lineups.home = lineupsRaw.home.players.map(p => ({ name: p.player.name, position: p.player.position, rating: p.statistics?.rating || null }));
            if (lineupsRaw.away?.players) lineups.away = lineupsRaw.away.players.map(p => ({ name: p.player.name, position: p.player.position, rating: p.statistics?.rating || null }));
        } catch (e) { console.log("[LINEUPS] Error extracting lineups"); }

        // Pass lineups to scan metrics so scoringService can read them
        mirrorScan.metrics.lineups = lineups;

        let predictions = [];
        let isLive = false;

        if (matchInfo.status?.type === 'inprogress') {
            isLive = true;
            console.log(`[LIVE ENGINE] Match en cours détecté ! Activation du Live Scoring Service...`);

            // Fetch real-time deep stats (Possession, Shots)
            const liveStatsRaw = await apiService.getLiveStatistics(fixtureId);
            let possession = { home: '50%', away: '50%' };
            let shotsOnTarget = { home: 0, away: 0 };

            try {
                // Sofascore stats array has periods. Usually period 'ALL' is at index 0
                const allStats = liveStatsRaw.find(s => s.period === 'ALL')?.groups || [];

                // Extract Possession
                const possGroup = allStats.find(g => g.groupName === 'Possession')?.statisticsItems || [];
                const possItem = possGroup.find(i => i.name === 'Ball possession');
                if (possItem) {
                    possession.home = possItem.home;
                    possession.away = possItem.away;
                }

                // Extract Shots on Target
                const shotsGroup = allStats.find(g => g.groupName === 'Shots')?.statisticsItems || [];
                const shotsItem = shotsGroup.find(i => i.name === 'Shots on target');
                if (shotsItem) {
                    shotsOnTarget.home = parseInt(shotsItem.home) || 0;
                    shotsOnTarget.away = parseInt(shotsItem.away) || 0;
                }
            } catch (e) {
                console.log("[LIVE STATS] Error parsing live statistics, proceeding with basics.");
            }

            const liveData = {
                minute: matchInfo.status?.description ? parseInt(matchInfo.status.description) : 45,
                scoreHome: matchInfo.homeScore?.current || 0,
                scoreAway: matchInfo.awayScore?.current || 0,
                status: matchInfo.status?.description || 'En cours',
                possession: possession,
                shotsOnTarget: shotsOnTarget
            };
            predictions = liveScoringService.generateLivePredictions(mirrorScan, h2hStats, contextMock, liveData); // Passing processed H2H
        } else {
            predictions = scoringService.classifyPredictions(mirrorScan, h2hStats, contextMock); // Passing processed H2H
        }


        // --- GENERATE PRE-MATCH SPEECH ---
        const preMatchSpeech = mirrorScanService.generatePreMatchSpeech(
            homeName,
            awayName,
            mirrorScan.metrics,
            contextMock
        );

        // 5. Structure de Sortie Technique (Protocole 4) - Format attendu par le Frontend actuel
        const responseFormat = {
            isLive: isLive, // Flag for the frontend to show red flashing UI
            match_info: {
                id: fixtureId,
                league: apiService.translateTournamentName(matchInfo.tournament?.name || "Ligue"),
                date: (matchInfo.startTimestamp ? new Date(matchInfo.startTimestamp * 1000).toISOString() : new Date().toISOString()),
                live_minute: (() => {
                    if (isLive && matchInfo.time && matchInfo.time.currentPeriodStartTimestamp) {
                        const elapsedSeconds = Math.floor(Date.now() / 1000) - matchInfo.time.currentPeriodStartTimestamp;
                        const initialMinutes = (matchInfo.time.initial || 0) / 60;
                        const currentMinute = Math.floor(elapsedSeconds / 60) + initialMinutes;
                        const isHT = matchInfo.status?.description === 'Halftime';
                        if (isHT) return 'MT';
                        return `${currentMinute}'`;
                    }
                    if (isLive && matchInfo.status?.description) {
                        const desc = matchInfo.status.description;
                        if (desc === 'Halftime') return 'MT';
                        if (desc === '1st half') return '1ère MT';
                        if (desc === '2nd half') return '2ème MT';
                        return desc;
                    }
                    return null;
                })(),
                home: {
                    name: homeName,
                    logo: `https://api.sofascore.app/api/v1/team/${homeTeamId}/image`
                },
                away: {
                    name: awayName,
                    logo: `https://api.sofascore.app/api/v1/team/${awayTeamId}/image`
                }
            },
            standings_context: {
                narrative: contextMock.narrative,
                speech: preMatchSpeech, // NOUVEAU: Le speech IA
                home_enjeu_score: contextMock.home_enjeu_score,
                away_enjeu_score: contextMock.away_enjeu_score,
            },
            mirror_scan_report: mirrorScan.report,
            predictions: predictions
        };

        // --- SAUVEGARDE EN CACHE / ARCHIVAGE DB ---
        const newAnalysis = new Prediction({
            fixture_id: String(fixtureId),
            match_info: {
                league: responseFormat.match_info.league,
                date: responseFormat.match_info.date.replace('T', ' ').substring(0, 16),
                home_name: homeName,
                away_name: awayName,
            },
            pre_match_stats: {
                home_enjeu_score: contextMock.home_enjeu_score,
                away_enjeu_score: contextMock.away_enjeu_score,
                advantage_A: mirrorScan.metrics.advantageA,
                advantage_B: mirrorScan.metrics.advantageB,
                pre_match_speech: preMatchSpeech,
            },
            ai_predictions: predictions,
            actual_result: { status: 'PENDING' },
            raw_response: responseFormat
        });
        await newAnalysis.save();
        console.log(`[DB SAVE] L'archive complète du match ${fixtureId} a été sauvegardée pour apprentissage futur.`);
        // ---------------------------

        res.json({
            message: "Nouvelle analyse générée et mise en cache",
            data: responseFormat
        });

    } catch (error) {
        console.error("[Ultra-Scanner Error]", error);
        res.status(500).json({ error: 'Erreur lors de la génération de l\'analyse', details: error.message });
    }
};

/**
 * Controller pour analyser un Duel Personnalisé (sans match officiel)
 * Route : /api/analysis/duel?homeTeamId=X&awayTeamId=Y&homeName=A&awayName=B
 */
exports.analyzeDuel = async (req, res) => {
    try {
        const { homeTeamId, awayTeamId, homeName, awayName, homeLogo, awayLogo, date } = req.query;

        if (!homeTeamId || !awayTeamId) {
            return res.status(400).json({ error: 'homeTeamId et awayTeamId requis' });
        }

        const duelId = `duel_${homeTeamId}_${awayTeamId}`;

        // --- SYSTEME DE CACHE OBLIGATOIRE ---
        const Prediction = require('../models/Prediction');
        const existingAnalysis = await Prediction.findOne({ fixture_id: duelId });

        if (existingAnalysis && existingAnalysis.raw_response) {
            console.log(`[CACHE HIT] Renvoi de l'analyse Duel ${duelId} depuis MongoDB !`);

            return res.json({
                message: "Analyse Duel récupérée depuis le Cache (0 requête API)",
                data: existingAnalysis.raw_response
            });
        }
        console.log(`[CACHE MISS] Analyse Duel ${duelId} introuvable. Lancement requête API...`);
        // ------------------------------------

        // --- VRAIE ANALYSE IA POUR DUEL PERSONNALISÉ ---
        const apiService = require('../services/apiFootballService');
        const mirrorScanService = require('../services/mirrorScanService');
        const scoringService = require('../services/scoringService');

        // 1. Récupération Forme Récente (Puisque getH2H nécessite un eventId Sofascore)
        // Pour un duel sans match officiel, on se base sur les 5 derniers matchs pour simuler les stats
        const homeEvents = await apiService.getTeamLastEvents(homeTeamId);
        const awayEvents = await apiService.getTeamLastEvents(awayTeamId);

        // helper logic to calculate average goals from recent events
        const extractAvgStats = (events, tId, isHomeNode) => {
            if (!events || events.length === 0) return { goals: { for: { average: { home: 1.0, away: 1.0 } }, against: { average: { home: 1.0, away: 1.0 } } } };
            let scored = 0, conceded = 0;
            events.slice(0, 5).forEach(e => {
                const isH = e.homeTeam.id == tId;
                scored += isH ? (e.homeScore?.current || 0) : (e.awayScore?.current || 0);
                conceded += isH ? (e.awayScore?.current || 0) : (e.homeScore?.current || 0);
            });
            const cap = events.length > 5 ? 5 : events.length;
            const avgS = scored / cap;
            const avgC = conceded / cap;

            return {
                goals: {
                    for: { average: isHomeNode ? { home: avgS } : { away: avgS } },
                    against: { average: isHomeNode ? { home: avgC } : { away: avgC } }
                }
            };
        };

        const homeStats = extractAvgStats(homeEvents, homeTeamId, true);
        const awayStats = extractAvgStats(awayEvents, awayTeamId, false);
        const h2hData = []; // Fallback empty H2H since we don't have Sofascore Event ID for a synthetic duel

        // 3. Vrai Scan Miroir
        const mirrorScan = mirrorScanService.runMirrorScan(homeStats, awayStats);

        // 4. Vrais Enjeux basés sur l'historique direct
        // Plus ils ont de matchs H2H, plus l'enjeu monte (Rivalité)
        const rivalryScore = h2hData.length > 5 ? 8.0 : 5.0;
        const context = {
            home_enjeu_score: rivalryScore,
            away_enjeu_score: rivalryScore,
            narrative: `Duel Historique : ${h2hData.length} confrontations recensées.`
        };

        // 5. Vraies Prédictions
        let predictions = scoringService.classifyPredictions(mirrorScan, h2hData, context);

        // Removed fallback, rely entirely on scoringService dynamic generation

        // --- GENERATE PRE-MATCH SPEECH ---
        const preMatchSpeech = mirrorScanService.generatePreMatchSpeech(
            homeName || `Team ${homeTeamId}`,
            awayName || `Team ${awayTeamId}`,
            mirrorScan.metrics,
            context
        );

        const responseFormat = {
            match_info: {
                id: duelId,
                league: "Duel Personnalisé",
                date: date || new Date().toISOString().substring(0, 16), // Affiche YYYY-MM-DDTHH:mm
                home: {
                    name: homeName || `Team ${homeTeamId}`,
                    logo: homeLogo || "https://media.api-sports.io/football/teams/42.png" // Fallback logo
                },
                away: {
                    name: awayName || `Team ${awayTeamId}`,
                    logo: awayLogo || "https://media.api-sports.io/football/teams/35.png" // Fallback logo
                }
            },
            standings_context: {
                narrative: context.narrative,
                speech: preMatchSpeech, // NOUVEAU: Le speech IA
                home_enjeu_score: context.home_enjeu_score,
                away_enjeu_score: context.away_enjeu_score,
            },
            mirror_scan_report: mirrorScan.report,
            predictions: predictions
        };

        const defaultHomeName = homeName || `Team ${homeTeamId}`;
        const defaultAwayName = awayName || `Team ${awayTeamId}`;
        const safeDate = date || new Date().toISOString().substring(0, 16);

        // --- SAUVEGARDE EN CACHE / ARCHIVAGE DB ---
        const newAnalysis = new Prediction({
            fixture_id: duelId,
            match_info: {
                league: "Duel Personnalisé",
                date: safeDate,
                home_name: defaultHomeName,
                away_name: defaultAwayName,
            },
            pre_match_stats: {
                home_enjeu_score: context.home_enjeu_score || 0,
                away_enjeu_score: context.away_enjeu_score || 0,
                advantage_A: mirrorScan.metrics.advantageA,
                advantage_B: mirrorScan.metrics.advantageB,
                pre_match_speech: preMatchSpeech,
            },
            ai_predictions: predictions,
            actual_result: { status: 'PENDING' },
            raw_response: responseFormat
        });
        await newAnalysis.save();
        console.log(`[DB SAVE] L'archive du Duel ${duelId} a été sauvegardée pour apprentissage.`);
        // ---------------------------

        res.json({
            message: "Analyse Duel Personnalisé générée et mise en cache",
            data: responseFormat
        });

    } catch (error) {
        console.error("[Duel Analysis Error]", error);
        res.status(500).json({ error: 'Erreur lors de la génération du duel' });
    }
};

/**
 * Controller MOCK pour tester la structure sans requêtes API réelles
 */
exports.generateMockAnalysis = async (req, res) => {
    try {
        const { fixtureId } = req.params;

        // Simulation d'une analyse 
        const responseFormat = {
            match_info: {
                id: fixtureId,
                league: "Premier League (Mock)",
                date: new Date().toISOString(),
                home: {
                    name: "Arsenal (Mock)",
                    logo: "https://media.api-sports.io/football/teams/42.png"
                },
                away: {
                    name: "Bournemouth (Mock)",
                    logo: "https://media.api-sports.io/football/teams/35.png"
                }
            },
            standings_context: {
                narrative: "Tension: H(9.5) vs A(3.0) - Course au titre vs Maintien assuré",
                home_enjeu_score: 9.5,
                away_enjeu_score: 3.0,
            },
            mirror_scan_report: "Scenario: DOMINATION_A. A exp: 2.10, B exp: 0.80",
            predictions: [
                {
                    category: "Général", market: "Handicap Positif", selection: "Domicile -0.5", confidence: 92,
                    justification: {
                        mirror_scan: "Scénario de domination nette sans contradiction statistique. L'équipe locale est très supérieure offensivement (Att: 2.10 vs 0.80).",
                        context_impact: "L'enjeu est parfaitement aligné avec la domination statistique. L'équipe locale DOIT absolument remporter ce match."
                    }
                },
                {
                    category: "Général", market: "Buts par Équipe", selection: "Domicile Plus de 1.5", confidence: 80,
                    justification: {
                        mirror_scan: "Statistiques secondaires excellentes face à l'urgence de résultat.",
                        context_impact: "L'équipe locale subit une grosse pression (Enjeu > 8/10) l'obligeant à attaquer fort."
                    }
                }
            ]
        };

        res.json(responseFormat);

    } catch (error) {
        res.status(500).json({ error: 'Erreur Simulation' });
    }
};

/**
 * Controller pour récupérer l'historique d'apprentissage de l'IA (Track Record)
 * Route : GET /api/analysis/history
 */
exports.getHistory = async (req, res) => {
    try {
        const Prediction = require('../models/Prediction');
        const evaluationService = require('../services/evaluationService');
        // Récupérer tout l'historique du plus récent au plus ancien
        const history = await Prediction.find({}).sort({ createdAt: -1 });

        const processedHistory = await Promise.all(history.map(async record => {
            const doc = record.toObject();

            // Phase 4: Auto-sync pending & live matches
            if (doc.actual_result && (doc.actual_result.status === 'PENDING' || doc.actual_result.status === 'INPROGRESS')) {
                if (doc.fixture_id && !String(doc.fixture_id).startsWith('duel') && doc.match_info && doc.match_info.date) {
                    const docDate = new Date(doc.match_info.date);
                    const now = new Date();
                    const diffHours = (now - docDate) / (1000 * 60 * 60);

                    // Si le match a théoriquement commencé (offset -2h) ou est très vieux, on cherche son vrai statut final
                    if (diffHours > -2) {
                        try {
                            const apiService = require('../services/apiFootballService');
                            const freshData = await apiService.getMatchDetails(doc.fixture_id);
                            if (freshData && freshData.status) {
                                if (freshData.status.type === 'finished' || freshData.status.type === 'inprogress') {
                                    doc.actual_result.status = freshData.status.type === 'finished' ? 'COMPLETED' : 'INPROGRESS';
                                    doc.actual_result.home_goals = freshData.homeScore?.current || 0;
                                    doc.actual_result.away_goals = freshData.awayScore?.current || 0;

                                    if (freshData.homeScore?.period1 !== undefined) {
                                        doc.actual_result.home_goals_ht = freshData.homeScore.period1;
                                        doc.actual_result.away_goals_ht = freshData.awayScore.period1;
                                    }

                                    // Parse live minute
                                    if (freshData.status.type === 'inprogress') {
                                        if (freshData.time && freshData.time.currentPeriodStartTimestamp) {
                                            const elapsed = Math.floor(Date.now() / 1000) - freshData.time.currentPeriodStartTimestamp;
                                            const init = (freshData.time.initial || 0) / 60;
                                            doc.actual_result.live_minute = `${Math.floor(elapsed / 60) + init}'`;
                                            // Provide raw unix data to Frontend for active MM:SS pulse
                                            doc.actual_result.live_timestamp = freshData.time.currentPeriodStartTimestamp;
                                            doc.actual_result.live_initial = freshData.time.initial || 0;
                                        } else {
                                            doc.actual_result.live_minute = freshData.status?.description === 'Halftime' ? 'MT' : 'En Cours';
                                        }
                                    }

                                    // Fetch deep stats for Live and Finished matches
                                    try {
                                        // Default to 0 before fetching. If API fails, it remains null. If it succeeds but omits them, it means 0 occurred.
                                        doc.actual_result.home_corners = 0; doc.actual_result.away_corners = 0;
                                        doc.actual_result.home_yellow_cards = 0; doc.actual_result.away_yellow_cards = 0;

                                        const stats = await apiService.getLiveStatistics(doc.fixture_id);
                                        if (stats && stats.length > 0) {
                                            const allGroup = stats.find(s => s.period === 'ALL');
                                            if (allGroup && allGroup.groups) {
                                                allGroup.groups.forEach(g => {
                                                    g.statisticsItems.forEach(item => {
                                                        if (item.name === 'Corner kicks') { doc.actual_result.home_corners = parseInt(item.home) || 0; doc.actual_result.away_corners = parseInt(item.away) || 0; }
                                                        if (item.name === 'Yellow cards') { doc.actual_result.home_yellow_cards = parseInt(item.home) || 0; doc.actual_result.away_yellow_cards = parseInt(item.away) || 0; }
                                                    });
                                                });
                                            }
                                        }
                                    } catch (e) {
                                        // Revert to null if network fails so we don't falsely evaluate
                                        doc.actual_result.home_corners = null; doc.actual_result.away_corners = null;
                                        doc.actual_result.home_yellow_cards = null; doc.actual_result.away_yellow_cards = null;
                                    }

                                    // Evaluer dynamiquement avant la sauvegarde LIVE
                                    if (doc.ai_predictions) {
                                        for (let i = 0; i < doc.ai_predictions.length; i++) {
                                            doc.ai_predictions[i].is_won = evaluationService.evaluatePrediction(doc.ai_predictions[i], doc.actual_result);
                                        }
                                    }

                                    // Save to DB
                                    await Prediction.updateOne(
                                        { _id: doc._id },
                                        {
                                            $set: {
                                                actual_result: doc.actual_result,
                                                ai_predictions: doc.ai_predictions
                                            }
                                        }
                                    );
                                }
                            }
                        } catch (e) {
                            console.error("Live history sync failed for", doc.fixture_id);
                        }
                    }
                }
            }

            if (doc.actual_result && (doc.actual_result.status === 'COMPLETED' || doc.actual_result.status === 'INPROGRESS')) {
                if (doc.ai_predictions && doc.ai_predictions.length > 0) {
                    for (let i = 0; i < doc.ai_predictions.length; i++) {
                        doc.ai_predictions[i].is_won = evaluationService.evaluatePrediction(doc.ai_predictions[i], doc.actual_result);
                    }
                }
            }

            // Appliquer le traducteur sur l'historique déjà sauvegardé (Retrocompatibilité)
            if (doc.match_info && doc.match_info.league) {
                doc.match_info.league = apiService.translateTournamentName(doc.match_info.league);
            }
            if (doc.raw_response && doc.raw_response.match_info && doc.raw_response.match_info.league) {
                doc.raw_response.match_info.league = apiService.translateTournamentName(doc.raw_response.match_info.league);
            }

            return doc;
        }));

        // Calcul éventuel de statistiques globales (Winrate) si on voulait (Phase 4)
        const totalMatches = processedHistory.length;

        res.json({
            message: "Historique des analyses récupéré avec succès",
            stats: { totalMatches },
            data: processedHistory
        });

    } catch (error) {
        console.error("[History Error]", error);
        res.status(500).json({ error: 'Erreur lors de la récupération de l\'historique.' });
    }
};

exports.deleteHistory = async (req, res) => {
    try {
        const Prediction = require('../models/Prediction');
        const { id } = req.params;
        const result = await Prediction.findByIdAndDelete(id);
        if (!result) {
            return res.status(404).json({ error: "Archive introuvable." });
        }
        res.json({ message: "Archive supprimée avec succès." });
    } catch (error) {
        console.error("[Delete History Error]", error);
        res.status(500).json({ error: "Erreur serveur lors de la suppression." });
    }
};
