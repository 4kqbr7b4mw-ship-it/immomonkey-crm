const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const nodemailer = require('nodemailer');

const app = express();
const PORT = process.env.PORT || 3000;
const DATA_FILE = path.join(__dirname, 'data', 'leads.json');

// SMTP Configuration - KORRIGIERT für Alfahosting
const smtpPort = parseInt(process.env.SMTP_PORT) || 587;
const smtpConfig = {
    host: process.env.SMTP_HOST || 'host353.alfahosting-server.de',
    port: smtpPort,
    secure: smtpPort === 465, // true nur für Port 465, false für 587
    auth: {
        user: process.env.SMTP_USER || 'office@immomonkey.de',
        pass: process.env.SMTP_PASS || ''
    },
    tls: {
        rejectUnauthorized: false // WICHTIG für Alfahosting
    }
};

const notificationEmail = process.env.NOTIFICATION_EMAIL || 'office@immomonkey.de';
const transporter = nodemailer.createTransport(smtpConfig);

// Middleware
app.use(cors());
app.use(express.json());

// Ensure data directory exists
function ensureDataDir() {
    const dataDir = path.dirname(DATA_FILE);
    if (!fs.existsSync(dataDir)) {
        fs.mkdirSync(dataDir, { recursive: true });
    }
    if (!fs.existsSync(DATA_FILE)) {
        fs.writeFileSync(DATA_FILE, JSON.stringify([]));
    }
}

function loadLeads() {
    ensureDataDir();
    try {
        const data = fs.readFileSync(DATA_FILE, 'utf8');
        return JSON.parse(data);
    } catch (err) {
        return [];
    }
}

function saveLeads(leads) {
    ensureDataDir();
    fs.writeFileSync(DATA_FILE, JSON.stringify(leads, null, 2));
}

async function sendEmail(to, subject, html, text) {
    try {
        const info = await transporter.sendMail({
            from: `"Immomonkey CRM" <${smtpConfig.auth.user}>`,
            to: to,
            subject: subject,
            text: text,
            html: html
        });
        console.log('Email sent:', info.messageId);
        return { success: true, messageId: info.messageId };
    } catch (error) {
        console.error('Email error:', error);
        return { success: false, error: error.message };
    }
}

async function notifyAdmin(lead) {
    const subject = `Neuer Lead: ${lead.name}`;
    const html = `
        <h2>Neuer Lead eingegangen</h2>
        <table border="1" cellpadding="10" style="border-collapse: collapse;">
            <tr><td><strong>Name:</strong></td><td>${lead.name}</td></tr>
            <tr><td><strong>E-Mail:</strong></td><td>${lead.email}</td></tr>
            <tr><td><strong>Telefon:</strong></td><td>${lead.phone}</td></tr>
            <tr><td><strong>Ort:</strong></td><td>${lead.location}</td></tr>
            <tr><td><strong>Objektart:</strong></td><td>${lead.object_type}</td></tr>
            <tr><td><strong>Quelle:</strong></td><td>${lead.source}</td></tr>
            <tr><td><strong>Zeit:</strong></td><td>${new Date(lead.createdAt).toLocaleString('de-DE')}</td></tr>
        </table>
        <p><a href="https://crm.immomonkey.de">Zum CRM Dashboard</a></p>
    `;
    const text = `Neuer Lead: ${lead.name}, ${lead.email}, ${lead.phone}, ${lead.location}`;
    return await sendEmail(notificationEmail, subject, html, text);
}

async function confirmToLead(lead) {
    const subject = 'Ihre Anfrage bei Immomonkey';
    const html = `
        <h2>Vielen Dank, ${lead.name}!</h2>
        <p>Wir haben Ihre Anfrage erhalten und melden uns in Kürze bei Ihnen.</p>
        <h3>Ihre Angaben:</h3>
        <ul>
            <li>Ort: ${lead.location}</li>
            <li>Objektart: ${lead.object_type}</li>
        </ul>
        <p>Mit freundlichen Grüßen,<br>Ihr Immomonkey Team</p>
    `;
    const text = `Vielen Dank, ${lead.name}! Wir haben Ihre Anfrage erhalten.`;
    return await sendEmail(lead.email, subject, html, text);
}

