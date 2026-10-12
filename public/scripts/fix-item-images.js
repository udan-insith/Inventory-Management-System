// One-time repair for item photos that stopped loading (showing just the
// alt text instead of the picture).
//
// What happened: items.image_path used to store the FULL disk path of the
// uploaded file (e.g. C:\...\gift-storage-system\uploads\items\item-...jpg).
// uploads/items/ is correctly excluded from git (it's user data, not code),
// so when the project was moved into the GitHub repo folder, the code came
// along but the actual photo files didn't — the database still pointed at
// files that only ever existed in the old folder.
//
// This script normalizes every item to store just the bare filename from
// now on (so a future move can never break this again), and recovers any
// photo it can still find at its old location on this machine.
//
// Run once, from the project folder:   node scripts/fix-item-images.js

require('dotenv').config();
const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');
const config = require('../config');

async function main() {
  const conn = await mysql.createConnection({
    host: process.env.MYSQL_HOST || 'localhost',
    port: process.env.MYSQL_PORT || 3306,
    user: process.env.MYSQL_USER || 'root',
    password: process.env.MYSQL_PASSWORD || '',
    database: process.env.MYSQL_DATABASE || 'gift_storage',
  });

  if (!fs.existsSync(config.ITEM_IMAGE_DIR)) fs.mkdirSync(config.ITEM_IMAGE_DIR, { recursive: true });

  const [rows] = await conn.query(
    `SELECT id, name, image_path FROM items WHERE image_path IS NOT NULL AND image_path != ''`
  );

  let already = 0, recovered = 0, missing = 0;

  for (const row of rows) {
    const filename = path.basename(row.image_path);
    const currentPath = path.join(config.ITEM_IMAGE_DIR, filename);

    if (fs.existsSync(currentPath)) {
      // File is already where it should be — just make sure the DB holds
      // the bare filename rather than a full path.
      if (row.image_path !== filename) {
        await conn.query('UPDATE items SET image_path = ? WHERE id = ?', [filename, row.id]);
      }
      already++;
      continue;
    }

    // The DB held an old absolute path — see if that file still exists on
    // this machine (e.g. an old Desktop copy of the project) and recover it.
    if (path.isAbsolute(row.image_path) && fs.existsSync(row.image_path)) {
      fs.copyFileSync(row.image_path, currentPath);
      await conn.query('UPDATE items SET image_path = ? WHERE id = ?', [filename, row.id]);
      console.log(`Recovered image for "${row.name}" from its old location.`);
      recovered++;
      continue;
    }

    console.log(`Could not find the image for "${row.name}" — clearing it so it shows the placeholder instead of a broken image. Re-upload it from the Stock page when convenient.`);
    await conn.query('UPDATE items SET image_path = NULL WHERE id = ?', [row.id]);
    missing++;
  }

  console.log(`\nDone. Already fine: ${already}, recovered: ${recovered}, missing/cleared: ${missing}.`);
  await conn.end();
}

main().catch((err) => {
  console.error('Migration failed:', err);
  process.exit(1);
});
