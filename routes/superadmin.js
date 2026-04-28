const express = require('express');
const router = express.Router();
const pool = require('../db/connection');

// ✅ Middleware
function isSuperAdmin(req, res, next) {
    if (!req.session.user) {
        return res.status(401).json({ error: "Unauthorized" });
    }

    // ⚠️ FIX: use string role consistently
    if (req.session.user.role !== 'superadmin') {
        return res.status(403).json({ error: "Forbidden" });
    }

    next();
}

// ✅ Route
router.get('/dashboard', isSuperAdmin, async (req, res) => {
    try {
        const agents = await pool.query(`
            SELECT 
                COUNT(*) FILTER (WHERE role IN ('agent','sub_agent','master_agent')) AS total,
                COUNT(*) FILTER (WHERE status = 'online' AND role IN ('agent','sub_agent','master_agent')) AS online,
                COUNT(*) FILTER (WHERE status = 'offline' AND role IN ('agent','sub_agent','master_agent')) AS offline,
                COUNT(*) FILTER (WHERE status = 'pending' AND role IN ('agent','sub_agent','master_agent')) AS pending
            FROM users
        `);

        const players = await pool.query(`
            SELECT 
                COUNT(*) FILTER (WHERE role = 'player') AS total,
                COUNT(*) FILTER (WHERE status = 'online' AND role = 'player') AS online,
                COUNT(*) FILTER (WHERE status = 'offline' AND role = 'player') AS offline,
                COUNT(*) FILTER (WHERE status = 'pending' AND role = 'player') AS pending
            FROM users
        `);

        const bets = await pool.query(`
            SELECT COALESCE(SUM(amount), 0) AS total_bet
            FROM bets
            WHERE is_dummy = false
        `);

        const cash = await pool.query(`
            SELECT
                COALESCE(SUM(CASE WHEN type = 'credit' THEN amount ELSE 0 END), 0) AS cash_in,
                COALESCE(SUM(CASE WHEN type = 'debit' THEN amount ELSE 0 END), 0) AS withdraw
            FROM wallet_transactions
        `);

        res.json({
            totalAgents: Number(agents.rows[0].total),
            onlineAgents: Number(agents.rows[0].online),
            offlineAgents: Number(agents.rows[0].offline),
            pendingAgents: Number(agents.rows[0].pending),

            totalPlayers: Number(players.rows[0].total),
            onlinePlayers: Number(players.rows[0].online),
            offlinePlayers: Number(players.rows[0].offline),
            pendingPlayers: Number(players.rows[0].pending),

            totalBet: Number(bets.rows[0].total_bet),
            totalWon: 0,

            totalCashIn: Number(cash.rows[0].cash_in),
            totalWithdraw: Number(cash.rows[0].withdraw)
        });

    } catch (err) {
        console.error(err);
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;