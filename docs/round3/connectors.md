# Part 1: Every Connector

| Connector Name | Status | Real vs Mock | Purpose | Execution Rail |
|---|---|:---:|---|---|
| **Banking AA Connector** | Configured in AgenticOrg | **REAL** | Ingests bank statements, account balance, FI data, and transaction lists with user consent. | Pine Labs AgenticOrg native connector |
| **Knowledge Base Search** | Configured in AgenticOrg | **REAL** | Retrieves financial policies, FAQs, and categorization terminology. Never used for transaction facts. | Pine Labs AgenticOrg native tool |
| **Gullak Custom Capabilities** | Deployed on Port 3000 / Vercel | **REAL** | Hosts Counterparty Memory Graph, P2P Reconciliation Engine, and Adaptive Budgeting with Savings Protection. | Custom OpenAPI 3.0 connector (`/openapi.json`) |
| **Gnani Voice Rail** | Implemented in `src/gnani.js` | **HYBRID** | Converts Hinglish speech to text (`/stt/v3`) and synthesizes spoken responses (`/api/v1/tts/inference`). Uses transparent development fallback when API key is unconfigured. | Gnani.ai official REST endpoints |
| **Delhivery Logistics Rail** | Implemented in `src/delhivery.js` | **MOCK** | Corroborates e-commerce debits against shipment status (`Delivered`, `Returned`) using official Delhivery schema (`/api/v1/packages/json/`). | Custom Express mock router |
