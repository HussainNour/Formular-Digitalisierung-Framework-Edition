// server/jfs-server.js

const express = require('express');
const cors = require('cors');
const Store = require('json-fs-store');
const { randomUUID } = require('crypto');
const jwt = require('jsonwebtoken');
const path = require('path');
const fs = require('fs');

const app = express();

/**
 * Datenverzeichnis:
 * - Standard: <projekt>/data  (relativ zu diesem File: server/../data)
 * - Im Container/Prod: per ENV überschreibbar, z.B. DATA_ROOT=/app/data
 */
const DATA_ROOT = process.env.DATA_ROOT || path.join(__dirname, '..', 'data');
const ZUARBEIT_DIR = path.join(DATA_ROOT, 'Zuarbeit');
const DOZENTEN_DIR = path.join(DATA_ROOT, 'Dozenten');

// Verzeichnisse sicher anlegen
try {
  fs.mkdirSync(ZUARBEIT_DIR, { recursive: true });
  fs.mkdirSync(DOZENTEN_DIR, { recursive: true });
} catch (e) {
  console.error('[FATAL] Konnte Datenverzeichnisse nicht anlegen:', e);
  process.exit(1);
}

// 🔹 getrennte Stores: Zuarbeit & Dozenten
const storeZuarbeit = Store(ZUARBEIT_DIR);
const storeDozenten = Store(DOZENTEN_DIR);

const SECRET = process.env.JWT_SECRET || 'geheim123'; // besser in .env auslagern

app.use(cors());
app.use(express.json());

// --- Helpers ---
function requireAuth(req, res, next) {
  const h = req.headers.authorization;
  if (!h?.startsWith('Bearer ')) return res.status(401).json({ error: 'Token fehlt' });
  try {
    const payload = jwt.verify(h.slice(7), SECRET);
    req.user = payload;
    next();
  } catch {
    return res.status(403).json({ error: 'Ungültiger oder abgelaufener Token' });
  }
}

function allowShareLinkZuarbeit(req, res, next) {
  const id = req.params.id;
  if (!id) return res.status(400).json({ error: 'ID fehlt' });
  storeZuarbeit.load(id, (err, obj) => {
    if (err || !obj) return res.status(404).json({ error: 'Nicht gefunden' });
    req.sharedItem = obj;
    next();
  });
}

function allowShareLinkDoz(req, res, next) {
  const id = req.params.id;
  if (!id) return res.status(400).json({ error: 'ID fehlt' });
  storeDozenten.load(id, (err, obj) => {
    if (err || !obj) return res.status(404).json({ error: 'Nicht gefunden' });
    req.sharedItem = obj;
    next();
  });
}

// --- Login (einfach, nur Demo) ---
app.post('/login', (req, res) => {
  const { username, password } = req.body || {};
  if (username === 'manager' && password === '1234') {
    const token = jwt.sign({ role: 'manager', name: 'manager' }, SECRET, { expiresIn: '12h' });
    return res.json({ token });
  }
  return res.status(401).json({ error: 'Login fehlgeschlagen' });
});

/* ============================================================
 * Z U A R B E I T
 * ============================================================ */

// --- Liste: nur Manager ---
app.get('/Zuarbeit', requireAuth, (req, res) => {
  storeZuarbeit.list((err, objs) => {
    if (err) return res.status(500).json({ error: String(err) });
    res.json(objs);
  });
});

// --- Einzelnes lesen: Manager ODER Dozent per Share-Link ---
app.get('/Zuarbeit/:id', (req, res, next) => {
  if (req.headers.authorization?.startsWith('Bearer ')) return requireAuth(req, res, next);
  return allowShareLinkZuarbeit(req, res, next);
}, (req, res) => {
  if (req.sharedItem) return res.json(req.sharedItem);
  storeZuarbeit.load(req.params.id, (err, obj) => {
    if (err || !obj) return res.status(404).json({ error: 'not found' });
    res.json(obj);
  });
});

