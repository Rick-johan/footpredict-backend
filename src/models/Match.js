const mongoose = require('mongoose');

const matchSchema = new mongoose.Schema({
    fixture_id: { type: Number, required: true, unique: true },
    league: {
        id: Number,
        name: String,
        logo: String,
    },
    home_team: {
        id: Number,
        name: String,
        logo: String,
    },
    away_team: {
        id: Number,
        name: String,
        logo: String,
    },
    date: { type: Date, required: true },
    status: { type: String, default: 'NS' },
    stats_fetched: { type: Boolean, default: false },
}, { timestamps: true });

module.exports = mongoose.model('Match', matchSchema);
