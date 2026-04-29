const express = require('express');
const router = express.Router();
const pool = require('../db/connection');

// ✅ Middleware
function isSuperAdmin(req, res, next) {
    if (!req.session.user) {
        return res.status(401).json({ error: "Unauthorized" });
    }

    // ⚠️ FIX: use string role consistently
    if (req.session.user.role !== '-1') {
        return res.status(403).json({ error: "Forbidden" });
    }

    next();
}

// ✅ Route
router.get('/dashboard', isSuperAdmin, async (req, res) => {
    console.log("🔥 SUPERADMIN DASHBOARD HIT");

    try {
        const agents = await pool.query(`
            SELECT COUNT(*) AS total
            FROM users
            WHERE role IN ('agent','sub_agent','master_agent')
        `);

        const players = await pool.query(`
            SELECT COUNT(*) AS total
            FROM users
            WHERE role = 'player'
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

        return res.json({
            totalAgents: Number(agents.rows[0]?.total || 0),
            totalPlayers: Number(players.rows[0]?.total || 0),
            totalBet: Number(bets.rows[0]?.total_bet || 0),
            totalCashIn: Number(cash.rows[0]?.cash_in || 0),
            totalWithdraw: Number(cash.rows[0]?.withdraw || 0),

            // TEMP SAFE VALUES
            onlineAgents: 0,
            offlineAgents: 0,
            pendingAgents: 0,
            onlinePlayers: 0,
            offlinePlayers: 0,
            pendingPlayers: 0,
            totalWon: 0
        });

    } catch (err) {
        console.error("❌ SUPERADMIN ERROR:", err); // 👈 THIS IS WHAT WE NEED
        return res.status(500).json({
            error: err.message,
            stack: err.stack
        });
    }
});

module.exports = router;