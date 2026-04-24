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

// This creates a 'data' column that accepts EVERYTHING the bot sends
const initDb = async () => {
  await db.query(`
    CREATE TABLE IF NOT EXISTS profiles (
      user_id TEXT,
      mode TEXT,
      username TEXT,
      data JSONB,
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
      
      // Look inside the JSON data for ot, jt, or bt
      const rank = row.data.ot || row.data.jt || row.data.bt;
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
  const { user_id, username, mode, secret, ...rest } = req.body;
  if (secret !== process.env.API_SECRET) return res.status(401).json({ error: "Unauthorized" });

  try {
    // This saves 'user_id', 'mode', 'username', and EVERYTHING else into 'data'
    await db.query(
      `INSERT INTO profiles (user_id, mode, username, data) 
       VALUES ($1, $2, $3, $4) 
       ON CONFLICT (user_id, mode) 
       DO UPDATE SET data = $4, username = $3`,
      [user_id, mode, username, rest]
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
    res.send("✅ Database is now UNIVERSAL. It will accept any data the bot sends. Run /sync-all.");
  } catch (err) {
    res.status(500).send("Error");
  }
});

app.listen(PORT, () => console.log(`Server running`));
