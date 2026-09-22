const express = require("express");
const db = require("../database");
const { requireLogin } = require("../middleware/auth");

const router = express.Router();
router.use(requireLogin);

// GET /api/history -> every Issue + Receive line, newest first. Fully
// automatic: a straight read of gift_transaction_items/gift_transactions,
// which Stock's Issue/Receive actions already write to. Reads item_name
// straight off each line (not a live join to items), so entries for an
// item that's since been deleted still show up correctly.
router.get("/", async (req, res) => {
	const rows = await db.all(
		`SELECT t.type AS type, ti.id AS id, ti.item_name AS item_name, ti.quantity AS quantity,
            t.branch_name AS branch_name, t.event_name AS event_name,
            t.log_date AS log_date, ti.balance_after AS balance_after, t.created_at AS created_at,
            u.display_name AS logged_by
     FROM gift_transaction_items ti
     JOIN gift_transactions t ON t.id = ti.transaction_id
     LEFT JOIN users u ON u.id = t.created_by
     ORDER BY t.log_date DESC, t.created_at DESC, ti.id DESC`,
	);

	res.json({ history: rows });
});

module.exports = router;
