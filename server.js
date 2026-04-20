const express = require('express');
const app = express();

app.use(express.json());

// TEMP storage (upgrade to MongoDB later)
const profiles = {};

// 🔐 API KEY SECURITY
function checkAuth(req, res, next) {
  const auth = req.headers.authorization;
  if (auth !== process.env.API_SECRET) {
    return res.status(403).json({ error: "Unauthorized" });
  }
  next();
}

// UPDATE PROFILE (bot sends data here)
app.post('/update-profile', checkAuth, (req, res) => {
  const { userId, ot, jt, mode } = req.body;

  if (!profiles[userId]) {
    profiles[userId] = { modes: {} };
  }

  profiles[userId].modes[mode] = { ot, jt };

  res.json({ success: true });
});

// GET PROFILE (website uses this)
app.get('/profile/:id', (req, res) => {
  const data = profiles[req.params.id];

  if (!data) return res.json({ error: "Not found" });

  res.json(data);
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log("API running on port", PORT));
