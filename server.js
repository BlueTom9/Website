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

// This creates the exact columns your bot is looking for: ot, jt, and bt
const initDb = async () => {
  await db.query(`
    CREATE TABLE IF NOT EXISTS profiles (
      user_id TEXT,
      username TEXT,
      mode TEXT,
      ot TEXT,
      jt TEXT,
      bt TEXT,
      PRIMARY KEY (user_id, mode)
    )
  `);
};
initDb();

app.get('/tiers', async (req, res) => {
  try {
    const { rows } = await db.query('SELECT * FROM profiles');
    const tiers = {};
    const TIER_LIST = ['S', 'A', 'B', 'C', 'D'];

    rows.forEach(row => {
      if (!tiers[row.mode]) {
        tiers[row.mode] = {};
        TIER_LIST.forEach(t => tiers[row.mode][t] = []);
      }
      
      // This checks whichever column has the rank (ot, jt, or bt)
      const rank = row.ot || row.jt || row.bt;
      if (rank && tiers[row.mode][rank]) {
        tiers[row.mode][rank].push(row.username);
      }
    });
    res.json(tiers);
  } catch (err) {
    res.status(500).json({ error: "Database error" });
  }
});

app.post('/update-profile', async (req, res) => {
  const { user_id, username, mode, ot, jt, bt, secret } = req.body;
  if (secret !== process.env.API_SECRET) return res.status(401).json({ error: "Unauthorized" });

  try {
    // This matches the exact structure your bot is sending
    await db.query(
      `INSERT INTO profiles (user_id, username, mode, ot, jt, bt) 
       VALUES ($1, $2, $3, $4, $5, $6) 
       ON CONFLICT (user_id, mode) 
       DO UPDATE SET ot = $4, jt = $5, bt = $6, username = $2`,
      [user_id, username, mode, ot, jt, bt]
    );
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to save" });
  }
});

// WIPE ROUTE
app.get('/wipe-db', async (req, res) => {
  if (req.query.secret !== process.env.API_SECRET) return res.status(401).send("Unauthorized");
  try {
    await db.query('DROP TABLE IF EXISTS profiles');
    await initDb();
    res.send("✅ Database matched to bot! Run /sync-all.");
  } catch (err) {
    res.status(500).send("Error");
  }
});

app.listen(PORT, () => console.log(`Server running`));
