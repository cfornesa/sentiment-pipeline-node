const express = require('express');
const router = express.Router();
const multer = require('multer');
const csv = require('csv-parser');
const fs = require('fs');
const mysql = require('mysql2/promise');
const sqlite3 = require('sqlite3');
const { open } = require('sqlite');
const { analyzeText } = require('../processor'); // Note: Go up one level

const upload = multer({ dest: 'uploads/' });
let db;

// DB INITIALIZATION
async function setupDatabase() {
    const isProd = process.env.DB_HOST && process.env.DB_HOST !== '127.0.0.1';
    if (isProd) {
        db = mysql.createPool({
            host: process.env.DB_HOST,
            user: process.env.DB_USER,
            password: process.env.DB_PASS,
            database: process.env.DB_NAME
        });
    } else {
        db = await open({ filename: './sandbox.sqlite', driver: sqlite3.Database });
        await db.exec(`CREATE TABLE IF NOT EXISTS sentiment_aggregates (
            id INTEGER PRIMARY KEY AUTOINCREMENT, project_title TEXT,
            bin_n1_0 INTEGER, bin_n0_8 INTEGER, bin_n0_6 INTEGER, bin_n0_4 INTEGER, bin_n0_2 INTEGER,
            bin_0_0 INTEGER, bin_p0_2 INTEGER, bin_p0_4 INTEGER, bin_p0_6 INTEGER, bin_p0_8 INTEGER, bin_p1_0 INTEGER
        )`);
    }
}
setupDatabase();

// ROUTE: INGEST (/api/sentiment-pipeline/ingest)
router.post('/ingest', upload.single('csv_file'), async (req, res) => {
    const bins = new Array(11).fill(0);
    const postCol = (req.body.post_column || 'post').toLowerCase();
    const title = req.body.chart_title || 'New Analysis';

    const stream = fs.createReadStream(req.file.path).pipe(csv());
    stream.on('data', (row) => {
        const normalized = Object.keys(row).reduce((acc, k) => { acc[k.toLowerCase()] = row[k]; return acc; }, {});
        const text = normalized[postCol] || '';
        const score = analyzeText(text).score;
        const binIndex = Math.min(10, Math.max(0, Math.round((score + 1) * 5)));
        bins[binIndex]++;
    });

    stream.on('end', async () => {
        const sql = `INSERT INTO sentiment_aggregates (project_title, bin_n1_0, bin_n0_8, bin_n0_6, bin_n0_4, bin_n0_2, bin_0_0, bin_p0_2, bin_p0_4, bin_p0_6, bin_p0_8, bin_p1_0) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;
        const params = [title, ...bins];
        let insertId;

        if (process.env.DB_HOST && process.env.DB_HOST !== '127.0.0.1') {
            const [res] = await db.execute(sql, params);
            insertId = res.insertId;
        } else {
            const res = await db.run(sql, params);
            insertId = res.lastID;
        }
        res.json({ success: true, id: insertId, bins });
        fs.unlinkSync(req.file.path);
    });
});

// ROUTE: DISPLAY (/api/sentiment-pipeline/display/:id)
router.get('/display/:id', async (req, res) => {
    const sql = 'SELECT * FROM sentiment_aggregates WHERE id = ?';
    let row = (process.env.DB_HOST && process.env.DB_HOST !== '127.0.0.1') 
              ? (await db.execute(sql, [req.params.id]))[0][0] 
              : await db.get(sql, [req.params.id]);

    if (!row) return res.status(404).json({ error: 'Record not found' });
    res.json(row);
});

module.exports = router;