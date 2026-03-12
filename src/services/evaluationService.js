/**
 * Évalue si une prédiction est gagnante ou perdante selon le vrai score et les stats profondes
 * @param {Object} prediction L'objet Prediction (Généré par Gemini)
 * @param {Object} actualResult - Les résultats réels téléchargés par le CRON
 * @returns {Boolean} true si Gagné, false si Perdu, null si non géré ou en attente
 */
exports.evaluatePrediction = (prediction, actualResult) => {
    try {
        const { market, selection } = prediction;
        const { home_goals: homeA, away_goals: awayB, home_goals_ht: homeHT, away_goals_ht: awayHT, status, live_minute, incidents, home_corners, away_corners, home_yellow_cards, away_yellow_cards } = actualResult || {};
        const totalGoals = homeA + awayB;

        const htHasScore = homeHT !== undefined && homeHT !== null;
        const isCompleted = status === 'COMPLETED';

        // Determine if Half-Time is genuinely over
        let isHTOver = isCompleted;
        if (status === 'INPROGRESS' && live_minute) {
            const lmStr = String(live_minute).toLowerCase();
            if (lmStr === 'mt' || lmStr === 'ht' || lmStr.includes('half') || lmStr.includes('mi-temps')) {
                isHTOver = true;
            } else {
                const parsedMin = parseInt(lmStr);
                if (!isNaN(parsedMin) && parsedMin > 45) isHTOver = true;
            }
        }

        const htPlayed = isHTOver && htHasScore;

        const selUpper = selection.toUpperCase();
        const marketUpper = market.toUpperCase();

        // --- 1. JOUERS (BUTEURS) ---
        if (marketUpper.includes("BUTEUR")) {
            if (!isCompleted) return null; // Attendre la fin pour être sûr, sauf si déjà marqué? Pour garder simple : fin du match
            if (!incidents || !Array.isArray(incidents)) return null; // Requiert les stats profondes

            const goalIncidents = incidents.filter(i => i.incidentType === 'goal');

            // Fuzzy match du nom du joueur (La selection contient le nom du joueur, ex: "Kylian Mbappé")
            // On cherche si un des noms de buteurs correspond partiellement au nom proposé
            const playerScored = goalIncidents.some(g => {
                if (!g.player || !g.player.name) return false;
                const scorerName = g.player.name.toUpperCase();
                // Ex: "Mbappé" dans "Kylian Mbappé" ou inversement
                return selUpper.includes(scorerName) || scorerName.includes(selUpper);
            });

            if (marketUpper === 'BUTEUR À TOUT MOMENT' || marketUpper === 'BUTEUR') {
                return playerScored;
            }

            if (marketUpper === 'PREMIER BUTEUR') {
                if (goalIncidents.length === 0) return false;
                const firstGoal = goalIncidents[0]; // Chronométré par Sofascore
                if (!firstGoal.player || !firstGoal.player.name) return false;
                const scorerName = firstGoal.player.name.toUpperCase();
                return selUpper.includes(scorerName) || scorerName.includes(selUpper);
            }

            return null;
        }

        // --- 2. DOUBLE CHANCE & RESULTAT ---
        if (marketUpper === 'DOUBLE CHANCE') {
            if (!isCompleted) return null;
            if (selUpper.includes('DOMICILE OU NUL') || selUpper.includes('1X')) return homeA >= awayB;
            if (selUpper.includes('EXTÉRIEUR OU NUL') || selUpper.includes('X2')) return awayB >= homeA;
            if (selUpper.includes('DOMICILE OU EXTÉRIEUR') || selUpper.includes('12')) return homeA !== awayB;
        }

        if (marketUpper.includes('1X2') || marketUpper.includes('RÉSULTAT FINAL')) {
            if (!isCompleted) return null;
            if (selUpper.includes('VICTOIRE DOMICILE') || selUpper.includes(' 1 ') || selUpper === '1') return homeA > awayB;
            if (selUpper.includes('VICTOIRE EXTÉRIEUR') || selUpper.includes(' 2 ') || selUpper === '2') return awayB > homeA;
            if (selUpper.includes('MATCH NUL') || selUpper === 'X') return homeA === awayB;
        }

        if (marketUpper === 'DRAW NO BET' || marketUpper === 'REMBOURSÉ SI NUL') {
            if (homeA === awayB) return isCompleted ? null : null; // Refunded -> null for Winrate neutrality
            if (!isCompleted) return null;
            if (selUpper.includes('DOMICILE')) return homeA > awayB;
            if (selUpper.includes('EXTÉRIEUR')) return awayB > homeA;
        }

        // --- 3. TOTAL DE BUTS ---
        if (marketUpper.includes('TOTAL DE BUTS') || marketUpper === 'OVER/UNDER (LIVE)') {
            let limitMatch = selUpper.match(/\d+(\.\d+)?/);
            if (!limitMatch) return null;
            let limit = parseFloat(limitMatch[0]);

            if (selUpper.includes('PLUS DE')) return totalGoals > limit ? true : (isCompleted ? false : null);
            if (selUpper.includes('MOINS DE')) return totalGoals < limit ? (isCompleted ? true : null) : false; // Early false si dépassé
        }

        // --- 4. LES 2 EQUIPES MARQUENT (BTTS) ---
        if (marketUpper.includes('LES 2 ÉQUIPES MARQUENT') || marketUpper.includes('BTTS')) {
            const hasScored = (homeA > 0 && awayB > 0);
            if (selUpper.includes('OUI')) return hasScored ? true : (isCompleted ? false : null);
            if (selUpper.includes('NON')) return hasScored ? false : (isCompleted ? true : null);
        }

        // --- 5. SCORE EXACT ---
        if (marketUpper.includes('SCORE EXACT')) {
            if (!isCompleted) return null;
            const realScore = `${homeA}-${awayB}`;
            const scoresProposes = selUpper.split(' OU ').map(s => s.trim());
            return scoresProposes.includes(realScore);
        }

        // --- 6. MATCH COMBINÉ (Regex Parser) ---
        if (marketUpper.includes('COMBINÉ') || marketUpper.includes('COMBO') || marketUpper.includes('RÉSULTAT +')) {
            if (!isCompleted) return null;
            let resultPartWon = false;
            let goalsPartWon = true;

            // Result eval
            if (selUpper.includes('DOMICILE') || selUpper.includes(' 1 ') || selUpper.match(/^1\s/)) resultPartWon = homeA > awayB;
            else if (selUpper.includes('EXTÉRIEUR') || selUpper.includes(' 2 ') || selUpper.match(/^2\s/)) resultPartWon = awayB > homeA;
            else if (selUpper.includes('NUL') || selUpper.includes(' X ') || selUpper.match(/^X\s/)) resultPartWon = homeA === awayB;
            else if (selUpper.includes('1X')) resultPartWon = homeA >= awayB;
            else if (selUpper.includes('X2')) resultPartWon = awayB >= homeA;
            else if (selUpper.includes('12')) resultPartWon = homeA !== awayB;
            else resultPartWon = true; // S'il n'y a pas de composante résultat clair

            // Over/Under eval
            let limitMatch = selUpper.match(/\d+(\.\d+)?/);
            if (limitMatch && (selUpper.includes('+') || selUpper.includes('PLUS') || selUpper.includes('-') || selUpper.includes('MOINS'))) {
                let limit = parseFloat(limitMatch[0]);
                if (selUpper.includes('+') || selUpper.includes('PLUS')) goalsPartWon = totalGoals > limit;
                if (selUpper.includes('-') || selUpper.includes('MOINS')) goalsPartWon = totalGoals < limit;
            }

            // BTTS eval in Combiné
            if (selUpper.includes('BTTS: OUI') || selUpper.includes('2 ÉQUIPES MARQUENT')) goalsPartWon = goalsPartWon && (homeA > 0 && awayB > 0);

            return resultPartWon && goalsPartWon;
        }

        // --- 7. MARCHES MI-TEMPS ---
        if (marketUpper.includes('BUT EN 1ÈRE') || marketUpper.includes('BUTS 1ÈRE')) {
            let limitMatch = selUpper.match(/\d+(\.\d+)?/);
            if (!limitMatch) return null;
            let limit = parseFloat(limitMatch[0]);

            if (selUpper.includes('PLUS DE')) {
                if (htPlayed) return (homeHT + awayHT) > limit;
                if (totalGoals > limit) return true; // Early win
                if (isHTOver) return false;
                return null;
            }
        }

        if (marketUpper.includes('RÉSULTAT À LA MI-TEMPS') || marketUpper === 'RÉSULTAT MT') {
            if (!isHTOver) return null;
            const h = htPlayed ? homeHT : 0;
            const a = htPlayed ? awayHT : 0;
            if (selUpper.includes('DOMICILE') || selUpper === '1') return h > a;
            if (selUpper.includes('EXTÉRIEUR') || selUpper === '2') return a > h;
            if (selUpper.includes('NUL') || selUpper === 'X') return h === a;
        }

        // --- 8. CORNERS ET CARTONS (Discipline) ---
        if (marketUpper.includes('CORNERS') || marketUpper.includes('PROCHAIN CORNER')) {
            if (home_corners == null || away_corners == null) return null; // CRON doit extraire ça
            if (!isCompleted) return null;
            const totalC = home_corners + away_corners;
            let limitMatch = selUpper.match(/\d+(\.\d+)?/);
            if (!limitMatch) return null;
            let limit = parseFloat(limitMatch[0]);

            if (selUpper.includes('PLUS DE') || selUpper.includes('+')) return totalC > limit;
            if (selUpper.includes('MOINS DE') || selUpper.includes('-')) return totalC < limit;
        }

        if (marketUpper.includes('CARTONS')) {
            if (home_yellow_cards == null || away_yellow_cards == null) return null;
            if (!isCompleted) return null;
            const totalY = home_yellow_cards + away_yellow_cards; // Simplification (Rouge = 1 ou 2 selon livrets, mais gardons brut)
            let limitMatch = selUpper.match(/\d+(\.\d+)?/);
            if (!limitMatch) return null;
            let limit = parseFloat(limitMatch[0]);

            if (selUpper.includes('PLUS DE') || selUpper.includes('+')) return totalY > limit;
            if (selUpper.includes('MOINS DE') || selUpper.includes('-')) return totalY < limit;
        }

        return null;

    } catch (err) {
        console.error("[EvaluationEngine] Erreur parser Regex Omni-Market:", err);
        return null;
    }
};
