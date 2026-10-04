# Gullak: Autonomous Personal Financial Reconciliation Agent
**The Ken Case Competition 2026 — Round 3 (Build Round)**  
**Opening:** *“Where did my money go? UPI made spending invisible. The month disappears by the 12th, and nobody can say where.”*

---

## 1. What Gullak Is
**Gullak** is an autonomous personal finance reconciliation agent orchestrated on the **Pine Labs AgenticOrg** platform. Unlike traditional expense trackers that blindly treat every bank debit as consumption, Gullak reconstructs what actually happened to the user's money. It distinguishes personal consumption from loans, split bills, repayments, internal transfers, and investments, then adapts the user's daily budget while strictly protecting configured savings targets.

---

## 2. The Core Problem: Invisible & Frictionless UPI
In India, UPI made transactions frictionless and instant, but made spending invisible. More critically, **P2P transactions have no inherent semantic meaning**:
- A debit of `₹1,500 → Rahul` tells a bank nothing about the purpose.
- It could be a hand loan, dinner split, repayment, reimbursement, or pure consumption.
- A conventional expense tracker logs: `₹1,500 spent`.
- If the user had a ₹300 daily budget, the tracker shouts that the user overspent by ₹1,200 and slashes their budget, when in reality the user consumed ₹0 or only ₹300.

---

## 3. Why Financial Reconciliation ≠ Expense Tracking

| Dimension | Conventional Expense Tracker | Gullak Reconciliation Agent |
|---|---|---|
| **Core Assumption** | Money Leaving Bank = Money Consumed | **Money Movement ≠ Personal Consumption** |
| **P2P Transfer (₹1,500 to friend)** | Logs ₹1,500 Expense | Infers context $\to$ asks once $\to$ classifies as `LOAN` (Consumption = ₹0) |
| **Repayment (₹1,500 from friend)** | Logs ₹1,500 New Income | Closes loan receivable ledger (Income = ₹0) |
| **Group Dinner (₹4,000 paid for 4)** | Logs ₹4,000 Overspend | Logs ₹1,000 Consumption, ₹3,000 Receivables |
| **Savings Goal Handling** | Often silently eaten by overspends | **Inviolable Shield:** Savings goal is locked; tradeoffs require explicit consent |
| **User Interaction** | Manual tagging of every entry | **Infer first $\to$ ask only when uncertain ($C < 0.88$) $\to$ remember permanently** |

---

## 4. System Architecture

```
                       ┌─────────────────────────┐
                       │   USER (Voice / Text)   │
                       └────────────┬────────────┘
                                    │
                       ┌────────────▼────────────┐
                       │  Gnani.ai Voice Rail    │
                       │ (Hinglish STT v3 & TTS) │
                       └────────────┬────────────┘
                                    │
   ┌────────────────────────────────▼────────────────────────────────┐
   │                  PINE LABS AGENTICORG PLATFORM                   │
   │                    Agent: Aashi (AP Processor)                  │
   │             Model: Azure OpenAI GPT-4o | Floor: 88%             │
   └───────────────┬───────────────────────────────┬─────────────────┘
                   │                               │
       ┌───────────▼───────────┐       ┌───────────▼───────────┐
       │     BANKING AA        │       │  KNOWLEDGE BASE       │
       │  (Primary Data Rail)  │       │ (Reference / Rules)   │
       │ - Request Consent     │       │ - Financial FAQs/SOPs │
       │ - Check Balance       │       │ - Classification Rules│
       │ - Get Txn List        │       └───────────────────────┘
       │ - Fetch Bank Statement│
       └───────────┬───────────┘
                   │
                   ▼
   ┌─────────────────────────────────────────────────────────────────┐
   │              GULLAK CUSTOM CAPABILITIES BACKEND                  │
   │                                                                 │
   │  [Capability 1: Counterparty Semantic Memory Graph]             │
   │  - Stores relationships, typical intent, and loan balances      │
   │  - Contradiction Detection: Re-prompts if narration conflicts   │
   │                                                                 │
   │  [Capability 2: P2P Financial Reconciliation & Ledger Engine]   │
   │  - Deconstructs transaction into Consumption vs Pass-Through    │
   │  - Evaluates confidence; triggers HITL if confidence < 0.88      │
   │  - Duplicate detection & unconfirmed refusal safety             │
   │                                                                 │
   │  [Capability 3: Adaptive Daily Budget & Savings Shield]         │
   │  - Smooths overspends across remaining billing cycle days       │
   │  - Locks monthly savings goal (₹15,000) as inviolable           │
   │                                                                 │
   │  [Optional Enrichment: Delhivery Logistics Rail]                │
   │  - Corroborates e-commerce debits with package delivery state   │
   └─────────────────────────────────────────────────────────────────┘
```

