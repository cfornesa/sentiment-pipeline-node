# Sovereign Sentiment Pipeline (Node.js Edition)

An institutional-grade research tool for asynchronous sentiment ingestion, PII redaction, and statistical visualization.

## 1. Architectural Mission
This pipeline is designed to handle high-volume research datasets while maintaining strict data sovereignty. It leverages Node.js stream processing to analyze CSV data row-by-row, ensuring memory efficiency and zero-retention of raw research text.



## 2. Core Governance Principles
* **Data Minimization:** Only binned statistical aggregates (11-point polarity distribution) are persisted. Raw research text is processed in-memory and never stored.
* **PII Redaction:** Automated regex-based scrubbing of emails and phone numbers occurs before the sentiment analysis stage.
* **Headless Visualization:** The display agent is decoupled from the ingestion engine, providing a read-only endpoint optimized for secure `<iframe>` embedding.

## 3. Technology Stack
* **Runtime:** Node.js (Express.js)
* **Sentiment Engine:** VADER (Valence Aware Dictionary and sEntiment Reasoner)
* **Ingestion:** Multer & CSV-Parser (Stream-based)
* **Persistence:** MySQL (Institutional Pool)
* **Visualization:** Chart.js

## 4. File Structure
```text
├── public/                 # Headless Frontend Assets
│   ├── index.html          # Ingestion UI (Fetch API)
│   └── display.html        # Visualization Agent (Read-Only)
├── app.js                  # Express Server & Route Orchestration
├── processor.js            # VADER Logic & PII Redaction Brain
├── package.json            # Dependency Manifest
└── .env.example            # Environment Configuration Template