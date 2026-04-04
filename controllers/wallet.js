// controllers/wallet.js
const pool = require('../db/connection');

async function addTransaction(userId, type, amount, description) {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        // 1. Get user
        const userRes = await client.query(
            'SELECT points, parent_id FROM users WHERE id=$1 FOR UPDATE',
            [userId]
        );

        if (userRes.rows.length === 0) throw new Error("User not found");

        const user = userRes.rows[0];

        // 2. Update user balance
        const newBalance = Number(user.points) + Number(amount);

        await client.query(
            'UPDATE users SET points=$1 WHERE id=$2',
            [newBalance, userId]
        );

        // 3. Save transaction
        await client.query(`
            INSERT INTO wallet_transactions 
            (user_id, type, amount, balance_after, description)
            VALUES ($1, $2, $3, $4, $5)
        `, [userId, type, amount, newBalance, description]);

        // =========================
        // 💰 COMMISSION LOGIC
        // =========================
        if (user.parent_id) {
            const parentRes = await client.query(
                'SELECT commission_rate, points FROM users WHERE id=$1 FOR UPDATE',
                [user.parent_id]
            );

            if (parentRes.rows.length > 0) {
                const parent = parentRes.rows[0];

                const commission = (Number(amount) * Number(parent.commission_rate)) / 100;

                if (commission > 0) {
                    const parentNewBalance = Number(parent.points) + commission;

                    // Add to parent wallet
                    await client.query(
                        'UPDATE users SET points=$1, commission_earnings = commission_earnings + $2 WHERE id=$3',
                        [parentNewBalance, commission, user.parent_id]
                    );

                    // Log commission transaction
                    await client.query(`
                        INSERT INTO wallet_transactions 
                        (user_id, type, amount, balance_after, description)
                        VALUES ($1, $2, $3, $4, $5)
                    `, [
                        user.parent_id,
                        'commission',
                        commission,
                        parentNewBalance,
                        `Commission from user ${userId}`
                    ]);
                }
            }
        }

        await client.query('COMMIT');
        return newBalance;

    } catch (err) {
        await client.query('ROLLBACK');
        throw err;
    } finally {
        client.release();
    }
}

async function getBalance(userId) {
    const res = await pool.query('SELECT points FROM users WHERE id=$1', [userId]);
    return res.rows.length ? res.rows[0].points : null;
}

async function getTransactions(userId) {
    const res = await pool.query(
        'SELECT * FROM wallet_transactions WHERE user_id=$1 ORDER BY created_at DESC',
        [userId]
    );
    return res.rows;
}

module.exports = { 
    addTransaction, 
    getBalance, 
    getTransactions,
    getDashboardWallets
 };

// Get wallet balances for dashboard
async function getDashboardWallets(userId) {
    const client = await pool.connect();
    try {
        // 1. Current user balance
        const userRes = await client.query('SELECT points, commission_earnings, commission_rate FROM users WHERE id=$1', [userId]);
        const userBalance = userRes.rows.length ? Number(userRes.rows[0].points) : 0;
        const user = userRes.rows[0];
        const userCommissionRate = user ? Number(user.commission_rate) : 0;
        const userCommissionEarnings = user ? Number(user.commission_earnings) : 0;

        // 2. Agents under this account
        const agentsRes = await client.query(`
            SELECT points FROM users 
            WHERE parent_id=$1 AND role IN ('agent','sub_agent','master_agent')
        `, [userId]);

        const agentsCount = agentsRes.rows.length;
        const agentsPoints = agentsRes.rows.reduce((sum, r) => sum + Number(r.points), 0);

        // 3. Players under this account
        const playersRes = await client.query(`
            SELECT points FROM users 
            WHERE parent_id=$1 AND role='player'
        `, [userId]);

        const playersCount = playersRes.rows.length;
        const playersPoints = playersRes.rows.reduce((sum, r) => sum + Number(r.points), 0);

        return {
            userBalance,
            commissionRate: userCommissionRate,
            commissionEarnings: userCommissionEarnings,
            agentsPoints,
            agentsCount,
            playersPoints,
            playersCount
        };

    } finally {
        client.release();
    }
}

