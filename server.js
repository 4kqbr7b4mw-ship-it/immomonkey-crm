const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3000;
const DATA_FILE = path.join(__dirname, 'data', 'leads.json');

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

// Load leads from file
function loadLeads() {
    ensureDataDir();
    try {
        const data = fs.readFileSync(DATA_FILE, 'utf8');
        return JSON.parse(data);
    } catch (err) {
        return [];
    }
}

// Save leads to file
function saveLeads(leads) {
    ensureDataDir();
    fs.writeFileSync(DATA_FILE, JSON.stringify(leads, null, 2));
}

// API: Health check
app.get('/api/health', (req, res) => {
    res.json({
        status: 'OK',
        message: 'Immomonkey CRM API läuft',
        timestamp: new Date().toISOString()
    });
});

// API: Get all leads
app.get('/api/leads', (req, res) => {
    const leads = loadLeads();
    res.json(leads);
});

// API: Create lead (public endpoint for widget)
app.post('/api/leads/public', async (req, res) => {
    try {
        const { name, email, phone, location, object_type, source } = req.body;
        
        if (!name || !email || !phone || !location) {
            return res.status(400).json({ 
                success: false, 
                message: 'Name, E-Mail, Telefon und Ort sind erforderlich' 
            });
        }
        
        const leads = loadLeads();
        
        const newLead = {
            id: Date.now(),
            name,
            email,
            phone,
            location,
            object_type: object_type || 'Unbekannt',
            source: source || 'website',
            status: 'new',
            createdAt: new Date().toISOString()
        };
        
        leads.unshift(newLead); // Add to beginning
        saveLeads(leads);
        
        console.log('New lead saved:', newLead);
        
        res.status(201).json({
            success: true,
            message: 'Lead created successfully',
            data: newLead
        });
    } catch (error) {
        console.error('Error creating lead:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

// API: Update lead status
app.post('/api/leads/:id/status', (req, res) => {
    try {
        const { id } = req.params;
        const { status } = req.body;
        
        const leads = loadLeads();
        const lead = leads.find(l => l.id === parseInt(id));
        
        if (!lead) {
            return res.status(404).json({ success: false, message: 'Lead not found' });
        }
        
        lead.status = status;
        lead.updatedAt = new Date().toISOString();
        saveLeads(leads);
        
        res.json({ success: true, data: lead });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

// Static files AFTER API routes
app.use(express.static(path.join(__dirname, 'dist')));

// Fallback: Serve index.html for all non-API routes
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});

app.listen(PORT, () => {
    console.log(`Immomonkey CRM running on port ${PORT}`);
    console.log(`Health check: http://localhost:${PORT}/api/health`);
    console.log(`Leads file: ${DATA_FILE}`);
});
