
# Neue server.js mit better-sqlite3 (synchrone API)
server_js_content = '''import express from 'express';
import cors from 'cors';
import Database from 'better-sqlite3';
import nodemailer from 'nodemailer';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'dist')));

// Datenbank initialisieren
let db;
try {
  db = new Database('./leads.db');
  console.log('Mit SQLite-Datenbank verbunden');
  initDatabase();
} catch (err) {
  console.error('Datenbankfehler:', err);
  process.exit(1);
}

// Datenbank-Schema erstellen
function initDatabase() {
  try {
    db.exec(`
      CREATE TABLE IF NOT EXISTS leads (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        phone TEXT,
        email TEXT,
        location TEXT,
        object_type TEXT,
        living_area TEXT,
        land_area TEXT,
        construction_year TEXT,
        condition TEXT,
        special_features TEXT,
        sales_intent TEXT,
        motivation TEXT,
        price_expectation TEXT,
        score TEXT,
        pipeline_stage TEXT,
        next_step TEXT,
        has_contact INTEGER DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log('Leads-Tabelle bereit');
  } catch (err) {
    console.error('Fehler beim Erstellen der Tabelle:', err);
  }
}

// E-Mail-Transporter konfigurieren
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || 'smtp.gmail.com',
  port: process.env.SMTP_PORT || 587,
  secure: false,
  auth: {
    user: process.env.SMTP_USER || '',
    pass: process.env.SMTP_PASS || ''
  }
});

// Scoring-Logik
function computeScore(motivation, intent) {
  const mot = motivation.toLowerCase();
  const int = intent.toLowerCase();
  
  if (['hoch', 'verkauf geplant', 'motiviert'].some(k => mot.includes(k))) {
    return 'A';
  }
  if (int.includes('sofort') || int.includes('3') || int.includes('6')) {
    return 'A';
  }
  if (['mittel', 'bewertung', 'erbschaft'].some(k => mot.includes(k))) {
    return 'B';
  }
  return 'C';
}

// Pipeline-Zuweisung
function assignPipeline(score, hasContact) {
  if (!hasContact) return 'Neuer Lead';
  if (score === 'A' || score === 'B') return 'Qualifiziert';
  return 'Kontakt hergestellt';
}

// Nächster Schritt
function suggestNextStep(pipelineStage, score) {
  if (pipelineStage === 'Neuer Lead') {
    return 'Kontakt aufnehmen: sofort anrufen oder eine E-Mail schicken.';
  }
  if (pipelineStage === 'Kontakt hergestellt') {
    return 'Qualifizierungsfragen stellen und Informationen zum Objekt erfragen.';
  }
  if (pipelineStage === 'Qualifiziert') {
    if (score === 'A') {
      return 'Termin zur Beratung oder Besichtigung vereinbaren.';
    }
    return 'Unterlagen anfordern und Nurturing-E-Mails starten.';
  }
  return 'Daten überprüfen und nächsten logischen Schritt festlegen.';
}

// API-Endpunkte

// Alle Leads abrufen
app.get('/api/leads', (req, res) => {
  try {
    const rows = db.all('SELECT * FROM leads ORDER BY created_at DESC');
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Einzelnen Lead abrufen
app.get('/api/leads/:id', (req, res) => {
  try {
    const row = db.get('SELECT * FROM leads WHERE id = ?', [req.params.id]);
    if (!row) {
      res.status(404).json({ error: 'Lead nicht gefunden' });
      return;
    }
    res.json(row);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Neuen Lead erstellen
app.post('/api/leads', (req, res) => {
  const lead = req.body;
  
  const score = computeScore(lead.motivation || '', lead.sales_intent || '');
  const hasContact = lead.has_contact || false;
  const pipelineStage = assignPipeline(score, hasContact);
  const nextStep = suggestNextStep(pipelineStage, score);
  
  const sql = `
    INSERT INTO leads (
      name, phone, email, location, object_type, living_area, land_area,
      construction_year, condition, special_features, sales_intent, motivation,
      price_expectation, score, pipeline_stage, next_step, has_contact
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `;
  
  const params = [
    lead.name, lead.phone, lead.email, lead.location, lead.object_type,
    lead.living_area, lead.land_area, lead.construction_year, lead.condition,
    lead.special_features, lead.sales_intent, lead.motivation,
    lead.price_expectation, score, pipelineStage, nextStep, hasContact ? 1 : 0
  ];
  
  try {
    const result = db.run(sql, params);
    
    const newLead = {
      id: result.lastInsertRowid,
      ...lead,
      score,
      pipeline_stage: pipelineStage,
      next_step: nextStep
    };
    
    if (process.env.SMTP_USER) {
      sendNotificationEmail(newLead);
    }
    
    res.status(201).json(newLead);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Lead aktualisieren
app.put('/api/leads/:id', (req, res) => {
  const lead = req.body;
  
  const score = computeScore(lead.motivation || '', lead.sales_intent || '');
  const hasContact = lead.has_contact || false;
  const pipelineStage = assignPipeline(score, hasContact);
  const nextStep = suggestNextStep(pipelineStage, score);
  
  const sql = `
    UPDATE leads SET
      name = ?, phone = ?, email = ?, location = ?, object_type = ?,
      living_area = ?, land_area = ?, construction_year = ?, condition = ?,
      special_features = ?, sales_intent = ?, motivation = ?,
      price_expectation = ?, score = ?, pipeline_stage = ?, next_step = ?,
      has_contact = ?, updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `;
  
  const params = [
    lead.name, lead.phone, lead.email, lead.location, lead.object_type,
    lead.living_area, lead.land_area, lead.construction_year, lead.condition,
    lead.special_features, lead.sales_intent, lead.motivation,
    lead.price_expectation, score, pipelineStage, nextStep, hasContact ? 1 : 0,
    req.params.id
  ];
  
  try {
    const result = db.run(sql, params);
    if (result.changes === 0) {
      res.status(404).json({ error: 'Lead nicht gefunden' });
      return;
    }
    res.json({
      id: parseInt(req.params.id),
      ...lead,
      score,
      pipeline_stage: pipelineStage,
      next_step: nextStep
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Lead löschen
app.delete('/api/leads/:id', (req, res) => {
  try {
    const result = db.run('DELETE FROM leads WHERE id = ?', [req.params.id]);
    if (result.changes === 0) {
      res.status(404).json({ error: 'Lead nicht gefunden' });
      return;
    }
    res.json({ message: 'Lead gelöscht' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// E-Mail an Lead senden
app.post('/api/leads/:id/send-email', async (req, res) => {
  const { subject, message } = req.body;
  
  try {
    const lead = db.get('SELECT * FROM leads WHERE id = ?', [req.params.id]);
    if (!lead || !lead.email) {
      res.status(404).json({ error: 'Lead oder E-Mail nicht gefunden' });
      return;
    }
    
    await transporter.sendMail({
      from: process.env.SMTP_USER,
      to: lead.email,
      subject: subject,
      text: message,
      html: `<p>${message.replace(/\\n/g, '<br>')}</p>`
    });
    
    res.json({ message: 'E-Mail erfolgreich gesendet' });
  } catch (err) {
    res.status(500).json({ error: 'E-Mail konnte nicht gesendet werden: ' + err.message });
  }
});

// Benachrichtigungs-E-Mail an Betreiber senden
async function sendNotificationEmail(lead) {
  if (!process.env.NOTIFICATION_EMAIL) return;
  
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; color: #333;">
      <div style="background: linear-gradient(135deg, #1a472a 0%, #2d5a3d 100%); padding: 20px; text-align: center;">
        <h1 style="color: white; margin: 0; font-size: 24px;">🐵 Neuer Lead eingegangen</h1>
      </div>
      
      <div style="padding: 30px; background: #fff;">
        <p>Ein neuer Lead hat das Kontaktformular auf Ihrer Webseite ausgefüllt.</p>
        
        <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
          <tr style="background: #f9f9f9;">
            <td style="padding: 12px; border: 1px solid #ddd; font-weight: bold; width: 40%;">Name</td>
            <td style="padding: 12px; border: 1px solid #ddd;">${lead.name}</td>
          </tr>
          <tr>
            <td style="padding: 12px; border: 1px solid #ddd; font-weight: bold;">E-Mail</td>
            <td style="padding: 12px; border: 1px solid #ddd;"><a href="mailto:${lead.email}">${lead.email}</a></td>
          </tr>
          <tr style="background: #f9f9f9;">
            <td style="padding: 12px; border: 1px solid #ddd; font-weight: bold;">Telefon</td>
            <td style="padding: 12px; border: 1px solid #ddd;"><a href="tel:${lead.phone}">${lead.phone}</a></td>
          </tr>
          <tr>
            <td style="padding: 12px; border: 1px solid #ddd; font-weight: bold;">Ort</td>
            <td style="padding: 12px; border: 1px solid #ddd;">${lead.location}</td>
          </tr>
          ${lead.object_type ? `
          <tr style="background: #f9f9f9;">
            <td style="padding: 12px; border: 1px solid #ddd; font-weight: bold;">Objektart</td>
            <td style="padding: 12px; border: 1px solid #ddd;">${lead.object_type}</td>
          </tr>` : ''}
          <tr>
            <td style="padding: 12px; border: 1px solid #ddd; font-weight: bold;">Score</td>
            <td style="padding: 12px; border: 1px solid #ddd;"><span style="background: ${lead.score === 'A' ? '#27ae60' : lead.score === 'B' ? '#f39c12' : '#e74c3c'}; color: white; padding: 4px 12px; border-radius: 4px; font-weight: bold;">${lead.score}</span></td>
          </tr>
          <tr style="background: #f9f9f9;">
            <td style="padding: 12px; border: 1px solid #ddd; font-weight: bold;">Pipeline</td>
            <td style="padding: 12px; border: 1px solid #ddd;">${lead.pipeline_stage}</td>
          </tr>
        </table>
        
        <div style="text-align: center; margin: 30px 0;">
          <a href="${process.env.CRM_URL || 'http://localhost:3001'}/api/leads/${lead.id}" 
             style="background: linear-gradient(135deg, #1a472a 0%, #2d5a3d 100%); color: white; padding: 14px 28px; text-decoration: none; border-radius: 8px; display: inline-block; font-weight: bold;">
            Lead im CRM öffnen
          </a>
        </div>
        
        <p style="font-size: 12px; color: #666; margin-top: 30px;">
          Diese E-Mail wurde automatisch vom Immomonkey CRM versendet.
        </p>
      </div>
    </div>
  `;
  
  try {
    await transporter.sendMail({
      from: `\"Immomonkey CRM\" <${process.env.SMTP_USER}>`,
      to: process.env.NOTIFICATION_EMAIL,
      subject: `🐵 Neuer Lead: ${lead.name} aus ${lead.location}`,
      html: html
    });
    console.log('Benachrichtigungs-E-Mail gesendet an:', process.env.NOTIFICATION_EMAIL);
  } catch (err) {
    console.error('Fehler beim Senden der Benachrichtigung:', err);
  }
}

// ÖFFENTLICHER API-ENDPUNKT für Website-Widget
app.post('/api/leads/public', (req, res) => {
  const lead = req.body;
  
  if (!lead.name || !lead.email || !lead.phone || !lead.location) {
    res.status(400).json({ error: 'Name, E-Mail, Telefon und Ort sind erforderlich' });
    return;
  }
  
  const score = 'C';
  const pipelineStage = 'Neuer Lead';
  const nextStep = 'Kontakt aufnehmen: sofort anrufen oder eine E-Mail schicken.';
  
  const sql = `
    INSERT INTO leads (
      name, phone, email, location, object_type, living_area, land_area,
      construction_year, condition, special_features, sales_intent, motivation,
      price_expectation, score, pipeline_stage, next_step, has_contact
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `;
  
  const params = [
    lead.name, lead.phone, lead.email, lead.location, lead.object_type || '',
    '', '', '', '', '', '', '',
    '', score, pipelineStage, nextStep, 0
  ];
  
  try {
    const result = db.run(sql, params);
    
    const newLead = {
      id: result.lastInsertRowid,
      ...lead,
      score,
      pipeline_stage: pipelineStage,
      next_step: nextStep
    };
    
    if (process.env.SMTP_USER) {
      sendNotificationEmail(newLead);
      sendWelcomeEmail(newLead);
      sendDataRequestEmail(newLead);
    }
    
    res.status(201).json({ 
      success: true, 
      message: 'Lead erfolgreich erstellt',
      leadId: result.lastInsertRowid 
    });
  } catch (err) {
    console.error('Fehler beim Speichern des Leads:', err);
    res.status(500).json({ error: 'Fehler beim Speichern. Bitte versuchen Sie es später erneut.' });
  }
});

// Willkommens-E-Mail an neuen Lead
async function sendWelcomeEmail(lead) {
  if (!lead.email) return;
  
  const subject = 'Willkommen bei Immomonkey - Ihre Ersteinschätzung';
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; color: #333;">
      <div style="background: linear-gradient(135deg, #1a472a 0%, #2d5a3d 100%); padding: 30px; text-align: center;">
        <h1 style="color: white; margin: 0; font-size: 28px;">🐵 Immomonkey</h1>
        <p style="color: rgba(255,255,255,0.9); margin: 10px 0 0;">Ihr Immobilien-Stratege</p>
      </div>
      
      <div style="padding: 30px; background: #fff;">
        <h2 style="color: #1a472a;">Hallo ${lead.name},</h2>
        
        <p>vielen Dank für Ihre Anfrage bezüglich einer kostenlosen Ersteinschätzung Ihrer Immobilie in <strong>${lead.location}</strong>.</p>
        
        <p>Wir haben Ihre Daten erhalten und werden uns in Kürze bei Ihnen melden.</p>
        
        <div style="background: #f5faf7; border-left: 4px solid #1a472a; padding: 20px; margin: 20px 0;">
          <h3 style="margin-top: 0; color: #1a472a;">Was passiert als Nächstes?</h3>
          <ol style="padding-left: 20px; margin: 0;">
            <li style="margin-bottom: 10px;">Wir prüfen Ihre Anfrage</li>
            <li style="margin-bottom: 10px;">Sie erhalten eine E-Mail mit weiteren Fragen zu Ihrer Immobilie</li>
            <li style="margin-bottom: 10px;">Nach Erhalt Ihrer Antworten erstellen wir Ihre persönliche Ersteinschätzung</li>
          </ol>
        </div>
        
        <p>Bei dringenden Fragen erreichen Sie uns telefonisch oder per E-Mail.</p>
        
        <p style="margin-top: 30px;">
          Mit freundlichen Grüßen<br>
          <strong>Ihr Immomonkey Team</strong>
        </p>
      </div>
      
      <div style="background: #f5f5f5; padding: 20px; text-align: center; font-size: 12px; color: #666;">
        <p>Diese E-Mail wurde automatisch versendet. Bitte antworten Sie nicht auf diese E-Mail.</p>
      </div>
    </div>
  `;
  
  try {
    await transporter.sendMail({
      from: `\"Immomonkey\" <${process.env.SMTP_USER}>`,
      to: lead.email,
      subject: subject,
      html: html
    });
    console.log('Willkommens-E-Mail gesendet an:', lead.email);
  } catch (err) {
    console.error('Fehler beim Senden der Willkommens-E-Mail:', err);
  }
}

// Datenabfrage-E-Mail an neuen Lead
async function sendDataRequestEmail(lead) {
  if (!lead.email) return;
  
  const subject = 'Bitte ergänzen Sie Ihre Immobiliendaten';
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; color: #333;">
      <div style="background: linear-gradient(135deg, #1a472a 0%, #2d5a3d 100%); padding: 30px; text-align: center;">
        <h1 style="color: white; margin: 0; font-size: 28px;">🐵 Immomonkey</h1>
        <p style="color: rgba(255,255,255,0.9); margin: 10px 0 0;">Ihr Immobilien-Stratege</p>
      </div>
      
      <div style="padding: 30px; background: #fff;">
        <h2 style="color: #1a472a;">Hallo ${lead.name},</h2>
        
        <p>um Ihnen eine möglichst genaue Ersteinschätzung Ihrer Immobilie in <strong>${lead.location}</strong> zu erstellen, benötigen wir noch einige zusätzliche Informationen.</p>
        
        <div style="background: #f5faf7; border-left: 4px solid #1a472a; padding: 20px; margin: 20px 0;">
          <h3 style="margin-top: 0; color: #1a472a;">Bitte beantworten Sie folgende Fragen:</h3>
          
          <ol style="padding-left: 20px; margin: 0; line-height: 2;">
            <li><strong>Objektart:</strong> Handelt es sich um ein Haus, eine Wohnung oder ein Grundstück?</li>
            <li><strong>Wohnfläche:</strong> Wie groß ist die Wohnfläche in etwa (in m²)?</li>
            <li><strong>Grundstücksgröße:</strong> Wie groß ist das Grundstück (in m²)?</li>
            <li><strong>Baujahr:</strong> In welchem Jahr wurde das Objekt gebaut?</li>
            <li><strong>Zustand:</strong> Wie würden Sie den Zustand beschreiben (schlecht/befriedigend/gut/sehr gut/ausgezeichnet)?</li>
            <li><strong>Besonderheiten:</strong> Gibt es besondere Merkmale (z.B. Pool, Garage, Solaranlage, etc.)?</li>
            <li><strong>Verkaufsabsicht:</strong> Planen Sie einen Verkauf (sofort/in 3-6 Monaten/später/nur Bewertung)?</li>
            <li><strong>Motivation:</strong> Was ist der Grund für die Bewertung?</li>
            <li><strong>Preisvorstellung:</strong> Haben Sie eine Preisvorstellung?</li>
          </ol>
        </div>
        
        <p><strong>Antwortmöglichkeiten:</strong></p>
        <ul>
          <li>Antworten Sie einfach auf diese E-Mail</li>
          <li>Oder rufen Sie uns an: <strong>[Ihre Telefonnummer]</strong></li>
        </ul>
        
        <p style="margin-top: 30px;">
          Mit freundlichen Grüßen<br>
          <strong>Ihr Immomonkey Team</strong>
        </p>
      </div>
      
      <div style="background: #f5f5f5; padding: 20px; text-align: center; font-size: 12px; color: #666;">
        <p>Diese E-Mail wurde automatisch versendet.</p>
      </div>
    </div>
  `;
  
  try {
    await transporter.sendMail({
      from: `\"Immomonkey\" <${process.env.SMTP_USER}>`,
      to: lead.email,
      subject: subject,
      html: html
    });
    console.log('Datenabfrage-E-Mail gesendet an:', lead.email);
  } catch (err) {
    console.error('Fehler beim Senden der Datenabfrage-E-Mail:', err);
  }
}

// Statistiken abrufen
app.get('/api/stats', (req, res) => {
  try {
    const totalRow = db.get('SELECT COUNT(*) as total FROM leads');
    const pipelineRows = db.all('SELECT pipeline_stage, COUNT(*) as count FROM leads GROUP BY pipeline_stage');
    const scoreRows = db.all('SELECT score, COUNT(*) as count FROM leads GROUP BY score');
    
    res.json({
      total: totalRow.total,
      by_pipeline: pipelineRows,
      by_score: scoreRows
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Frontend für alle anderen Routen
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});

// Server starten
app.listen(PORT, () => {
  console.log(`Server läuft auf Port ${PORT}`);
  console.log(`API verfügbar unter http://localhost:${PORT}/api`);
});

// Graceful shutdown
process.on('SIGINT', () => {
  try {
    db.close();
    console.log('Datenbankverbindung geschlossen');
  } catch (err) {
    console.error(err.message);
  }
  process.exit(0);
});
'''

# Speichern
with open('/mnt/kimi/output/server_better_sqlite3.js', 'w', encoding='utf-8') as f:
    f.write(server_js_content)

print("✅ Neue server.js mit better-sqlite3 erstellt!")
print("\nWichtige Änderungen:")
print("- import sqlite3 → import Database from 'better-sqlite3'")
print("- Asynchrone Callbacks → Synchrone API")
print("- db.run() → db.run() mit return value")
print("- db.get() → db.get() synchron")
print("- db.all() → db.all() synchron")
print("- db.exec() für CREATE TABLE")
