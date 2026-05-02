const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');
const https = require('https'); // Added for self-ping
const app = express();

const db = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

app.use(cors());
app.use(express.json());

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

// Self-Ping Logic: Keeps Render from falling asleep
const RENDER_URL = 'https://rt-tiers-api.onrender.com'; // Replace with your actual URL
setInterval(() => {
  https.get(RENDER_URL, (res) => {
    console.log(`[Self-Ping] Status: ${res.statusCode}`);
  }).on('error', (err) => {
    console.error(`[Self-Ping] Error: ${err.message}`);
  });
}, 600000); // Pings every 10 minutes

app.post('/update-profile', async (req, res) => {
  const { userId, username, mode, ot, jt } = req.body;
  const auth = req.headers.authorization;

  if (auth !== process.env.API_SECRET) return res.status(403).json({ error: "Unauthorized" });

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
      if (row.ot && tiers[row.mode][row.ot]) {
        tiers[row.mode][row.ot].push(row.username);
      }
    });
    res.json({ tiers });
  } catch (err) {
    res.status(500).json({ error: "Database error" });
  }
});

app.get('/', (req, res) => res.send('API is awake ✅'));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running`));
