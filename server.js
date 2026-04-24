const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');
const app = express();
const PORT = process.env.PORT || 3000;

const db = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

app.use(cors());
app.use(express.json());

// FIXED: Added user_id to the table structure
const initDb = async () => {
  await db.query(`
    CREATE TABLE IF NOT EXISTS profiles (
      user_id TEXT,
      username TEXT,
      mode TEXT,
      ot TEXT,
      PRIMARY KEY (user_id, mode)
    )
  `);
};
initDb();

app.get('/tiers', async (req, res) => {
  try {
    const { rows } = await db.query('SELECT * FROM profiles');
    const tiers = {};
    const OT_ORDER = ['S', 'A', 'B', 'C', 'D'];

    rows.forEach(row => {
      if (!tiers[row.mode]) {
        tiers[row.mode] = {};
        OT_ORDER.forEach(t => tiers[row.mode][t] = []);
      }
      if (tiers[row.mode][row.ot]) {
        // We still show the username on the website
        tiers[row.mode][row.ot].push(row.username);
      }
    });
    res.json(tiers);
  } catch (err) {
    res.status(500).json({ error: "Database error" });
  }
});

app.post('/update-profile', async (req, res) => {
  const { user_id, username, mode, ot, secret } = req.body;
  if (secret !== process.env.API_SECRET) return res.status(401).json({ error: "Unauthorized" });

  try {
    // FIXED: Now saves user_id too
    await db.query(
      'INSERT INTO profiles (user_id, username, mode, ot) VALUES ($1, $2, $3, $4) ON CONFLICT (user_id, mode) DO UPDATE SET ot = $4, username = $2',
      [user_id, username, mode, ot]
    );
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to save" });
  }
});

// WIPE ROUTE (Run this once after you update the code!)
app.get('/wipe-db', async (req, res) => {
  if (req.query.secret !== process.env.API_SECRET) return res.status(401).send("Unauthorized");
  try {
    await db.query('DROP TABLE IF EXISTS profiles');
    await initDb();
    res.send("✅ Table reset with the new ID column! Now run /sync-all.");
  } catch (err) {
    res.status(500).send("Error");
  }
});

app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