// API Routes
app.get('/api/health', (req, res) => {
    res.json({ status: 'OK', message: 'Immomonkey CRM API läuft', timestamp: new Date().toISOString() });
});

app.get('/api/leads', (req, res) => {
    const leads = loadLeads();
    res.json(leads);
});

app.post('/api/leads/public', async (req, res) => {
    try {
        const { name, email, phone, location, object_type, source } = req.body;
        
        if (!name || !email || !phone || !location) {
            return res.status(400).json({ success: false, message: 'Pflichtfelder fehlen' });
        }
        
        const leads = loadLeads();
        const newLead = {
            id: Date.now(),
            name, email, phone, location,
            object_type: object_type || 'Unbekannt',
            source: source || 'website',
            status: 'new',
            createdAt: new Date().toISOString()
        };
        
        leads.unshift(newLead);
        saveLeads(leads);
        
        // Send emails
        const adminResult = await notifyAdmin(newLead);
        const leadResult = await confirmToLead(newLead);
        
        console.log('Lead saved:', newLead.id, 'Admin email:', adminResult.success, 'Lead email:', leadResult.success);
        
        res.status(201).json({
            success: true,
            message: 'Lead created successfully',
            data: newLead,
            emails: { admin: adminResult.success, lead: leadResult.success, adminError: adminResult.error, leadError: leadResult.error }
        });
    } catch (error) {
        console.error('Error:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

app.post('/api/leads/:id/status', (req, res) => {
    const leads = loadLeads();
    const lead = leads.find(l => l.id === parseInt(req.params.id));
    if (!lead) return res.status(404).json({ success: false, message: 'Lead not found' });
    
    lead.status = req.body.status;
    lead.updatedAt = new Date().toISOString();
    saveLeads(leads);
    res.json({ success: true, data: lead });
});

app.post('/api/leads/:id/email', async (req, res) => {
    try {
        const leads = loadLeads();
        const lead = leads.find(l => l.id === parseInt(req.params.id));
        if (!lead) return res.status(404).json({ success: false, message: 'Lead not found' });
        
        const { subject, message } = req.body;
        const html = `<h2>${subject}</h2><p>${message.replace(/\n/g, '<br>')}</p><hr><p><small>Gesendet via Immomonkey CRM</small></p>`;
        const text = `${subject}\n\n${message}\n\n---\nGesendet via Immomonkey CRM`;
        
        const result = await sendEmail(lead.email, subject, html, text);
        
        if (result.success) {
            if (!lead.emails) lead.emails = [];
            lead.emails.push({ subject, message, sentAt: new Date().toISOString(), direction: 'outgoing' });
            saveLeads(leads);
            res.json({ success: true, message: 'Email sent' });
        } else {
            res.status(500).json({ success: false, message: 'Failed to send email', error: result.error });
        }
    } catch (error) {
        res.status(500).json({ success: false, message: 'Server error', error: error.message });
    }
});

app.get('/api/email/test', async (req, res) => {
    try {
        await transporter.verify();
        res.json({ 
            success: true, 
            message: 'SMTP OK', 
            config: { 
                host: smtpConfig.host, 
                port: smtpConfig.port, 
                secure: smtpConfig.secure,
                user: smtpConfig.auth.user 
            } 
        });
    } catch (error) {
        res.status(500).json({ 
            success: false, 
            message: 'SMTP failed', 
            error: error.message,
            config: {
                host: smtpConfig.host,
                port: smtpConfig.port
            }
        });
    }
});

// Static files AFTER API routes
app.use(express.static(path.join(__dirname, 'dist')));

// Fallback for React Router
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});

app.listen(PORT, () => {
    console.log(`CRM running on port ${PORT}`);
    console.log(`SMTP: ${smtpConfig.host}:${smtpConfig.port} (secure: ${smtpConfig.secure})`);
});
