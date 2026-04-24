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

// Initialize Database Table (Now allows multiple kits per user!)
const initDb = async () => {
  await db.query(`
    CREATE TABLE IF NOT EXISTS profiles (
      username TEXT,
      mode TEXT,
      ot TEXT,
      PRIMARY KEY (username, mode)
    )
  `);
};
initDb();

// Route: Get Tiers for the Website
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
        tiers[row.mode][row.ot].push(row.username);
      }
    });

    res.json(tiers);
  } catch (err) {
    res.status(500).json({ error: "Database error" });
  }
});

// Route: Add or Update a Tier
app.post('/update-profile', async (req, res) => {
  const { username, mode, ot, secret } = req.body;
  if (secret !== process.env.API_SECRET) return res.status(401).json({ error: "Unauthorized" });

  try {
    await db.query(
      'INSERT INTO profiles (username, mode, ot) VALUES ($1, $2, $3) ON CONFLICT (username, mode) DO UPDATE SET ot = $3',
      [username, mode, ot]
    );
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to save" });
  }
});

// Route: Delete a Tier (For future bot updates)
app.post('/delete-profile', async (req, res) => {
  const { username, mode, secret } = req.body;
  if (secret !== process.env.API_SECRET) return res.status(401).json({ error: "Unauthorized" });

  try {
    await db.query('DELETE FROM profiles WHERE username = $1 AND mode = $2', [username, mode]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: "Failed to delete" });
  }
});

// Route: WIPE DATABASE (Clears the "Ghosts")
app.get('/wipe-db', async (req, res) => {
  // Uses a URL query to check your password
  if (req.query.secret !== process.env.API_SECRET) return res.status(401).send("Unauthorized: Wrong Secret");
  
  try {
    await db.query('DROP TABLE IF EXISTS profiles');
    await initDb();
    res.send("✅ Database wiped completely clean! Go to Discord and run /sync-all to restore active tiers.");
  } catch (err) {
    res.status(500).send("Error wiping database.");
  }
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
