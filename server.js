const express = require('express');
const cors = require('cors'); 
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
  if (!userId || !mode || !ot) return res.status(400).json({ error: "Missing fields" });

  if (!profiles[userId]) {
    profiles[userId] = { username: username || userId, modes: {} };
  }
  if (!profiles[userId].customName) {
    profiles[userId].username = username || profiles[userId].username;
  }
  profiles[userId].modes[mode] = { ot, jt, updatedAt: Date.now() };
  return res.json({ success: true });
});

app.post('/dev-panel', (req, res) => {
  const { password, currentName, newName, mode, tempRank } = req.body;
  if (password !== 'Harisch05.') return res.status(403).json({ error: "Wrong Password" });

  let foundUid = null;
  for (const [uid, prof] of Object.entries(profiles)) {
    const activeName = prof.customName || prof.username;
    if (activeName.toLowerCase() === currentName.toLowerCase()) {
      foundUid = uid; break;
    }
  }
  if (!foundUid) return res.status(404).json({ error: "Player not found" });

  if (newName && newName.trim() !== '') profiles[foundUid].customName = newName.trim();
  if (mode && tempRank) {
    if (!profiles[foundUid].tempOverrides) profiles[foundUid].tempOverrides = {};
    profiles[foundUid].tempOverrides[mode] = {
      ot: tempRank, expiresAt: Date.now() + (10 * 60 * 60 * 1000)
    };
  }
  return res.json({ success: true });
});app.get('/tiers', (req, res) => {
  const tiers = {};
  const OT_ORDER = ['S', 'A', 'B', 'C', 'D'];
  const now = Date.now();

  for (const profile of Object.values(profiles)) {
    const name = profile.customName || profile.username;
    for (const [mode, data] of Object.entries(profile.modes)) {
      let ot = (profile.tempOverrides?.[mode]?.expiresAt > now) 
        ? profile.tempOverrides[mode].ot 
        : data.ot;

      if (!ot) continue;
      if (!tiers[mode]) { 
        tiers[mode] = {}; 
        OT_ORDER.forEach(t => tiers[mode][t] = []); 
      }
      if (tiers[mode][ot]) tiers[mode][ot].push(name);
    }
  }
  res.json({ tiers });
});

app.get('/', (req, res) => res.send('API Online ✅'));
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server on ${PORT}`));

