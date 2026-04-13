const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3000;
const DATA_FILE = path.join(__dirname, 'data', 'leads.json');

const BREVO_API_KEY = process.env.BREVO_API_KEY || '';
const NOTIFICATION_EMAIL = process.env.NOTIFICATION_EMAIL || 'office@immomonkey.de';
const SENDER_EMAIL = NOTIFICATION_EMAIL;
const SENDER_NAME = 'Immomonkey CRM';

// -----------------------------
// Middleware
// -----------------------------
app.use(cors());
app.use(express.json({ limit: '1mb' }));

// -----------------------------
// Helpers
// -----------------------------
function ensureDataDir() {
  const dataDir = path.dirname(DATA_FILE);
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }
  if (!fs.existsSync(DATA_FILE)) {
    fs.writeFileSync(DATA_FILE, JSON.stringify([]), 'utf8');
  }
}

function loadLeads() {
  ensureDataDir();
  try {
    const data = fs.readFileSync(DATA_FILE, 'utf8');
    const parsed = JSON.parse(data);
    return Array.isArray(parsed) ? parsed : [];
  } catch (err) {
    console.error('Fehler beim Laden der Leads:', err);
    return [];
  }
}

function saveLeads(leads) {
  ensureDataDir();
  fs.writeFileSync(DATA_FILE, JSON.stringify(leads, null, 2), 'utf8');
}

function escapeHtml(value = '') {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function isValidEmail(email = '') {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email).trim());
}

function requireBrevoKey() {
  return Boolean(BREVO_API_KEY && BREVO_API_KEY.trim());
}

// -----------------------------
// Brevo API Mailversand
// -----------------------------
async function sendEmail(to, subject, html, text) {
  try {
    if (!requireBrevoKey()) {
      return {
        success: false,
        error: 'BREVO_API_KEY fehlt'
      };
    }

    if (!isValidEmail(to)) {
      return {
        success: false,
        error: 'Ungültige Empfänger-E-Mail'
      };
    }

    const payload = {
      sender: {
        name: SENDER_NAME,
        email: SENDER_EMAIL
      },
      to: [
        {
          email: to
        }
      ],
      subject,
      htmlContent: html,
      textContent: text
    };

    const response = await fetch('https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
      headers: {
        accept: 'application/json',
        'api-key': BREVO_API_KEY,
        'content-type': 'application/json'
      },
      body: JSON.stringify(payload)
    });

    const raw = await response.text();
    let data = null;

    try {
      data = raw ? JSON.parse(raw) : null;
    } catch {
      data = raw;
    }

    if (!response.ok) {
      console.error('Brevo API Fehler:', {
        status: response.status,
        statusText: response.statusText,
        data
      });

      return {
        success: false,
        error: typeof data === 'object' && data !== null
          ? (data.message || JSON.stringify(data))
          : String(data || response.statusText)
      };
    }

    console.log('Brevo-Mail erfolgreich gesendet:', data);

    return {
      success: true,
      data
    };
  } catch (error) {
    console.error('Fehler beim Brevo-Mailversand:', error);
    return {
      success: false,
      error: error.message || 'Unbekannter Fehler'
    };
  }
}

