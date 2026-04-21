const express = require('express');
const cors = require('cors');
const { Pool } = require('pg'); // Requires: npm install pg
const app = express();

app.use(cors());
app.use(express.json());

// Set up connection to your Replit PostgreSQL
const db = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false } // Required for most hosted DBs
});

// Middleware to protect your update route
function checkAuth(req, res, next) {
  const auth = req.headers.authorization;
  if (!auth || auth !== process.env.API_SECRET) {
    return res.status(403).json({ error: "Unauthorized" });
  }
  next();
}

// Keep-alive route for UptimeRobot
app.get('/health', (req, res) => res.send('Server is running'));

/**
 * Update Profile
 * This still exists so your Bot can push data, 
 * but now we save it to the DB so it never disappears.
 */
app.post('/update-profile', checkAuth, async (req, res) => {
  const { userId, username, mode, ot, jt } = req.body;

  if (!userId || !mode || !ot) {
    return res.status(400).json({ error: "Missing fields" });
  }

  try {
    await db.query(
      `INSERT INTO profiles (user_id, username, mode, ot, jt, updated_at)
       VALUES ($1, $2, $3, $4, $5, NOW())
       ON CONFLICT (user_id, mode)
       DO UPDATE SET username=$2, ot=$4, jt=$5, updated_at=NOW()`,
      [userId, username, mode, ot, jt]
    );
    res.json({ success: true });
  } catch (err) {
    console.error("DB Error:", err);
    res.status(500).json({ error: "Database save failed" });
  }
});

/**
 * Get Tiers
 * This fetches fresh data from the Database every time the website loads.
 */
app.get('/tiers', async (req, res) => {
  try {
    const { rows } = await db.query('SELECT username, mode, ot FROM profiles WHERE ot IS NOT NULL');
    
    const tiers = {};
    const OT_ORDER = ['S', 'A', 'B', 'C', 'D'];

    rows.forEach(row => {
      const mode = row.mode;
      const ot = row.ot;

      if (!tiers[mode]) {
        tiers[mode] = {};
        OT_ORDER.forEach(t => tiers[mode][t] = []);
      }

      if (tiers[mode][ot]) {
        tiers[mode][ot].push(row.username);
      }
    });

    res.json(tiers);
  } catch (err) {
    console.error("Fetch Error:", err);
    res.status(500).json({ error: "Could not load tiers" });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});