---

## 5. Pine Labs AgenticOrg Role
**Pine Labs AgenticOrg** is the autonomous agent orchestration environment.
- **Agent Name:** Aashi
- **Type:** AP Processor | **Domain:** Finance
- **Model:** Azure OpenAI — GPT-4o
- **Confidence Floor:** 88% (0.88). If `confidence < 0.88`, triggers Human-In-The-Loop (HITL) escalation.
- **Role:** Evaluates user intent, coordinates tool invocation across Banking AA and custom OpenAPI connectors, and ensures safe execution boundaries.

---

## 6. Banking AA Role
**Banking Account Aggregator (AA)** is the primary rail for personal bank and UPI transaction data.
- The 5 authorized Banking AA tools in AgenticOrg:
  1. `banking_aa_request_consent`: Obtains user authorization.
  2. `banking_aa_check_account_balance`: Retrieves account balance.
  3. `banking_aa_fetch_bank_statement`: Broad transaction history.
  4. `banking_aa_fetch_fi_data`: Detailed financial info.
  5. `banking_aa_get_transaction_list`: Recent live transaction list.
- Pine Labs Plural (merchant payment gateway/refunds) is **not** the personal finance data rail and is excluded from the core reconciliation loop.

---

## 7. Gnani.ai Voice Rail Role
**Gnani.ai** provides the natural voice conversational interface.
- **Live Endpoints:**
  - STT: `POST https://api.vachana.ai/stt/v3` (Header: `X-API-Key-ID`)
  - TTS: `POST https://api.vachana.ai/api/v1/tts/inference` (`timbre-v2.5` model)
- **Role:** Transcribes Indian code-mixed Hinglish voice notes (e.g., *"Rahul ko pandrah sau diye the, loan tha"*), extracts monetary entities and counterparty names, and speaks responses.
- **Fallback:** Transparent development fallback parser when `GNANI_API_KEY` is not injected.

---

## 8. Delhivery Logistics Rail Role (Secondary / Optional)
**Delhivery** provides logistics status verification to corroborate ambiguous e-commerce debits.
- **Endpoints (Official Schema):**
  - Package Tracking: `GET /api/v1/packages/json/?waybill={waybill}`
  - Pincode Serviceability: `GET /c/api/pin-codes/json/?filter_codes={pincode}`
- **Role:** Corroborates whether a ₹2,499 Amazon debit was delivered (confirming consumption) or returned (flagging for expected refund).
- **Secondary:** Gullak does not require Delhivery for core P2P/UPI reconciliation.

---

## 9. Custom Backend Role
The Node.js/Express backend provides the three core domain engines missing from standard LLM platforms:
1. `POST /api/v1/memory/counterparty`
2. `POST /api/v1/reconcile/transaction`
3. `POST /api/v1/budget/adapt`

---

## 10. Memory Mechanism & Contradiction Detection
- **Infer First:** Looks up counterparty in the Memory Graph (`GET /api/v1/memory/counterparty?identifier=...`).
- **Ask Once:** If unknown or confidence $< 0.88$, asks exactly one concise clarification question.
- **Remember Permanently:** Stores confirmed intent and loan balance.
- **Contradiction Handling:** If stored memory says `LOAN` (e.g., Rahul), but a new transaction narration says *"Dinner split at Toit"*, the engine detects a contradiction, penalizes confidence to 0.60, and re-clarifies rather than blindly assuming a loan!

---

