const apiService = require('./apiFootballService');

exports.analyzeMatchContext = async (fixtureId) => {
    // Protocol 1: H2H vs Recent Form and EnjeuScore calculation
    const match = await apiService.getMatchDetails(fixtureId);
    if (!match) throw new Error('Match not found');

    const homeTeamId = match.match_hometeam_id;
    const awayTeamId = match.match_awayteam_id;
    const leagueId = match.league_key;

    const h2hData = await apiService.getH2H(homeTeamId, awayTeamId);

    let dataFocus = 'H2H';
    let matchesToAnalyze = [];

    if (h2hData.length >= 5) {
        // Top priority: analyze last 5
        matchesToAnalyze = h2hData.slice(0, 5);
    } else if (h2hData.length > 0) {
        matchesToAnalyze = h2hData;
    } else {
        // Fallback: Recent form
        dataFocus = 'RecentForm';
        // Needs to fetch individual team forms
    }

    // Next step: Calculate EnjeuScore using standings
    const homeStandingInfo = await apiService.getStandings(leagueId);

    let homeStanding = null;
    let awayStanding = null;

    if (homeStandingInfo && homeStandingInfo.length > 0) {
        homeStanding = homeStandingInfo.find(s => s.team_key === homeTeamId);
        awayStanding = homeStandingInfo.find(s => s.team_key === awayTeamId);
    }

    const enjeuService = require('./enjeuService');
    const home_enjeu_score = enjeuService.calculateEnjeuScore(homeStanding, homeStandingInfo);
    const away_enjeu_score = enjeuService.calculateEnjeuScore(awayStanding, homeStandingInfo);

    return {
        fixtureId,
        dataFocus,
        matchesToAnalyze,
        context: {
            home_enjeu_score,
            away_enjeu_score,
            narrative: `Tension: H(${home_enjeu_score.toFixed(1)}) vs A(${away_enjeu_score.toFixed(1)})`
        }
    };
};
