require('dotenv').config();
const express = require('express');
const session = require('express-session');
const cors = require('cors');
const path = require('path');
const apiRoutes = require('./routes/api');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

// Session configuration
app.use(session({
    secret: process.env.SESSION_SECRET || 'default-secret',
    resave: false,
    saveUninitialized: false,
    cookie: {
        secure: false, // Set to true in production with HTTPS
        maxAge: parseInt(process.env.SESSION_TIMEOUT) || 1800000
    }
}));

// Auth middleware
const requireAuth = (req, res, next) => {
    if (req.session && req.session.user) {
        next();
    } else {
        if (req.xhr || req.headers.accept?.includes('application/json')) {
            res.status(401).json({ error: 'Not authenticated' });
        } else {
            res.redirect('/login');
        }
    }
};

// Routes
app.use('/api', apiRoutes);

// Login page
app.get('/login', (req, res) => {
    if (req.session && req.session.user) {
        return res.redirect('/');
    }
    res.sendFile(path.join(__dirname, 'public', 'login.html'));
});

// Main app (protected)
app.get('/', requireAuth, (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Login handler
app.post('/auth/login', async (req, res) => {
    const { username, password } = req.body;
    
    if (!username || !password) {
        return res.status(400).json({ error: 'Username and password required' });
    }

    try {
        // Test authentication against AspectCTRM
        const axios = require('axios');
        const baseUrl = process.env.ASPECT_BASE_URL;
        const wsPath = process.env.ASPECT_WEBSERVICE_PATH;
        
        const response = await axios.get(`${baseUrl}${wsPath}/getProducts`, {
            headers: {
                'Authorization': 'Basic ' + Buffer.from(`${username}:${password}`).toString('base64'),
                'Accept': 'application/json'
            },
            timeout: 10000
        });

        if (response.status === 200) {
            // Store credentials in session
            req.session.user = {
                username: username,
                authHeader: 'Basic ' + Buffer.from(`${username}:${password}`).toString('base64')
            };
            res.json({ success: true, message: 'Login successful' });
        } else {
            res.status(401).json({ error: 'Invalid credentials' });
        }
    } catch (error) {
        console.error('Login error:', error.message);
        if (error.response?.status === 401) {
            res.status(401).json({ error: 'Invalid username or password' });
        } else {
            res.status(500).json({ error: 'Unable to connect to AspectCTRM server' });
        }
    }
});

// Logout handler
app.post('/auth/logout', (req, res) => {
    req.session.destroy((err) => {
        if (err) {
            res.status(500).json({ error: 'Logout failed' });
        } else {
            res.json({ success: true });
        }
    });
});

// Get current user
app.get('/auth/user', requireAuth, (req, res) => {
    res.json({ username: req.session.user.username });
});

// Start server
app.listen(PORT, () => {
    console.log(`
╔════════════════════════════════════════════════╗
║         Aspect Web App - Settlement            ║
╠════════════════════════════════════════════════╣
║  Server running on http://localhost:${PORT}        ║
║  AspectCTRM: ${process.env.ASPECT_BASE_URL}     
╚════════════════════════════════════════════════╝
    `);
});
