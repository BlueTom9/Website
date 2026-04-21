const express = require('express');
const cors = require('cors'); // Requires: npm install cors
const app = express();

app.use(cors());
app.use(express.json());

function checkAuth(req, res, next) {
  const auth = req.headers.authorization;
  if (!auth || auth !== process.env.API_SECRET) {
    return res.status(403).json({ error: "Unauthorized" });
  }
  next();
}

const profiles = {};

app.post('/update-profile', checkAuth, (req, res) => {
  const { userId, username, mode, ot, jt } = req.body;

  if (!userId || !mode || !ot) {
    return res.status(400).json({ error: "Missing required fields" });
  }

  if (!profiles[userId]) {
    profiles[userId] = { username: username || userId, modes: {} };
  }

  profiles[userId].username = username || profiles[userId].username;
  profiles[userId].modes[mode] = { ot, jt, updatedAt: Date.now() };

  return res.json({ success: true });
});

// Converts the raw profiles into the Tier List format for the website
app.get('/tiers', (req, res) => {
  const tiers = {};
  const OT_ORDER = ['S', 'A', 'B', 'C', 'D'];

  for (const profile of Object.values(profiles)) {
    const name = profile.username;
    for (const [mode, data] of Object.entries(profile.modes)) {
      if (!data.ot) continue;
      
      if (!tiers[mode]) { 
        tiers[mode] = {}; 
        OT_ORDER.forEach(t => tiers[mode][t] = []); 
      }
      if (tiers[mode][data.ot]) {
        tiers[mode][data.ot].push(name);
      }
    }
  }
  res.json({ tiers, lastUpdated: new Date().toISOString() });
});

app.get('/', (req, res) => {
  res.send('RT Tiers API is running ✅');
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`API running on port ${PORT}`);
});
