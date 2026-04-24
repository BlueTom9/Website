const express = require('express');
const cors = require('cors');
const { Pool } = require('pg'); // Database connection
const app = express();

const db = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

app.use(cors());
app.use(express.json());

// Initialize the database table to match your bot's fields
const initDb = async () => {
  await db.query(`
    CREATE TABLE IF NOT EXISTS profiles (
      user_id TEXT,
      mode TEXT,
      username TEXT,
      ot TEXT,
      jt TEXT,
      bt TEXT,
      version TEXT,
      PRIMARY KEY (user_id, mode)
    )
  `);
};
initDb();

// 1. YOUR ORIGINAL UPDATE ROUTE (Now saves to Database)
app.post('/update-profile', async (req, res) => {
  const { user_id, userId, username, mode, ot, jt, bt, version, secret } = req.body;
  
  // Security check
  if (secret !== process.env.API_SECRET && req.headers.authorization !== process.env.API_SECRET) {
    return res.status(403).json({ error: "Unauthorized" });
  }

  // Support both 'user_id' and 'userId' naming
  const finalId = user_id || userId;

  try {
    await db.query(
      `INSERT INTO profiles (user_id, mode, username, ot, jt, bt, version) 
       VALUES ($1, $2, $3, $4, $5, $6, $7) 
       ON CONFLICT (user_id, mode) 
       DO UPDATE SET ot = $4, jt = $5, bt = $6, version = $7, username = $3`,
      [finalId, mode, username, ot, jt, bt, version]
    );
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Database error" });
  }
});

// 2. YOUR ORIGINAL TIERS ROUTE (Now pulls from Database)
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
      
      // Use whichever tier column the bot filled (ot, jt, or bt)
      const rank = row.ot || row.jt || row.bt;
      if (rank && tiers[row.mode][rank]) {
        tiers[row.mode][rank].push(row.username);
      }
    });

    res.json({ tiers, lastUpdated: new Date().toISOString() });
  } catch (err) {
    res.status(500).json({ error: "Database error" });
  }
});

// 3. EMERGENCY RESET (To fix those "does not exist" errors)
app.get('/wipe-db', async (req, res) => {
  if (req.query.secret !== process.env.API_SECRET) return res.status(401).send("Unauthorized");
  try {
    await db.query('DROP TABLE IF EXISTS profiles');
    await initDb();
    res.send("✅ Database Reset! Now run /sync-all.");
  } catch (err) {
    res.status(500).send("Error");
  }
});

app.get('/', (req, res) => res.send('RT Tiers API is running ✅'));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`API running on port ${PORT}`));
