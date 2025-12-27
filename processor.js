/**
 * ARCHITECTURAL CONTEXT: Sovereign Sentiment Processor (Node.js)
 * PROJECT: Sentiment & Narrative Tracking Pipeline
 * * DESIGN PHILOSOPHY:
 * 1. MODULARITY: Decouples sentiment logic from the server engine (index.js).
 * 2. PRIVACY-BY-DESIGN: Implements PII (Personally Identifiable Information) 
 * redaction at the earliest possible stage of the pipeline.
 * 3. TRANSPARENCY: Uses the VADER (Valence Aware Dictionary and sEntiment Reasoner) 
 * lexicon, optimized for social media and short-form research text.
 */

const vader = require('vader-sentiment');

/**
 * Executes a sentiment analysis pass on a single string.
 * @param {string} text - The raw research content from a CSV row.
 * @returns {object} - Contains the compound score and the sanitized text.
 */
const analyzeText = (text) => {
    // Graceful handling of empty or null records
    if (!text || typeof text !== 'string') return { score: 0, redacted: "" };

    /**
     * STAGE 1: PII REDACTION
     * Objective: Remove emails and phone numbers to ensure research compliance.
     * Logic: Regex matching for standard communication patterns.
     */
    const redacted = text
        .replace(/[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/gi, '[EMAIL]')
        .replace(/\b\d{3}[-.]?\d{3}[-.]?\d{4}\b/g, '[PHONE]');

    /**
     * STAGE 2: VADER POLARITY SCORING
     * Logic: VADER maps linguistic features to a 'Compound' score.
     * Scoring: -1.0 (Extreme Negative) | 0.0 (Neutral) | 1.0 (Extreme Positive).
     */
    const intensity = vader.SentimentIntensityAnalyzer.polarity_scores(redacted);

    return {
        score: intensity.compound, // The primary metric for our 11-bin distribution
        redacted: redacted         // The sanitized text for display/export
    };
};

module.exports = { analyzeText };