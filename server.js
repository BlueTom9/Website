const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');
const app = express();

const db = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

app.use(cors());
app.use(express.json());

// 1. MATCH THE DATABASE TO YOUR BOT'S SAVEPROFILE DATA
const initDb = async () => {
  await db.query(`
    CREATE TABLE IF NOT EXISTS profiles (
      user_id TEXT, 
      username TEXT,
      mode TEXT,
      ot TEXT,
      jt TEXT,
      bt TEXT,
      version TEXT,
      updated_at TIMESTAMP DEFAULT NOW(),
      PRIMARY KEY (user_id, mode)
    )
  `);
};
initDb();

// 2. MATCH THE BOT'S POST REQUEST (userId, username, mode, ot, jt)
app.post('/update-profile', async (req, res) => {
  const { userId, username, mode, ot, jt, bt, version } = req.body;
  const auth = req.headers.authorization;

  if (auth !== process.env.API_SECRET) {
    return res.status(403).json({ error: "Unauthorized" });
  }

  try {
    // Uses userId from your bot's fetch call
    await db.query(
      `INSERT INTO profiles (user_id, username, mode, ot, jt, bt, version, updated_at) 
       VALUES ($1, $2, $3, $4, $5, $6, $7, NOW()) 
       ON CONFLICT (user_id, mode) 
       DO UPDATE SET ot = $4, jt = $5, bt = $6, version = $7, username = $2, updated_at = NOW()`,
      [userId, username, mode, ot, jt, bt, version]
    );
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Database error" });
  }
});

// 3. MATCH THE WEBSITE'S APPLYDATA EXPECTATION (json.tiers)
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
      
      // Website specifically uses 'ot' for the Tier List display
      if (row.ot && tiers[row.mode][row.ot]) {
        tiers[row.mode][row.ot].push(row.username);
      }
    });

    // Wrapped in 'tiers' so index.html can read it
    res.json({ tiers });
  } catch (err) {
    res.status(500).json({ error: "Database error" });
  }
});

// RESET ROUTE
app.get('/wipe-db', async (req, res) => {
  if (req.query.secret !== process.env.API_SECRET) return res.status(401).send("Unauthorized");
  try {
    await db.query('DROP TABLE IF EXISTS profiles');
    await initDb();
    res.send("✅ Database matched to bot/site. Run /sync-all.");
  } catch (err) {
    res.status(500).send("Error");
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`API Active`));