async function notifyAdmin(lead) {
  const safeName = escapeHtml(lead.name);
  const safeEmail = escapeHtml(lead.email);
  const safePhone = escapeHtml(lead.phone);
  const safeLocation = escapeHtml(lead.location);
  const safeObjectType = escapeHtml(lead.object_type || 'Unbekannt');
  const safeSource = escapeHtml(lead.source || 'website');
  const safeCreatedAt = escapeHtml(new Date(lead.createdAt).toLocaleString('de-DE'));

  const subject = `Neuer Lead: ${lead.name}`;

  const html = `
    <h2>Neuer Lead eingegangen</h2>
    <table border="1" cellpadding="10" style="border-collapse: collapse;">
      <tr><td><strong>Name:</strong></td><td>${safeName}</td></tr>
      <tr><td><strong>E-Mail:</strong></td><td>${safeEmail}</td></tr>
      <tr><td><strong>Telefon:</strong></td><td>${safePhone}</td></tr>
      <tr><td><strong>Ort:</strong></td><td>${safeLocation}</td></tr>
      <tr><td><strong>Objektart:</strong></td><td>${safeObjectType}</td></tr>
      <tr><td><strong>Quelle:</strong></td><td>${safeSource}</td></tr>
      <tr><td><strong>Zeit:</strong></td><td>${safeCreatedAt}</td></tr>
    </table>
    <p><a href="https://crm.immomonkey.de">Zum CRM Dashboard</a></p>
  `;

  const text =
    `Neuer Lead eingegangen\n\n` +
    `Name: ${lead.name}\n` +
    `E-Mail: ${lead.email}\n` +
    `Telefon: ${lead.phone}\n` +
    `Ort: ${lead.location}\n` +
    `Objektart: ${lead.object_type || 'Unbekannt'}\n` +
    `Quelle: ${lead.source || 'website'}\n` +
    `Zeit: ${new Date(lead.createdAt).toLocaleString('de-DE')}`;

  return sendEmail(NOTIFICATION_EMAIL, subject, html, text);
}

async function confirmToLead(lead) {
  const safeName = escapeHtml(lead.name);
  const safeLocation = escapeHtml(lead.location);
  const safeObjectType = escapeHtml(lead.object_type || 'Unbekannt');

  const subject = 'Ihre Anfrage bei Immomonkey';

  const html = `
    <h2>Vielen Dank, ${safeName}!</h2>
    <p>Wir haben Ihre Anfrage erhalten und melden uns in Kürze bei Ihnen.</p>
    <h3>Ihre Angaben:</h3>
    <ul>
      <li>Ort: ${safeLocation}</li>
      <li>Objektart: ${safeObjectType}</li>
    </ul>
    <p>Mit freundlichen Grüßen<br>Ihr Immomonkey Team</p>
  `;

  const text =
    `Vielen Dank, ${lead.name}!\n\n` +
    `Wir haben Ihre Anfrage erhalten und melden uns in Kürze bei Ihnen.\n\n` +
    `Ihre Angaben:\n` +
    `Ort: ${lead.location}\n` +
    `Objektart: ${lead.object_type || 'Unbekannt'}\n\n` +
    `Mit freundlichen Grüßen\nIhr Immomonkey Team`;

  return sendEmail(lead.email, subject, html, text);
}

// -----------------------------
// API Routes
// -----------------------------
app.get('/api/health', (req, res) => {
  res.json({
    status: 'OK',
    message: 'Immomonkey CRM API läuft',
    timestamp: new Date().toISOString()
  });
});

