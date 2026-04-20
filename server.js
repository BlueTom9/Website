const express = require('express');
const app = express();

app.use(express.json());

/**
 * =========================
 * 🔐 AUTH MIDDLEWARE
 * =========================
 */
function checkAuth(req, res, next) {
  const auth = req.headers.authorization;

  if (!auth || auth !== process.env.API_SECRET) {
    return res.status(403).json({ error: "Unauthorized" });
  }

  next();
}

/**
 * =========================
 * 🧠 TEMP STORAGE (REPLACE WITH MONGO LATER)
 * =========================
 * WARNING: resets on restart
 */
const profiles = {};

/**
 * =========================
 * 📊 UPDATE PROFILE (DISCORD BOT → API)
 * =========================
 * body: { userId, mode, ot, jt }
 */
app.post('/update-profile', checkAuth, (req, res) => {
  const { userId, mode, ot, jt } = req.body;

  // validation
  if (!userId || !mode || !ot || !jt) {
    return res.status(400).json({
      error: "Missing required fields: userId, mode, ot, jt"
    });
  }

  if (!profiles[userId]) {
    profiles[userId] = { modes: {} };
  }

  profiles[userId].modes[mode] = {
    ot,
    jt,
    updatedAt: Date.now()
  };

  return res.json({
    success: true,
    message: "Profile updated"
  });
});

/**
 * =========================
 * 📥 GET PROFILE (WEBSITE)
 * =========================
 */
app.get('/profile/:id', (req, res) => {
  const data = profiles[req.params.id];

  if (!data) {
    return res.status(404).json({ error: "Profile not found" });
  }

  res.json(data);
});

/**
 * =========================
 * 📊 GET ALL PROFILES (optional admin/debug)
 * =========================
 */
app.get('/profiles', (req, res) => {
  res.json(profiles);
});

/**
 * =========================
 * 🚀 HEALTH CHECK (Render)
 * =========================
 */
app.get('/', (req, res) => {
  res.send('RT Tiers API is running ✅');
});

/**
 * =========================
 * 🌐 SERVER START
 * =========================
 */
const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`API running on port ${PORT}`);
});
