# Part 1: Three Custom Capabilities

The competition allows building **up to 3 custom capabilities** that partner rails do not provide.

### Capability 1: Counterparty Semantic Memory Graph
- **Partner Lacking It:** Pine Labs (only understands merchants), Gnani (voice only), Delhivery (logistics only).
- **Endpoint:** `GET /api/v1/memory/counterparty` & `POST /api/v1/memory/counterparty`
- **Missing Capability:** Tracking user-centric social relationships, typical intents, past loan ledgers, and detecting contradictions between stored memory and new transaction evidence.
- **Data Required:** Counterparty name, VPA, typical transaction intent, confirmed split percentage, running loan balance.
- **Why It Belongs in Gullak:** Without memory, the agent would annoy the user by asking for clarification on every single transaction, destroying adoption.

### Capability 2: P2P Financial Reconciliation & Ledger Engine
- **Partner Lacking It:** Banking AA (only provides raw debits/credits without semantic intent), Pine Labs (merchant gateway only).
- **Endpoint:** `POST /api/v1/reconcile/transaction`
- **Missing Capability:** Decomposing transactions into genuine personal consumption vs pass-through money (loans, repayments, fronted splits, self-transfers, refunds).
- **Data Required:** Transaction amount, direction, counterparty, raw narration, optional user clarification, optional logistics status.
- **Why It Belongs in Gullak:** This is the core thesis: *“Money Movement ≠ Personal Consumption.”*

### Capability 3: Adaptive Daily Budget & Savings Protection Engine
- **Partner Lacking It:** Pine Labs & Banking AA.
- **Endpoint:** `POST /api/v1/budget/adapt` & `GET /api/v1/budget/status`
- **Missing Capability:** Spreading the impact of an overspent day smoothly across remaining days of the billing cycle while locking the monthly savings target (₹15,000) as inviolable.
- **Data Required:** Verified personal consumption amount, planned daily budget, days remaining, monthly savings target.
- **Why It Belongs in Gullak:** It translates reconciled financial activity into actionable, non-punitive daily allowance guidance.
