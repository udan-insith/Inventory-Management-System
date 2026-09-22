const express = require("express");
const db = require("../database");
const { requireLogin } = require("../middleware/auth");

const router = express.Router();
router.use(requireLogin);

// POST /api/transactions -> create an Issue or Receive event covering one
// or more items at once. "issue" decreases stock (gifts going out to a
// branch); "receive" increases it (gifts coming into storage). An item
// that an Issue brings down to 0 is deleted automatically — its line in
// this transaction (and everything before it) stays in Total History,
// since item_name is snapshotted and item_id is ON DELETE SET NULL.
router.post("/", async (req, res) => {
	const { type, branchName, eventName, date, items } = req.body || {};

	if (type !== "issue" && type !== "receive") {
		return res
			.status(400)
			.json({ error: 'Type must be "issue" or "receive".' });
	}
	if (!branchName || !branchName.trim()) {
		return res.status(400).json({ error: "Choose a branch." });
	}
	if (!eventName || !eventName.trim()) {
		return res.status(400).json({ error: "Give this event a name." });
	}
	if (!date) {
		return res.status(400).json({ error: "Pick a date." });
	}
	if (!Array.isArray(items) || items.length === 0) {
		return res.status(400).json({ error: "Add at least one item." });
	}
	for (const line of items) {
		const qty = Math.trunc(Number(line.quantity));
		if (!line.itemId || !Number.isFinite(qty) || qty <= 0) {
			return res
				.status(400)
				.json({ error: "Every item needs a quantity greater than 0." });
		}
	}

	try {
		const result = await db.transaction(async (tx) => {
			const txInfo = await tx.run(
				"INSERT INTO gift_transactions (type, branch_name, event_name, log_date, created_by) VALUES (?, ?, ?, ?, ?)",
				[type, branchName.trim(), eventName.trim(), date, req.session.user.id],
			);

			const lineResults = [];
			const deletedItemIds = [];

			for (const line of items) {
				const qty = Math.trunc(Number(line.quantity));
				const item = await tx.get("SELECT * FROM items WHERE id = ?", [
					line.itemId,
				]);
				if (!item) {
					const err = new Error(
						"One of the items in this list no longer exists.",
					);
					err.status = 404;
					throw err;
				}

				const newBalance =
					type === "issue" ? item.balance - qty : item.balance + qty;

				if (type === "issue" && newBalance < 0) {
					const err = new Error(
						`Only ${item.balance} of "${item.name}" in stock — can't issue ${qty}.`,
					);
					err.status = 400;
					throw err;
				}

				await tx.run(
					"INSERT INTO gift_transaction_items (transaction_id, item_id, item_name, quantity, balance_after) VALUES (?, ?, ?, ?, ?)",
					[txInfo.lastInsertRowid, item.id, item.name, qty, newBalance],
				);

				if (type === "issue" && newBalance <= 0) {
					await tx.run("DELETE FROM items WHERE id = ?", [item.id]);
					deletedItemIds.push(item.id);
				} else {
					await tx.run("UPDATE items SET balance = ? WHERE id = ?", [
						newBalance,
						item.id,
					]);
				}

				lineResults.push({
					itemId: item.id,
					name: item.name,
					balance: newBalance,
				});
			}

			return {
				transactionId: txInfo.lastInsertRowid,
				lines: lineResults,
				deletedItemIds,
			};
		});

		res.status(201).json({ ok: true, ...result });
	} catch (err) {
		if (err.status) return res.status(err.status).json({ error: err.message });
		throw err;
	}
});

// GET /api/transactions/item/:itemId -> combined Issue + Receive log for
// one item, for the "View Log" modal.
router.get("/item/:itemId", async (req, res) => {
	const item = await db.get(
		"SELECT id, name, balance FROM items WHERE id = ?",
		[req.params.itemId],
	);
	if (!item) return res.status(404).json({ error: "Item not found." });

	const logs = await db.all(
		`SELECT t.type, t.branch_name, t.event_name, t.log_date, ti.quantity, ti.balance_after,
            u.display_name AS logged_by, t.created_at
     FROM gift_transaction_items ti
     JOIN gift_transactions t ON t.id = ti.transaction_id
     LEFT JOIN users u ON u.id = t.created_by
     WHERE ti.item_id = ?
     ORDER BY t.log_date DESC, t.created_at DESC, ti.id DESC`,
		[req.params.itemId],
	);

	res.json({ item, logs });
});

module.exports = router;