## 11. Financial Reconciliation Taxonomy
Every transaction is classified into one of 10 explicit categories:
1. `CONSUMPTION`: Genuine personal spending (affects discretionary budget).
2. `LOAN`: Money lent (consumption = ₹0, loan receivable tracked).
3. `REPAYMENT`: Money received back (clears loan receivable, income = ₹0).
4. `SPLIT`: Group bill where user fronted money (only personal share affects budget).
5. `REIMBURSEMENT`: Corporate or out-of-pocket expense settled (consumption = ₹0).
6. `TRANSFER`: Movement between own accounts (consumption = ₹0).
7. `REFUND`: Merchant credit offsetting previous spending (consumption = -refund).
8. `SAVING`: SIP / Mutual Fund / Zerodha investment (asset addition; not consumption).
9. `INCOME`: Primary salary credit from payroll.
10. `CASH_WITHDRAWAL`: ATM cash held until spent (initial consumption = ₹0).
11. `UNKNOWN`: Ambiguous transaction requiring HITL.

---

## 12. Adaptive Budget Mechanism & Savings Shield
- **Actual Consumption Only:** Only verified `CONSUMPTION` affects the budget.
- **Overspend Smoothing Formula:**
  $$\text{daily\_adjustment} = \frac{\text{actual\_personal\_spending} - \text{planned\_daily\_budget}}{\text{remaining\_days}}$$
  $$\text{new\_daily\_budget} = \text{planned\_daily\_budget} - \text{daily\_adjustment}$$
- **Savings Goal Shield:**
  The user's monthly savings target (₹15,000) is strictly locked. If an extreme spending day would cause the daily budget to drop to $\le 0$, the system triggers an alert and prompts for an authorized tradeoff (buffer allocation vs savings adjustment) instead of silently depleting savings.

---

## 13. Gullak Local Backend Acceptance Benchmark
- **Scope:** 20 comprehensive unit and integration acceptance tests.
- **Coverage:** Loans, repayments, splits, reimbursements, self-transfers, refunds, salary, ATM, Hinglish voice parsing, contradiction detection, duplicate detection, Delhivery corroboration, API timeouts, malformed responses, and user refusal.
- **Current Result:** **20/20 PASSED (100% Acceptance)**.

---

## 14. Pine Labs AgenticOrg Shadow Evaluation Status
- **Current Platform Status:** **0/20 Samples Generated** (as shown on the live AgenticOrg dashboard).
- **Promotion Threshold:** 20 Samples with $\ge 80\%$ accuracy.
- **Critical Distinction:** The local 20/20 acceptance test proves the custom backend logic is robust. The 20 AgenticOrg Shadow Samples must be gathered by running scenarios through the AgenticOrg interface.

---

## 15. Integration Disclosure: What is Real vs Mocked

| Component | Status | Disclosure |
|---|:---:|---|
| **Pine Labs AgenticOrg** | **REAL** | Configured agent (Aashi), AP Processor, Azure OpenAI GPT-4o, 88% confidence floor. |
| **Banking AA Tools** | **REAL** | Configured tools in AgenticOrg: consent, balance, bank statement, FI data, txn list. |
| **Knowledge Base Search** | **REAL** | Secondary reference tool in AgenticOrg. |
| **Custom Backend Capabilities** | **REAL** | Express server hosting Memory Graph, P2P Ledger, and Budget Shield. |
| **Gnani Voice STT/TTS** | **HYBRID** | Live REST API calls when `GNANI_API_KEY` is present; transparent development fallback otherwise. |
| **Delhivery Logistics** | **MOCK** | Matches official Delhivery staging API schema (`/api/v1/packages/json/`). |

---

## 16. Deployment Instructions

### Option A: Local Development
```bash
git clone <repo-url>
cd Gullak
npm install
npm run test:eval    # Runs the 20 local acceptance tests
npm start            # Starts server on http://localhost:3000
```

### Option B: Deploy to Vercel (Public HTTPS)
1. Install Vercel CLI: `npm i -g vercel`
2. Run `vercel` in the project root.
3. Once deployed, set `PUBLIC_URL=https://your-app.vercel.app` in Vercel project environment variables.
4. Your public OpenAPI spec is live at: `https://your-app.vercel.app/openapi.json`.

---

## 17. Environment Variables (`.env.example`)
```env
PORT=3000
NODE_ENV=production
PUBLIC_URL=https://your-deployment.vercel.app
GNANI_API_KEY=your_gnani_api_key_here
DELHIVERY_API_KEY=optional_staging_key
```

---

## 18. Pine Labs AgenticOrg OpenAPI Registration Instructions
1. Deploy the backend to Vercel or start a public tunnel.
2. In Pine Labs AgenticOrg, open **Connectors** $\to$ **Register Custom Connector**.
3. Provide the OpenAPI URL: `https://your-deployment.vercel.app/openapi.json`.
4. AgenticOrg will discover:
   - `check_counterparty_memory`
   - `record_counterparty_memory`
   - `reconcile_transaction_split`
   - `adapt_daily_budget`
