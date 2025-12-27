/**
 * ARCHITECTURAL CONTEXT: Sovereign Sentiment Ingestion Server
 * GOVERNANCE: Asynchronous Streaming & Institutional Persistence.
 * * OPERATIONAL SPECS:
 * 1. HEADLESS EXECUTION: Acts as a JSON API for frontend ingestion and display.
 * 2. MEMORY EFFICIENCY: Uses Node.js Streams to process CSV files row-by-row, 
 * preventing server crashes during high-volume research uploads.
 * 3. ENVIRONMENT AWARENESS: Switches between Sandbox (127.0.0.1) and 
 * Institutional (Hostinger) database pools based on environment variables.
 */

require('dotenv').config();
const express = require('express');
const multer  = require('multer');
const csv     = require('csv-parser');
const fs      = require('fs');
const mysql   = require('mysql2/promise');
const cors    = require('cors');
const { analyzeText } = require('./processor');

const app = express();
const upload = multer({ dest: 'uploads/' });

/* 1. MIDDLEWARE CONFIGURATION */
app.use(cors());
app.use(express.json());
app.use(express.static('public')); // Provides the UI (index.html, display.html)

/* 2. DATABASE CONNECTION POOLING */
// Reuses connections for better performance compared to standard synchronous queries.
const pool = mysql.createPool({
    host: process.env.DB_HOST || '127.0.0.1',
    user: process.env.DB_USER,
    password: process.env.DB_PASS,
    database: process.env.DB_NAME,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
});

/* 3. INGESTION ROUTE (ASYNCHRONOUS PIPELINE) */
app.post('/api/ingest', upload.single('csv_file'), async (req, res) => {
    // Guard clause: Ensure file presence
    if (!req.file) return res.status(400).json({ error: 'No CSV file detected.' });

    const bins = new Array(11).fill(0); // 11-bin polarity distribution (-1.0 to +1.0)
    const postCol = (req.body.post_column || 'post').toLowerCase();
    const projectTitle = req.body.chart_title || 'New Analysis';

    try {
        /**
         * STREAMING LOGIC:
         * We read the file from disk as a stream to keep the memory footprint low.
         * The 'on data' event fires for every individual row processed.
         */
        const stream = fs.createReadStream(req.file.path).pipe(csv());

        stream.on('data', (row) => {
            // Normalize CSV keys to lowercase for robustness
            const normalizedRow = Object.keys(row).reduce((acc, key) => {
                acc[key.toLowerCase()] = row[key];
                return acc;
            }, {});

            const text = normalizedRow[postCol] || '';
            const analysis = analyzeText(text);

            // MATH: Convert -1.0/+1.0 score to an integer index between 0 and 10
            const binIndex = Math.min(10, Math.max(0, Math.round((analysis.score + 1) * 5)));
            bins[binIndex]++;
        });

        stream.on('end', async () => {
            try {
                // PERSISTENCE: Record statistical aggregates in the institutional DB
                const [dbResult] = await pool.execute(
                    `INSERT INTO sentiment_aggregates 
                    (project_title, bin_n1_0, bin_n0_8, bin_n0_6, bin_n0_4, bin_n0_2, bin_0_0, bin_p0_2, bin_p0_4, bin_p0_6, bin_p0_8, bin_p1_0) 
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                    [projectTitle, ...bins]
                );

                res.json({ 
                    success: true, 
                    id: dbResult.insertId, 
                    bins,
                    mode: process.env.DB_HOST ? 'Institutional' : 'Sandbox'
                });

                // FILE HYGIENE: Remove temporary CSV after processing
                fs.unlinkSync(req.file.path);
            } catch (dbErr) {
                res.status(500).json({ error: 'Database Persistence Error: ' + dbErr.message });
            }
        });
    } catch (err) {
        res.status(500).json({ error: 'Critical Stream Error: ' + err.message });
    }
});

/* 4. HEADLESS VISUALIZATION API */
// Serves read-only aggregate data for iframes (display.html)
app.get('/api/display/:id', async (req, res) => {
    try {
        const [rows] = await pool.execute('SELECT * FROM sentiment_aggregates WHERE id = ?', [req.params.id]);
        if (rows.length === 0) return res.status(404).json({ error: 'Dataset not found.' });
        res.json(rows[0]);
    } catch (err) {
        res.status(500).json({ error: 'Query Error: ' + err.message });
    }
});

// Start Server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`\x1b[36m%s\x1b[0m`, `Sovereign Server Online :: Port ${PORT}`);
});