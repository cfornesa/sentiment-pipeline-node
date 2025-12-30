/**
 * ================================================================================
 * PROJECT: Sovereign Contact Controller (Node.js)
 * MISSION: Identity-validated, stateless email dispatch via Node.js/Express.
 * ARCHITECT: Christopher Fornesa
 * VERSION: 1.8 (Handshake & Routing Edition)
 * ================================================================================
 */

const express = require('express');
const router = express.Router();
const axios = require('axios');
const path = require('path');
const sqlite3 = require('sqlite3').verbose();
const { sendInquiry } = require('../utils/mailer'); 

// --- 1. INFRASTRUCTURE HANDSHAKE ---
const dbPath = path.join(__dirname, '../contact.sqlite');
const db = new sqlite3.Database(dbPath);

/**
 * DATABASE INITIALIZATION
 * Uses serialize() to ensure the table exists before any transactions occur.
 * Includes the updated schema for Sovereign reCAPTCHA keys.
 */
db.serialize(() => {
    db.run(`CREATE TABLE IF NOT EXISTS contact_identities (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        email_hash TEXT UNIQUE,
        raw_email TEXT,
        recaptcha_site_key TEXT,
        recaptcha_secret_key TEXT,
        consent_timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
        consent_ip TEXT
    )`, (err) => {
        if (err) {
            console.error("Vault Initialization Failure:", err.message);
        } else {
            console.log("Vault Status: SECURE & SYNCHRONIZED");
        }
    });
});

// --- 2. PROVISIONING ROUTES ---

/**
 * ROUTE: GET /api/contact/hub-config
 * PURPOSE: Securely shares the Master Hub Site Key with the Provisioner UI.
 */
router.get('/hub-config', (req, res) => {
    try {
        const masterKey = process.env.RECAPTCHA_SITE_KEY;
        if (!masterKey) {
            console.error("CRITICAL: RECAPTCHA_SITE_KEY missing from .env");
            return res.status(500).json({ error: "Server Infrastructure Error." });
        }
        res.json({ masterSiteKey: masterKey });
    } catch (err) {
        res.status(500).json({ error: "Configuration handshake failed." });
    }
});

/**
 * ROUTE: POST /api/contact/provision
 * PURPOSE: Securely registers or retrieves a researcher's identity and security keys.
 */
router.post('/provision', async (req, res) => {
    const { email, siteKey, secretKey, captchaToken, privacyConsent } = req.body;

    if (!email || !privacyConsent || !siteKey || !secretKey) {
        return res.status(400).json({ error: "Institutional verification requires all security fields." });
    }

    const cleanEmail = email.toLowerCase().trim();

    try {
        const verifyUrl = `https://www.google.com/recaptcha/api/siteverify?secret=${process.env.RECAPTCHA_SECRET}&response=${captchaToken}`;
        const captchaRes = await axios.post(verifyUrl);

        if (!captchaRes.data.success || captchaRes.data.score < 0.5) {
            return res.status(403).json({ error: "Security Handshake Failed: Bot activity detected." });
        }

        db.get("SELECT id FROM contact_identities WHERE email_hash = ?", [cleanEmail], (err, row) => {
            if (err) return res.status(500).json({ error: "Vault Interrogation Error." });

            if (row) {
                return res.json({ 
                    status: "existing",
                    id: row.id,
                    embedCode: `<iframe src="/contact/widget.html?id=${row.id}" width="100%" height="500" frameborder="0"></iframe>`
                });
            } else {
                const stmt = db.prepare(`INSERT INTO contact_identities 
                    (email_hash, raw_email, recaptcha_site_key, recaptcha_secret_key, consent_ip) 
                    VALUES (?, ?, ?, ?, ?)`);

                stmt.run(cleanEmail, cleanEmail, siteKey, secretKey, req.ip, function(err) {
                    if (err) return res.status(500).json({ error: "Identity Provisioning Failed." });

                    res.json({
                        status: "new",
                        id: this.lastID,
                        embedCode: `<iframe src="/contact/widget.html?id=${this.lastID}" width="100%" height="500" frameborder="0"></iframe>`
                    });
                });
            }
        });
    } catch (error) {
        res.status(500).json({ error: "Sovereign Engine Unavailable." });
    }
});

// --- 3. DISPATCH & WIDGET ROUTES ---

/**
 * ROUTE: POST /api/contact/send
 * PURPOSE: Performs sovereign reCAPTCHA validation and dispatches the inquiry.
 */
router.post('/send', async (req, res) => {
    const { id, senderEmail, subject, message, captchaToken } = req.body;

    if (!id || !senderEmail || !message || !captchaToken) {
        return res.status(400).json({ error: "Inquiry data incomplete." });
    }

    try {
        db.get("SELECT raw_email, recaptcha_secret_key FROM contact_identities WHERE id = ?", [id], async (err, row) => {
            if (err || !row) return res.status(404).json({ error: "Researcher ID invalid or revoked." });

            const researcherEmail = row.raw_email;
            const userSecretKey = row.recaptcha_secret_key;

            const verifyUrl = `https://www.google.com/recaptcha/api/siteverify?secret=${userSecretKey}&response=${captchaToken}`;
            const captchaRes = await axios.post(verifyUrl);

            if (captchaRes.data.success && captchaRes.data.score >= 0.5) {
                try {
                    await sendInquiry(researcherEmail, senderEmail, subject, message);
                    res.json({ success: true, message: "Inquiry dispatched." });
                } catch (mailErr) {
                    res.status(500).json({ error: "SMTP Gateway Transmission Failure." });
                }
            } else {
                res.status(403).json({ error: "Security Verification Failed: Bot activity detected." });
            }
        });
    } catch (error) {
        res.status(500).json({ error: "Internal Dispatch Error." });
    }
});

/**
 * ROUTE: GET /api/contact/config/:id
 * PURPOSE: Provides the sovereign public Site Key to the widget.
 */
router.get('/config/:id', (req, res) => {
    db.get("SELECT recaptcha_site_key FROM contact_identities WHERE id = ?", [req.params.id], (err, row) => {
        if (err || !row) return res.status(404).json({ error: "Configuration ID not found." });
        res.json({ siteKey: row.recaptcha_site_key });
    });
});

module.exports = router;