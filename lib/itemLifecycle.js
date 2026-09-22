const db = require('../database');

// Deletes an item row. Its stock_in_logs / stock_out_logs rows are left
// exactly as they are — item_id is defined as ON DELETE SET NULL in the
// schema, so MySQL detaches those rows automatically instead of deleting
// them. Each log row also carries its own item_name snapshot, so Total
// History keeps reading correctly even after the item is gone.
async function deleteItemKeepingHistory(itemId) {
  await db.run('DELETE FROM items WHERE id = ?', [itemId]);
}

module.exports = { deleteItemKeepingHistory };
