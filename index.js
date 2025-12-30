/**
 * ================================================================================
 * PROJECT: Sovereign Engine Hub (Master Controller)
 * MISSION: Unified Node.js orchestration for Static Assets and Sovereign API Routes.
 * ARCHITECT: Christopher Fornesa
 * VERSION: 1.8 (Multi-Stack Integration)
 * * ARCHITECTURAL DESIGN PRINCIPLES:
 * 1. MODULAR ROUTING: Mounts distinct toolsets (Tanaga, Sentiment, Contact) 
 * under specific namespace paths to prevent global namespace pollution.
 * 2. STATIC ASSET ORCHESTRATION: Serves institutional frontends from the 
 * /public directory while maintaining API-to-UI isolation.
 * 3. MIDDLEWARE LAYER: Enforces global security policies (CORS) and 
 * standardizes JSON ingestion for all downstream agents.
 * 4. ENVIRONMENT ABSTRACTION: Ingests Master Hub credentials (SMTP, reCAPTCHA) 
 * from .env for secure infrastructure handling.
 * ================================================================================
 */

require('dotenv').config();
const express = require('express');
const path = require('path');
const cors = require('cors');

const app = express();

/**
 * A. GLOBAL MIDDLEWARE
 * Standardizes the data ingestion format and security handshake for the Hub.
 */
app.use(cors()); // Permits cross-origin requests for embedded agents (iframes).
app.use(express.json()); // Parses incoming JSON payloads for API routes.

/**
 * B. LOGGING DEBUGGER (Institutional Audit Trail)
 * Monitors request flow and maps requested URLs to the local file system.
 */
app.use((req, res, next) => {
    const timestamp = new Date().toISOString();
    console.log(`[${timestamp}] Request: ${req.method} ${req.url}`);
    next();
});

/**
 * C. API ROUTING (Tool Registration)
 * Connects the modular logic files to the Engine Hub's network interface.
 */
const tanagaRoutes = require('./routes/tanaga');
const sentimentRoutes = require('./routes/sentiment');
const contactRoutes = require('./routes/contact'); // Newly provisioned Contact Stack

// Namespace Mappings
app.use('/api/tanaga-agent', tanagaRoutes);
app.use('/api/sentiment-pipeline', sentimentRoutes);
app.use('/api/contact', contactRoutes); // Mounting the Contact API Gateway

/**
 * D. STATIC ASSET SERVING
 * Serves the frontends for the Provisioners, Agents, and Dashboard.
 * Folder Structure:
 * - /public/index.html (Dashboard)
 * - /public/contact/index.html (Provisioner)
 * - /public/contact/widget.html (Sovereign Agent)
 */
app.use(express.static(path.join(__dirname, 'public')));

/**
 * E. SERVER INITIALIZATION
 * Boots the Sovereign Engine Hub and announces the status of institutional endpoints.
 */
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`\n\x1b[32m[SOVEREIGN ENGINE HUB ONLINE]\x1b[0m`);
    console.log(`\x1b[36mCore Dashboard:\x1b[0m   http://localhost:${PORT}/`);
    console.log(`\x1b[36mTanaga Agent:\x1b[0m     http://localhost:${PORT}/tanaga-agent/`);
    console.log(`\x1b[36mSentiment Pipeline:\x1b[0m http://localhost:${PORT}/sentiment-pipeline/`);
    console.log(`\x1b[36mContact Stack:\x1b[0m      http://localhost:${PORT}/contact/`);
    console.log(`\n\x1b[33m[INFRASTRUCTURE STATUS: READY]\x1b[0m\n`);
});