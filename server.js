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

// We use 'rank' as a universal column for S, A, B, C, D
const initDb = async () => {
  await db.query(`
    CREATE TABLE IF NOT EXISTS profiles (
      user_id TEXT,
      username TEXT,
      mode TEXT,
      rank TEXT, 
      PRIMARY KEY (user_id, mode)
    )
  `);
};
initDb();

app.get('/tiers', async (req, res) => {
  try {
    const { rows } = await db.query('SELECT * FROM profiles');
    const tiers = {};
    const TIER_ORDER = ['S', 'A', 'B', 'C', 'D'];

    rows.forEach(row => {
      if (!tiers[row.mode]) {
        tiers[row.mode] = {};
        TIER_ORDER.forEach(t => tiers[row.mode][t] = []);
      }
      if (tiers[row.mode][row.rank]) {
        tiers[row.mode][row.rank].push(row.username);
      }
    });
    res.json(tiers);
  } catch (err) {
    res.status(500).json({ error: "Database error" });
  }
});

app.post('/update-profile', async (req, res) => {
  const { user_id, username, mode, secret } = req.body;
  
  // This line finds if the bot sent 'ot', 'jt', 'bt', or 'rank'
  const tierValue = req.body.ot || req.body.jt || req.body.bt || req.body.rank;

  if (secret !== process.env.API_SECRET) return res.status(401).json({ error: "Unauthorized" });

  try {
    await db.query(
      'INSERT INTO profiles (user_id, username, mode, rank) VALUES ($1, $2, $3, $4) ON CONFLICT (user_id, mode) DO UPDATE SET rank = $4, username = $2',
      [user_id, username, mode, tierValue]
    );
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to save" });
  }
});

app.get('/wipe-db', async (req, res) => {
  if (req.query.secret !== process.env.API_SECRET) return res.status(401).send("Unauthorized");
  try {
    await db.query('DROP TABLE IF EXISTS profiles');
    await initDb();
    res.send("✅ Database cleaned! All kits (OT, BT, JT) will now work. Run /sync-all.");
  } catch (err) {
    res.status(500).send("Error");
  }
});

app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
