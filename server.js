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

// Initialize table with exact columns sent by your index.js
const initDb = async () => {
  await db.query(`
    CREATE TABLE IF NOT EXISTS profiles (
      user_id TEXT,
      username TEXT,
      mode TEXT,
      ot TEXT,
      jt TEXT,
      PRIMARY KEY (user_id, mode)
    )
  `);
};
initDb();

// POST: Matches the 'fetch' call in your bot's index.js
app.post('/update-profile', async (req, res) => {
  const { userId, username, mode, ot, jt } = req.body;
  const auth = req.headers.authorization;

  if (auth !== process.env.API_SECRET) {
    return res.status(403).json({ error: "Unauthorized" });
  }

  try {
    await db.query(
      `INSERT INTO profiles (user_id, username, mode, ot, jt) 
       VALUES ($1, $2, $3, $4, $5) 
       ON CONFLICT (user_id, mode) 
       DO UPDATE SET ot = $4, jt = $5, username = $2`,
      [userId, username, mode, ot, jt]
    );
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: "Database error" });
  }
});

// GET: Matches the format expected by your index.html 'applyData' function
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
      // Website specifically checks 'ot' for the tier category
      if (row.ot && tiers[row.mode][row.ot]) {
        tiers[row.mode][row.ot].push(row.username);
      }
    });

    // Wrapped in "tiers" object to match index.html: const data = json.tiers || json;
    res.json({ tiers });
  } catch (err) {
    res.status(500).json({ error: "Database error" });
  }
});

// Reset route to clear old mismatched table structures
app.get('/wipe-db', async (req, res) => {
  if (req.query.secret !== process.env.API_SECRET) return res.status(401).send("Unauthorized");
  try {
    await db.query('DROP TABLE IF EXISTS profiles');
    await initDb();
    res.send("✅ Database matched to bot and website. Run /sync-all.");
  } catch (err) {
    res.status(500).send("Error");
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running`));
