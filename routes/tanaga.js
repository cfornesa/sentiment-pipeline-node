/**
 * ================================================================================
 * PROJECT: Tanaga & Poetry Agent (Node.js Engine Module)
 * VERSION: 9.6 (Meter-Corrected Mirror)
 * ARCHITECT: Christopher Fornesa
 * MISSION: Real-time, stateless poetic inference with strict meter adherence.
 * * ARCHITECTURAL LOGIC:
 * Mirrored from Python/PHP versions to ensure cross-stack parity.
 * Uses deterministic temperature (0.1) for structural consistency.
 * ================================================================================
 */

const express = require('express');
const router = express.Router();
const axios = require('axios');

/**
 * UTILITY: redactPII
 * Masks emails and phone numbers before the data leaves the sovereign environment.
 * @param {string} text - Raw user theme.
 * @returns {string} - Anonymized string.
 */
function redactPII(text) {
    return text.replace(/[\w\.-]+@[\w\.-]+\.\w+/gi, "[EMAIL_REDACTED]")
               .replace(/\+?\d{1,4}?[-.\s]?\(?\d{1,3}?\)?[-.\s]?\d{1,4}/g, "[PHONE_REDACTED]");
}

/**
 * UTILITY: detectLanguage
 * Determines if the output should be Tagalog (7-syllable) or English (8-syllable).
 * @param {string} input - User input string.
 * @returns {string} - "English" or "Tagalog".
 */
function detectLanguage(input) {
    const inputLower = input.toLowerCase();
    const englishTriggers = ["in english", "sa ingles", "english", "english version"];
    if (englishTriggers.some(t => inputLower.includes(t))) return "English";

    const tagalogTriggers = ["tagalog", "sa tagalog", "filipino", "tanaga", "tula"];
    if (tagalogTriggers.some(t => inputLower.includes(t))) return "Tagalog";

    return "English"; // Default fallback
}

/**
 * PROMPT ENGINE: getTanagaSystemPrompt
 * Exact v9.6 System Prompts with strict syllable constraints and examples.
 */
function getTanagaSystemPrompt(language) {
    if (language === "Tagalog") {
        return (
            "You are an Expert Poet specialized in traditional Tagalog Tanaga.\n\n" +
            "STRICT METER CONSTRAINTS:\n" +
            "1. OUTPUT: ONLY ONE 4-line poem in Tagalog. No translation or explanation.\n" +
            "2. METER: EXACTLY 7 syllables per line.\n" +
            "3. CULTURAL IMAGERY: Use 'bayan' (homeland), 'loob' (inner self), 'gunita' (memory).\n" +
            "4. FORMAT: Each line must be exactly 7 syllables. No exceptions."
        );
    } else {
        return (
            "You are an Expert Poet specializing in structured English poetry.\n\n" +
            "STRICT METER CONSTRAINTS:\n" +
            "1. OUTPUT: ONLY ONE 4-line poem in English. No explanation.\n" +
            "2. METER: EXACTLY 8 syllables per line.\n" +
            "3. RYTHM: Maintain consistent iambic rhythm.\n" +
            "4. FORMAT: Each line must be exactly 8 syllables. No exceptions."
        );
    }
}

/**
 * ENDPOINT: POST /api/tanaga-agent/generate
 * Handles the async handshake with Mistral AI.
 */
router.post('/generate', async (req, res) => {
    try {
        // 1. Vault Verification
        if (!process.env.MISTRAL_API_KEY) {
            console.error("\x1b[31m[ERROR] MISTRAL_API_KEY is missing in .env file.\x1b[0m");
            return res.status(500).json({ error: "Server Configuration Error: API Key missing." });
        }

        // 2. Data Preparation
        const safeInput = redactPII(req.body.user_input || "");
        const language = detectLanguage(safeInput);
        const systemPrompt = getTanagaSystemPrompt(language);
        const userContent = `Write ONE ${language} poem about: ${safeInput}. Follow meter EXACTLY. 7 syllables for Tagalog, 8 for English.`;

        // 3. AI Handshake
        const response = await axios.post('https://api.mistral.ai/v1/chat/completions', {
            model: "mistral-tiny",
            messages: [
                { role: "system", content: systemPrompt },
                { role: "user", content: userContent }
            ],
            temperature: 0.1,
            max_tokens: 100
        }, {
            headers: { 
                'Authorization': `Bearer ${process.env.MISTRAL_API_KEY}`,
                'Content-Type': 'application/json'
            }
        });

        const poemResult = response.data.choices[0].message.content.trim();
        res.json({ reply: poemResult });

    } catch (err) {
        // Enhanced Error Logging
        console.error("Poetic Engine Handshake Failed:", err.response ? err.response.data : err.message);
        res.status(500).json({ error: "The poetic engine is currently unavailable." });
    }
});

module.exports = router;