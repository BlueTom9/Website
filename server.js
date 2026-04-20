const express = require('express');
const app = express();

app.use(express.json());
app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  next();
});

function checkAuth(req, res, next) {
  if (req.headers.authorization !== process.env.API_SECRET)
    return res.status(403).json({ error: 'Unauthorized' });
  next();
}

const profiles = {};

app.post('/update-profile', checkAuth, (req, res) => {
  const { userId, username, mode, ot, jt, bt, version } = req.body;
  if (!userId || !mode || !ot) return res.status(400).json({ error: 'Missing fields' });
  if (!profiles[userId]) profiles[userId] = { username: username || userId, modes: {} };
  profiles[userId].username = username || profiles[userId].username;
  profiles[userId].modes[mode] = { ot, jt, bt, version, updatedAt: Date.now() };
  res.json({ success: true });
});

app.get('/profile/:id', (req, res) => {
  const data = profiles[req.params.id];
  if (!data) return res.status(404).json({ error: 'Not found' });
  res.json(data);
});

app.get('/profiles', (req, res) => res.json(profiles));

// This is what the website fetches — converts profiles → tier list
app.get('/tiers', (req, res) => {
  const tiers = {};
  const OT_ORDER = ['S', 'A', 'B', 'C', 'D'];
  for (const profile of Object.values(profiles)) {
    const name = profile.username;
    for (const [mode, data] of Object.entries(profile.modes)) {
      if (!data.ot) continue;
      if (!tiers[mode]) { tiers[mode] = {}; OT_ORDER.forEach(t => tiers[mode][t] = []); }
      if (tiers[mode][data.ot]) tiers[mode][data.ot].push(name);
    }
  }
  res.json({ tiers, lastUpdated: new Date().toISOString(), updatedBy: 'Discord Bot' });
});

app.get('/', (req, res) => res.send('RT Tiers API is running ✅'));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`API running on port ${PORT}`));
