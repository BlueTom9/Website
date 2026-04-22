const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');
const app = express();
const PORT = process.env.PORT || 3000;

// 1. Connection to your Neon Database
const db = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false // Required for Neon/Render connection
  }
});

app.use(cors());
app.use(express.json());

// Initialize Database Table if it doesn't exist
const initDb = async () => {
  await db.query(`
    CREATE TABLE IF NOT EXISTS profiles (
      username TEXT PRIMARY KEY,
      mode TEXT,
      ot TEXT
    )
  `);
};
initDb();

// 2. Route for the Website to get Tiers
app.get('/tiers', async (req, res) => {
  try {
    const { rows } = await db.query('SELECT * FROM profiles');
    
    // Format data for your website's frontend
    const tiers = {};
    const OT_ORDER = ['S', 'A', 'B', 'C', 'D'];

    rows.forEach(row => {
      if (!tiers[row.mode]) {
        tiers[row.mode] = {};
        OT_ORDER.forEach(t => tiers[row.mode][t] = []);
      }
      if (tiers[row.mode][row.ot]) {
        tiers[row.mode][row.ot].push(row.username);
      }
    });

    res.json(tiers);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Database error" });
  }
});

// 3. Route for the Discord Bot to update Tiers
app.post('/update-profile', async (req, res) => {
  const { username, mode, ot, secret } = req.body;

  // Security Check
  if (secret !== process.env.API_SECRET) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  try {
    await db.query(
      'INSERT INTO profiles (username, mode, ot) VALUES ($1, $2, $3) ON CONFLICT (username) DO UPDATE SET mode = $2, ot = $3',
      [username, mode, ot]
    );
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to save to database" });
  }
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
