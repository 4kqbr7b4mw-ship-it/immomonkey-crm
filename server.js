const express = require('express');
const sqlite3 = require('sqlite3');
const { open } = require('sqlite');
const cors = require('cors');
const nodemailer = require('nodemailer');
const bodyParser = require('body-parser');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// SQLite Datenbank initialisieren
let db;

async function initializeDatabase() {
  try {
    db = await open({
      filename: './crm_database.db',
      driver: sqlite3.Database
    });

    console.log('✅ Datenbank verbunden');

    // Tabelle erstellen falls nicht existiert
    await db.exec(`
      CREATE TABLE IF NOT EXISTS leads (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        email TEXT NOT NULL,
        phone TEXT,
        message TEXT,
        property_type TEXT,
        location TEXT,
        status TEXT DEFAULT 'new',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    console.log('✅ Tabelle "leads" bereit');
  } catch (error) {
    console.error('❌ Datenbankfehler:', error);
    process.exit(1);
  }
}

// E-Mail Transporter
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: process.env.SMTP_PORT,
  secure: false,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS
  }
});

// API Routes

// Health Check
app.get('/', (req, res) => {
  res.json({ 
    status: 'OK', 
    message: 'Immomonkey CRM API läuft',
    timestamp: new Date().toISOString()
  });
});

// Alle Leads abrufen
app.get('/api/leads', async (req, res) => {
  try {
    const leads = await db.all('SELECT * FROM leads ORDER BY created_at DESC');
    res.json({ success: true, data: leads });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Einzelnen Lead abrufen
app.get('/api/leads/:id', async (req, res) => {
  try {
    const lead = await db.get('SELECT * FROM leads WHERE id = ?', [req.params.id]);
    if (!lead) {
      return res.status(404).json({ success: false, error: 'Lead nicht gefunden' });
    }
    res.json({ success: true, data: lead });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Neuen Lead erstellen (von WordPress Formular)
app.post('/api/leads', async (req, res) => {
  try {
    const { name, email, phone, message, property_type, location } = req.body;

    // Validierung
    if (!name || !email) {
      return res.status(400).json({ 
        success: false, 
        error: 'Name und E-Mail sind Pflichtfelder' 
      });
    }

    // In Datenbank speichern
    const result = await db.run(
      `INSERT INTO leads (name, email, phone, message, property_type, location) 
       VALUES (?, ?, ?, ?, ?, ?)`,
      [name, email, phone || '', message || '', property_type || '', location || '']
    );

    // E-Mail Benachrichtigung senden
    if (process.env.NOTIFICATION_EMAIL) {
      await transporter.sendMail({
        from: process.env.SMTP_USER,
        to: process.env.NOTIFICATION_EMAIL,
        subject: 'Neue Immobilien-Anfrage - Immomonkey',
        html: `
          <h2>Neue Lead-Anfrage</h2>
          <p><strong>Name:</strong> ${name}</p>
          <p><strong>E-Mail:</strong> ${email}</p>
          <p><strong>Telefon:</strong> ${phone || 'Nicht angegeben'}</p>
          <p><strong>Immobilientyp:</strong> ${property_type || 'Nicht angegeben'}</p>
          <p><strong>Ort:</strong> ${location || 'Nicht angegeben'}</p>
          <p><strong>Nachricht:</strong></p>
          <p>${message || 'Keine Nachricht'}</p>
          <hr>
          <p>Im CRM bearbeiten: ${process.env.CRM_URL || 'http://localhost:' + PORT}</p>
        `
      });
    }

    res.status(201).json({ 
      success: true, 
      message: 'Lead erfolgreich erstellt',
      data: { id: result.lastID }
    });

  } catch (error) {
    console.error('Fehler beim Erstellen:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Lead aktualisieren
app.put('/api/leads/:id', async (req, res) => {
  try {
    const { status, notes } = req.body;

    await db.run(
      `UPDATE leads SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
      [status, req.params.id]
    );

    res.json({ success: true, message: 'Lead aktualisiert' });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Lead löschen
app.delete('/api/leads/:id', async (req, res) => {
  try {
    await db.run('DELETE FROM leads WHERE id = ?', [req.params.id]);
    res.json({ success: true, message: 'Lead gelöscht' });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Server starten
async function startServer() {
  await initializeDatabase();

  app.listen(PORT, () => {
    console.log(`🚀 Server läuft auf Port ${PORT}`);
    console.log(`📊 CRM API bereit unter http://localhost:${PORT}`);
  });
}

startServer();

// Graceful Shutdown
process.on('SIGINT', async () => {
  console.log('\n👋 Server wird heruntergefahren...');
  if (db) await db.close();
  process.exit(0);
});
