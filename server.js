const express = require('express');
const cors = require('cors');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());

// API Routes FIRST
app.get('/api/health', (req, res) => {
    res.json({
        status: 'OK',
        message: 'Immomonkey CRM API läuft',
        timestamp: new Date().toISOString()
    });
});

// API: Get all leads
app.get('/api/leads', (req, res) => {
    res.json([
        { id: 1, name: 'Max Mustermann', email: 'max@test.de', status: 'new', createdAt: new Date().toISOString() }
    ]);
});

// API: Create lead (public endpoint for widget)
app.post('/api/leads/public', async (req, res) => {
    try {
        const { name, email, phone, location, object_type, source } = req.body;
        
        console.log('New lead received:', { name, email, phone, location, object_type, source });
        
        // Here you would typically save to database
        // For now, just return success
        
        res.status(201).json({
            success: true,
            message: 'Lead created successfully',
            data: { id: Date.now(), name, email, status: 'new' }
        });
    } catch (error) {
        console.error('Error creating lead:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

// Static files AFTER API routes
app.use(express.static(path.join(__dirname, 'dist')));

// Fallback: Serve index.html for all non-API routes (React Router support)
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});

app.listen(PORT, () => {
    console.log(`Immomonkey CRM running on port ${PORT}`);
    console.log(`Health check: http://localhost:${PORT}/api/health`);
});
