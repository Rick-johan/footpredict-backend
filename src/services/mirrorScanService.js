// Protocol 2: Mirror Scan Engine
// Security Anti-Error: Must cross Attack A vs Defense B, Defense A vs Attack B

/**
 * Compare les statistiques offensives et défensives de deux équipes
 * @param {Object} teamAStats - form et avg goals de A (depuis 'teams/statistics')
 * @param {Object} teamBStats - form et avg goals de B (depuis 'teams/statistics')
 */
exports.runMirrorScan = (teamAStats, teamBStats) => {
    // Extract averages
    // Structure attendue de l'API: stats.goals.for.average.home
    const attackA_avg = parseFloat(teamAStats?.goals?.for?.average?.home || 1.0);
    const defenseB_avg = parseFloat(teamBStats?.goals?.against?.average?.away || 1.0);

    const attackB_avg = parseFloat(teamBStats?.goals?.for?.average?.away || 1.0);
    const defenseA_avg = parseFloat(teamAStats?.goals?.against?.average?.home || 1.0);

    // xG (Expected Goals) Proxy - Si on n'a pas les vrais xG, on peut simuler
    // avec les tirs cadrés si dispos, sinon on reste sur la moyenne.

    // Calcul du Delta d'avantage
    const advantageA = (attackA_avg + defenseB_avg) / 2; // Buts potentiels pour A
    const advantageB = (attackB_avg + defenseA_avg) / 2; // Buts potentiels pour B

    // Seuils de Domination
    const DOMINATION_THRESHOLD = 1.6; // Moyenne de 1.6 buts ou +
    const SOLIDITY_THRESHOLD = 0.9;   // Encaisse moins de 0.9 buts

    const isA_Dominating = advantageA >= DOMINATION_THRESHOLD && defenseB_avg >= 1.2;
    const isB_Dominating = advantageB >= DOMINATION_THRESHOLD && defenseA_avg >= 1.2;

    // Détection de contradiction (Les deux marquent beaucoup et encaissent peu)
    // Ou l'inverse : aucun ne marque.
    let contradiction = false;
    let scenario = 'STANDARD';

    if (isA_Dominating && isB_Dominating) {
        contradiction = true;
        scenario = 'OVER_EXPECTED'; // Ça peut faire 3-3 ou 0-0 fermé
    } else if (advantageA < 1.0 && advantageB < 1.0 && defenseA_avg < SOLIDITY_THRESHOLD && defenseB_avg < SOLIDITY_THRESHOLD) {
        contradiction = true;
        scenario = 'UNDER_EXPECTED'; // Très peu de buts attendus, match potentiellement fermé
    } else if (isA_Dominating && !isB_Dominating && defenseA_avg < SOLIDITY_THRESHOLD) {
        scenario = 'DOMINATION_A';
    } else if (isB_Dominating && !isA_Dominating && defenseB_avg < SOLIDITY_THRESHOLD) {
        scenario = 'DOMINATION_B';
    }

    return {
        metrics: {
            advantageA: Number(advantageA.toFixed(2)),
            advantageB: Number(advantageB.toFixed(2))
        },
        isA_Dominating,
        isB_Dominating,
        contradiction,
        scenario,
        report: `Scenario: ${scenario}. A exp: ${advantageA.toFixed(2)}, B exp: ${advantageB.toFixed(2)}`
    };
};

/**
 * Génère un discours d'avant-match basé sur les statistiques et l'enjeu.
 * @param {String} homeName 
 * @param {String} awayName 
 * @param {Object} metrics - advantageA et advantageB
 * @param {Object} context - home_enjeu_score, narrative
 * @returns {String} Le paragraphe en français
 */
exports.generatePreMatchSpeech = (homeName, awayName, metrics, context) => {
    const advA = metrics.advantageA;
    const advB = metrics.advantageB;
    const enjeu = context.home_enjeu_score || 5.0;

    const safeHome = homeName && homeName !== 'undefined' ? homeName : "L'équipe locale";
    const safeAway = awayName && awayName !== 'undefined' ? awayName : "l'équipe visiteuse";

    let speech = `${safeHome} affronte ${safeAway} `;

    // Contexte d'enjeu
    if (enjeu >= 8.0) speech += `dans un choc sous haute tension où le résultat est crucial. `;
    else if (enjeu <= 4.0) speech += `dans une rencontre de fin de tableau ou sans enjeu majeur. `;
    else speech += `dans un match régulier de championnat. `;

    // Force Offensive Domicile
    if (advA >= 1.6) speech += `${safeHome} affiche une force de frappe impressionnante (${advA.toFixed(1)} buts attendus) `;
    else if (advA < 1.0) speech += `L'attaque de ${safeHome} est actuellement en difficulté (${advA.toFixed(1)} buts attendus) `;
    else speech += `${safeHome} présente un potentiel offensif dans la moyenne (${advA.toFixed(1)} buts attendus) `;

    // Force Offensive Extérieur
    if (advB >= 1.6) speech += `et devra se méfier d'une équipe adverse redoutable en contre (${advB} buts espérés). `;
    else if (advB < 1.0) speech += `face à des visiteurs peinant à trouver le chemin des filets en déplacement (${advB} buts espérés). `;
    else speech += `contre des visiteurs capables de marquer à tout moment (${advB} buts espérés). `;

    // Conclusion de scénario
    const totalGoals = advA + advB;
    if (totalGoals > 2.8) speech += `L'algorithme Ultra-Scanner anticipe un match très ouvert avec de multiples occasions.`;
    else if (totalGoals < 1.8) speech += `L'algorithme Ultra-Scanner s'attend à un match particulièrement fermé et tactique.`;
    else speech += `L'algorithme Ultra-Scanner prévoit une rencontre équilibrée où le réalisme fera la différence.`;

    return speech;
};
