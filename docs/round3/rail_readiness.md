# Part 1: Partner Rail Readiness Scores

### 1. Pine Labs (Score: 8 / 10)
- **Evidence-Based Reason:** Pine Labs AgenticOrg provides a mature, enterprise-grade orchestration framework with configurable models (Azure OpenAI GPT-4o), confidence floor enforcement (88%), and Human-in-the-Loop escalation. However, its native payment tools (Plural) are tailored for merchant checkouts/refunds rather than personal P2P reconciliation, necessitating Banking AA for personal finance data.

### 2. Gnani.ai (Score: 8.5 / 10)
- **Evidence-Based Reason:** Gnani provides low-latency Indic speech-to-text (`/stt/v3`) and text-to-speech (`/api/v1/tts/inference` using `timbre-v2.5`) with exceptional support for code-mixed Hinglish and colloquial number entities (*"pandrah sau"*, *"dedh hazaar"*). However, it is purely a voice interface; semantic financial reasoning must be handled downstream.

### 3. Delhivery (Score: 7.5 / 10)
- **Evidence-Based Reason:** Delhivery's Express APIs provide clear, deterministic schemas for package tracking and pincode serviceability. While well-suited for corroborating e-commerce debits against physical delivery state, it is strictly secondary and does not participate in core P2P financial reconciliation.
