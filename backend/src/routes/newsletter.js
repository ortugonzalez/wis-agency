const express = require("express");
const fs = require("fs");
const path = require("path");

const router = express.Router();
const DATA_FILE = path.resolve(__dirname, "../../newsletters.json");

function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

router.post("/", (req, res) => {
  const { email } = req.body;

  if (!email || !isValidEmail(email)) {
    return res.status(400).json({ success: false, message: "Email inválido." });
  }

  // Load existing subscribers
  let subscribers = [];
  if (fs.existsSync(DATA_FILE)) {
    try {
      subscribers = JSON.parse(fs.readFileSync(DATA_FILE, "utf-8"));
    } catch {
      subscribers = [];
    }
  }

  if (subscribers.includes(email)) {
    return res.json({ success: true, message: "Ya estás suscripto." });
  }

  subscribers.push(email);
  fs.writeFileSync(DATA_FILE, JSON.stringify(subscribers, null, 2));

  // TODO: Supabase integration — replace file write above with:
  // const { error } = await supabase.from('newsletter').insert({ email });
  // if (error) return res.status(500).json({ success: false, message: 'Error al guardar.' });

  return res.json({ success: true, message: "Suscripto correctamente." });
});

module.exports = router;