app.get('/api/email/test', async (req, res) => {
  try {
    if (!requireBrevoKey()) {
      return res.status(500).json({
        success: false,
        message: 'BREVO API Key fehlt'
      });
    }

    const result = await sendEmail(
      NOTIFICATION_EMAIL,
      'Brevo API Test - Immomonkey CRM',
      '<h2>Brevo API Test erfolgreich</h2><p>Diese E-Mail wurde über die Brevo API versendet.</p>',
      'Brevo API Test erfolgreich. Diese E-Mail wurde über die Brevo API versendet.'
    );

    if (!result.success) {
      return res.status(500).json({
        success: false,
        message: 'Brevo API Versand fehlgeschlagen',
        error: result.error
      });
    }

    res.json({
      success: true,
      message: 'Brevo API OK',
      data: result.data || null
    });
  } catch (error) {
    console.error('Fehler in /api/email/test:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
});

app.get('/api/leads', (req, res) => {
  const leads = loadLeads();
  res.json(leads);
});

app.get('/api/stats', (req, res) => {
  try {
    const leads = loadLeads();

    const stats = {
      total: leads.length,
      by_pipeline: [
        {
          label: 'Neuer Lead',
          count: leads.filter(l => l.status === 'new').length
        },
        {
          label: 'Kontakt hergestellt',
          count: leads.filter(l => l.status === 'contacted').length
        },
        {
          label: 'Qualifiziert',
          count: leads.filter(l => l.status === 'qualified').length
        }
      ],
      by_score: [
        {
          label: 'A',
          count: leads.filter(l => l.score === 'A').length
        },
        {
          label: 'B',
          count: leads.filter(l => l.score === 'B').length
        },
        {
          label: 'C',
          count: leads.filter(l => l.score === 'C').length
        }
      ]
    };

    res.json(stats);
  } catch (error) {
    console.error('Fehler in /api/stats:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
});

// Manuelles Anlegen im CRM
app.post('/api/leads', (req, res) => {
  try {
    const leads = loadLeads();

    const newLead = {
      id: Date.now(),
      name: String(req.body.name || '').trim(),
      phone: String(req.body.phone || '').trim(),
      email: String(req.body.email || '').trim(),
      location: String(req.body.location || '').trim(),
      object_type: String(req.body.object_type || '').trim(),
      living_area: String(req.body.living_area || '').trim(),
      land_area: String(req.body.land_area || '').trim(),
      construction_year: String(req.body.construction_year || '').trim(),
      condition: String(req.body.condition || '').trim(),
      special_features: String(req.body.special_features || '').trim(),
      sales_intent: String(req.body.sales_intent || '').trim(),
      motivation: String(req.body.motivation || '').trim(),
      price_expectation: String(req.body.price_expectation || '').trim(),
      has_contact: req.body.has_contact === true,
      status: 'new',
      source: 'crm_manual',
      createdAt: new Date().toISOString()
    };

    if (!newLead.name) {
      return res.status(400).json({
        success: false,
        message: 'Name ist erforderlich'
      });
    }

    leads.unshift(newLead);
    saveLeads(leads);

    res.status(201).json({
      success: true,
      message: 'Lead erfolgreich erstellt',
      data: newLead
    });
  } catch (error) {
    console.error('Fehler in /api/leads:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
});

app.post('/api/leads/public', async (req, res) => {
  try {
    const { name, email, phone, location, object_type, source } = req.body;

    if (!name || !email || !phone || !location) {
      return res.status(400).json({
        success: false,
        message: 'Pflichtfelder fehlen'
      });
    }

    if (!isValidEmail(email)) {
      return res.status(400).json({
        success: false,
        message: 'Ungültige E-Mail-Adresse'
      });
    }

    const leads = loadLeads();

    const newLead = {
      id: Date.now(),
      name: String(name).trim(),
      email: String(email).trim(),
      phone: String(phone).trim(),
      location: String(location).trim(),
      object_type: object_type ? String(object_type).trim() : 'Unbekannt',
      source: source ? String(source).trim() : 'website',
      status: 'new',
      createdAt: new Date().toISOString()
    };

    leads.unshift(newLead);
    saveLeads(leads);

    const adminResult = await notifyAdmin(newLead);
    const leadResult = await confirmToLead(newLead);

    console.log('Lead gespeichert:', newLead.id);

    res.status(201).json({
      success: true,
      message: 'Lead erfolgreich erstellt',
      data: newLead,
      emails: {
        admin: adminResult.success,
        lead: leadResult.success,
        adminError: adminResult.error || null,
        leadError: leadResult.error || null
      }
    });
  } catch (error) {
    console.error('Fehler in /api/leads/public:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
});

app.put('/api/leads/:id', (req, res) => {
  try {
    const leads = loadLeads();
    const lead = leads.find(l => l.id === parseInt(req.params.id, 10));

    if (!lead) {
      return res.status(404).json({
        success: false,
        message: 'Lead not found'
      });
    }

    lead.name = String(req.body.name || '').trim();
    lead.phone = String(req.body.phone || '').trim();
    lead.email = String(req.body.email || '').trim();
    lead.location = String(req.body.location || '').trim();
    lead.object_type = String(req.body.object_type || '').trim();
    lead.living_area = String(req.body.living_area || '').trim();
    lead.land_area = String(req.body.land_area || '').trim();
    lead.construction_year = String(req.body.construction_year || '').trim();
    lead.condition = String(req.body.condition || '').trim();
    lead.special_features = String(req.body.special_features || '').trim();
    lead.sales_intent = String(req.body.sales_intent || '').trim();
    lead.motivation = String(req.body.motivation || '').trim();
    lead.price_expectation = String(req.body.price_expectation || '').trim();
    lead.has_contact = req.body.has_contact === true;
    lead.updatedAt = new Date().toISOString();

    if (!lead.name) {
      return res.status(400).json({
        success: false,
        message: 'Name ist erforderlich'
      });
    }

    saveLeads(leads);

    res.json({
      success: true,
      message: 'Lead erfolgreich aktualisiert',
      data: lead
    });
  } catch (error) {
    console.error('Fehler in PUT /api/leads/:id:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
});

app.delete('/api/leads/:id', (req, res) => {
  try {
    const leads = loadLeads();
    const index = leads.findIndex(l => l.id === parseInt(req.params.id, 10));

    if (index === -1) {
      return res.status(404).json({
        success: false,
        message: 'Lead not found'
      });
    }

    leads.splice(index, 1);
    saveLeads(leads);

    res.json({
      success: true,
      message: 'Lead gelöscht'
    });
  } catch (error) {
    console.error('Fehler in DELETE /api/leads/:id:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
});

app.post('/api/leads/:id/status', (req, res) => {
  try {
    const leads = loadLeads();
    const lead = leads.find(l => l.id === parseInt(req.params.id, 10));

    if (!lead) {
      return res.status(404).json({
        success: false,
        message: 'Lead not found'
      });
    }

    lead.status = req.body.status;
    lead.updatedAt = new Date().toISOString();
    saveLeads(leads);

    res.json({
      success: true,
      data: lead
    });
  } catch (error) {
    console.error('Fehler in /api/leads/:id/status:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
});

app.post('/api/leads/:id/email', async (req, res) => {
  try {
    const leads = loadLeads();
    const lead = leads.find(l => l.id === parseInt(req.params.id, 10));

    if (!lead) {
      return res.status(404).json({
        success: false,
        message: 'Lead not found'
      });
    }

    const { subject, message } = req.body;

    if (!subject || !message) {
      return res.status(400).json({
        success: false,
        message: 'Betreff und Nachricht fehlen'
      });
    }

    if (!isValidEmail(lead.email)) {
      return res.status(400).json({
        success: false,
        message: 'Lead hat keine gültige E-Mail-Adresse'
      });
    }

    const safeSubject = escapeHtml(subject);
    const safeMessageHtml = escapeHtml(message).replace(/\n/g, '<br>');

    const html = `
      <h2>${safeSubject}</h2>
      <p>${safeMessageHtml}</p>
      <hr>
      <p><small>Gesendet via Immomonkey CRM</small></p>
    `;

    const text = `${subject}\n\n${message}\n\n---\nGesendet via Immomonkey CRM`;

    const result = await sendEmail(lead.email, subject, html, text);

    if (!result.success) {
      return res.status(500).json({
        success: false,
        message: 'Failed to send email',
        error: result.error
      });
    }

    if (!lead.emails) {
      lead.emails = [];
    }

    lead.emails.push({
      subject,
      message,
      sentAt: new Date().toISOString(),
      direction: 'outgoing'
    });

    saveLeads(leads);

    res.json({
      success: true,
      message: 'Email sent',
      data: result.data || null
    });
  } catch (error) {
    console.error('Fehler in /api/leads/:id/email:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
});

// -----------------------------
// Static files
// -----------------------------
app.use(express.static(path.join(__dirname, 'dist')));

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});

// -----------------------------
// Start
// -----------------------------
app.listen(PORT, () => {
  console.log(`CRM running on port ${PORT}`);
  console.log(`Brevo API aktiv: ${requireBrevoKey() ? 'ja' : 'nein'}`);
  console.log(`Benachrichtigung an: ${NOTIFICATION_EMAIL}`);
});
