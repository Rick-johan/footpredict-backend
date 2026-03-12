const mongoose = require('mongoose');

const predictionSchema = new mongoose.Schema({
    fixture_id: { type: String, required: true },

    // 1. Le Contexte Initial (Input)
    match_info: {
        league: String,
        date: String,
        home_name: String,
        away_name: String,
    },
    pre_match_stats: {
        home_enjeu_score: Number,
        away_enjeu_score: Number,
        advantage_A: Number,
        advantage_B: Number,
        pre_match_speech: String,
    },

    // 2. Les Prédictions de l'IA (Output)
    ai_predictions: [{
        tier: Number,
        tag: String,
        category: String,
        market: String,
        selection: String,
        confidence: Number,
        is_won: { type: Boolean, default: null },
        justification: {
            mirror_scan: String,
            context_impact: String
        }
    }],

    // 3. Le Véritabe Résultat (Feedback ajouté post-match via CRON)
    actual_result: {
        home_goals: { type: Number, default: null },
        away_goals: { type: Number, default: null },
        home_goals_ht: { type: Number, default: null },
        away_goals_ht: { type: Number, default: null },
        home_corners: { type: Number, default: null },
        away_corners: { type: Number, default: null },
        home_yellow_cards: { type: Number, default: null },
        away_yellow_cards: { type: Number, default: null },
        status: { type: String, default: 'PENDING' } // PENDING, COMPLETED
    },

    // Status global des pronostics (évalué par script)
    predictions_evaluation: {
        tier_1_won: { type: Boolean, default: null },
        tier_2_won: { type: Boolean, default: null },
        tier_3_won: { type: Boolean, default: null },
        tier_4_won: { type: Boolean, default: null }
    },

    // Payload complet pour le front-end afin de restaurer l'UI depuis le cache
    raw_response: { type: Object }

}, { timestamps: true });

module.exports = mongoose.model('Prediction', predictionSchema);
