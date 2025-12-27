/**
 * ARCHITECTURAL CONTEXT: Sovereign Engine Hub
 * MISSION: Centralized routing for multiple research utilities.
 */

require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');

const app = express();

// MIDDLEWARE
app.use(cors());
app.use(express.json());

// 1. STATIC ASSETS: Serves everything in the public folder
app.use(express.static(path.join(__dirname, 'public')));

// 2. MODULAR ROUTING: Points to the sentiment logic
const sentimentRoutes = require('./routes/sentiment');
app.use('/api/sentiment-pipeline', sentimentRoutes);

// START SERVER
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`\x1b[36m%s\x1b[0m`, `Sovereign Engine Active :: Port ${PORT}`);
    console.log(`UI Path: /sentiment-pipeline/index.html`);
});