5. Save and attach the custom connector to Agent **Aashi**.

---

## 19. Evaluation Cases Breakdown (The 20 Cases)

| # | Name | Category | Input Summary | Expected Reconciled Result |
|:---:|---|---|---|---|
| **01** | Normal Merchant Consumption | `CONSUMPTION` | ₹450 Swiggy debit | Classified as `CONSUMPTION`, budget impact ₹450 |
| **02** | Loan to Friend | `LOAN` | ₹1,500 to Rahul (clarified "lent him money") | Classified as `LOAN`, consumption ₹0, loan receivable ₹1,500 |
| **03** | Repayment from Friend | `REPAYMENT` | ₹1,500 from Rahul | Classified as `REPAYMENT`, consumption ₹0, loan cleared |
| **04** | Shared Dinner Split | `SPLIT` | ₹4,000 BBQ Nation (my share ₹1,000) | Classified as `SPLIT`, consumption ₹1,000, shared ₹3,000 |
| **05** | Corporate Reimbursement | `REIMBURSEMENT`| ₹3,000 Acme Corp | Classified as `REIMBURSEMENT`, consumption ₹0 |
| **06** | Bank Transfer | `TRANSFER` | ₹10,000 savings $\to$ current | Classified as `TRANSFER`, consumption ₹0 |
| **07** | Investment | `SAVING` | ₹10,000 Zerodha SIP | Classified as `SAVING`, consumption ₹0, savings +₹10,000 |
| **08** | Merchant Refund | `REFUND` | ₹1,200 Amazon credit | Classified as `REFUND`, consumption -₹1,200 |
| **09** | Salary / Income | `INCOME` | ₹1,00,000 employer payroll | Classified as `INCOME`, primary credit |
| **10** | ATM Cash Withdrawal | `CASH_WITHDRAWAL`| ₹5,000 HDFC ATM | Classified as `CASH_WITHDRAWAL`, consumption ₹0 |
| **11** | Unknown Transaction | `UNKNOWN` | ₹1,800 to stranger UPI | Triggers HITL clarification ($C = 0.52 < 0.88$) |
| **12** | Ambiguous Large P2P | `AMBIGUOUS_P2P` | ₹5,000 to Rohit | Asks clarification $\to$ confirmed as emergency loan |
| **13** | Hinglish Clarification | `VOICE_HINGLISH` | *"1500 Rahul ko diya tha, udhaar tha"* | STT parsed $\to$ classified as `LOAN`, consumption ₹0 |
| **14** | Repeated Counterparty | `LOAN` | ₹2,000 to Rahul | Auto-inferred as `LOAN` using memory without re-asking |
| **15** | Contradictory Memory | `CONTRADICTORY` | ₹800 to Rahul (*"Dinner split at Toit"*) | **Contradiction detected!** Asks clarification instead of assuming loan |
| **16** | Duplicate Transaction | `DUPLICATE` | Identical ₹450 Swiggy within seconds | **Duplicate detected!** Flagged to prevent double-deduction |
| **17** | E-Commerce Corroboration | `DELHIVERY` | ₹2,499 Amazon debit + Delhivery "Delivered" | Corroborated with logistics delivery scan |
| **18** | API Timeout Resilience | `TIMEOUT` | Banking AA timeout simulation | Returns safe 504 error object with ₹0 consumption |
| **19** | Malformed Response | `MALFORMED` | Malformed JSON response simulation | Returns safe 502 error object, parks safely |
| **20** | User Refusal Handling | `USER_REFUSAL` | User: *"None of your business"* | Kept as unverified `UNKNOWN`, does not guess |

---

## 20. Known Limitations & Roadmap
1. **Live AgenticOrg Shadow Runs:** The local acceptance benchmark passes 20/20. Running these 20 cases through the live AgenticOrg conversational UI is required to reach the 20/20 platform promotion counter.
2. **Account Aggregator Consent Lifecycles:** In production, RBI AA consent handles recurring consent expiry; in the prototype, consent is verified via `banking_aa_request_consent`.
3. **Multi-Currency / Cross-Border:** Currently optimized for Indian INR (₹) and UPI VPA structures.