// --- Einzelnes updaten: Manager ODER Dozent per Share-Link ---
app.put('/Zuarbeit/:id', (req, res, next) => {
  if (req.headers.authorization?.startsWith('Bearer ')) return requireAuth(req, res, next);
  return allowShareLinkZuarbeit(req, res, next);
}, (req, res) => {
  const id = req.params.id;
  const obj = { ...req.body, id }; // ID fixieren
  storeZuarbeit.add(obj, (err) => {
    if (err) return res.status(500).json({ error: String(err) });
    res.json(obj);
  });
});

// --- Anlegen/Löschen: nur Manager ---
app.post('/Zuarbeit', requireAuth, (req, res) => {
  const id = req.body.id || randomUUID();
  const obj = { ...req.body, id };
  storeZuarbeit.add(obj, (err) => {
    if (err) return res.status(500).json({ error: String(err) });
    res.status(201).json(obj);
  });
});

app.delete('/Zuarbeit/:id', requireAuth, (req, res) => {
  storeZuarbeit.remove(req.params.id, (err) => {
    if (err) return res.status(500).json({ error: String(err) });
    res.status(204).end();
  });
});

/* ============================================================
 * D O Z E N T E N
 * ============================================================ */

// --- Liste: nur Manager ---
app.get('/Dozenten', requireAuth, (req, res) => {
  storeDozenten.list((err, objs) => {
    if (err) return res.status(500).json({ error: String(err) });
    res.json(objs);
  });
});

// --- Einzelnes lesen: Manager ODER Share-Link ---
app.get('/Dozenten/:id', (req, res, next) => {
  if (req.headers.authorization?.startsWith('Bearer ')) return requireAuth(req, res, next);
  return allowShareLinkDoz(req, res, next);
}, (req, res) => {
  if (req.sharedItem) return res.json(req.sharedItem);
  storeDozenten.load(req.params.id, (err, obj) => {
    if (err || !obj) return res.status(404).json({ error: 'not found' });
    res.json(obj);
  });
});

// --- Einzelnes updaten: Manager ODER Share-Link ---
app.put('/Dozenten/:id', (req, res, next) => {
  if (req.headers.authorization?.startsWith('Bearer ')) return requireAuth(req, res, next);
  return allowShareLinkDoz(req, res, next);
}, (req, res) => {
  const id = req.params.id;
  const obj = { ...req.body, id }; // ID fixieren
  storeDozenten.add(obj, (err) => {
    if (err) return res.status(500).json({ error: String(err) });
    res.json(obj);
  });
});

// --- Anlegen/Löschen: nur Manager ---
app.post('/Dozenten', requireAuth, (req, res) => {
  const id = req.body.id || randomUUID();
  const obj = { ...req.body, id };
  storeDozenten.add(obj, (err) => {
    if (err) return res.status(500).json({ error: String(err) });
    res.status(201).json(obj);
  });
});

app.delete('/Dozenten/:id', requireAuth, (req, res) => {
  storeDozenten.remove(req.params.id, (err) => {
    if (err) return res.status(500).json({ error: String(err) });
    res.status(204).end();
  });
});

// --- Diagnostics: zeigt, wohin geschrieben wird (hilft beim Container-Debug) ---
app.get('/__health', (req, res) => {
  res.json({
    ok: true,
    dataRoot: DATA_ROOT,
    zuarbeitDir: ZUARBEIT_DIR,
    dozentenDir: DOZENTEN_DIR,
    cwd: process.cwd(),
  });
});

// --- Global Error Handler (hilft bei "ERR_EMPTY_RESPONSE") ---
app.use((err, req, res, next) => {
  console.error('[UNHANDLED ERROR]', err);
  res.status(500).json({ error: 'Internal Server Error', detail: String(err) });
});

const PORT = 5050;
// Explizit an 0.0.0.0 binden (Container/Port-Mapping)
app.listen(PORT, '0.0.0.0', () => {
  console.log('🚀 File-API mit Rollen läuft auf 0.0.0.0:' + PORT);
  console.log('   Health: http://localhost:' + PORT + '/__health');
});
