# Gullak Model Context Protocol (MCP) Integration Specification & Audit Report
**Competition:** The Ken Case Competition 2026 — Round 3  
**Agent Name:** Aashi (AP Processor / Personal Financial Reconciliation Agent)  
**Platform:** Pine Labs AgenticOrg  
**Protocol Version:** MCP 2024-11-05 / 2025-11-25 Compatible  
**Date:** October 3, 2026  

---

## 1. Why OpenAPI Custom Connector Registration Failed

During Round 3 integration on Pine Labs AgenticOrg, registering Gullak via the generic REST/OpenAPI connector failed with the following platform error:

```
"Unknown native connector. Use '<native_connector_name>_<your_suffix>', e.g. 'jira_myteam'."
```

### Root Cause Analysis:
1. **Pine Labs Platform Architecture:** AgenticOrg's native connector registry requires connector IDs to inherit from known native connector templates (such as `jira_*`, `github_*`, `slack_*`). An arbitrary OpenAPI specification without a native connector binding is rejected because the platform tries to match it against its internal pre-certified SaaS catalog.
2. **MCP Discoverability:** Pine Labs AgenticOrg's "Custom / Generic Connector" form includes an explicit **MCP Checkbox** with the specification:
   > *"This is a Model Context Protocol (MCP) server. Its tool catalog is discovered automatically from the URL below at registration time."*
3. **The Solution:** Rather than attempting to bypass or spoof a native connector identifier, Gullak implements an official Model Context Protocol (MCP) server layer. This allows AgenticOrg to automatically discover Gullak's custom capabilities as first-class agent tools.

---

## 2. Why MCP is Being Used

Model Context Protocol (MCP) is the open standard created by Anthropic for connecting AI agents to external tools and data sources.

| Dimension | OpenAPI Connector | MCP Connector |
| :--- | :--- | :--- |
| **Catalog Discovery** | Static OpenAPI JSON file | Dynamic JSON-RPC 2.0 / SSE discovery at registration time |
| **Platform Compatibility** | Rejected unless matching native connector suffix | Natively supported via AgenticOrg's MCP checkbox |
| **Invocation Model** | REST HTTP endpoints | Structured tool calls (`tools/call`) with typed parameters |
| **Error Handling** | HTTP 4xx/5xx status codes | Honest structured tool error payloads (`isError: true`, no fabricated data) |
| **Gullak Architecture** | Co-exists at `/openapi.json` | Co-exists at `/sse`, `/messages`, and `/mcp` |

> **Crucial Guarantee:** The existing REST API (`/openapi.json`, `/api/v1/health`, `/api/v1/reconcile/transaction`, etc.) remains 100% active and backwards-compatible. The MCP layer delegates directly to Gullak's core business logic engines without duplicating logic.

---

## 3. MCP Endpoints & Transports

Gullak provides a hybrid dual-transport MCP implementation using the official `@modelcontextprotocol/sdk` package, specifically hardened for serverless (Vercel) deployments:

### Active Endpoints:
1. **SSE Transport (Streaming):**
   - **Stream URL:** `https://gullak-gray.vercel.app/sse`
   - **Messages URL:** `https://gullak-gray.vercel.app/messages`
   - Protocol: Server-Sent Events (`text/event-stream`)
2. **Streamable HTTP / Stateless JSON-RPC 2.0:**
   - **Direct RPC URL:** `https://gullak-gray.vercel.app/mcp`
   - Protocol: HTTP POST with JSON-RPC 2.0 payload (`initialize`, `tools/list`, `tools/call`, `ping`)
3. **Serverless Fallback Resilience:**
   - If an AgenticOrg client establishes an SSE stream and subsequently issues `POST /messages?sessionId=...` to an ephemeral serverless container where the in-memory session is not cached, Gullak automatically falls back to direct JSON-RPC execution, preventing dropped tool calls.

---

## 4. Discovered Tool Catalog (7 Tools)

AgenticOrg discovers exactly 7 tools at registration time:

### 1. `check_counterparty_memory`
- **Description:** Check Gullak semantic memory graph for an existing counterparty (by name, UPI VPA, nickname, or merchant ID) to retrieve past relationship, typical classification, and notes. Used to avoid treating splits, transfers, or reimbursements as personal consumption.
- **Input Schema:**
  ```json
  {
    "type": "object",
    "properties": {
      "identifier": {
        "type": "string",
        "description": "Counterparty name, UPI VPA (e.g. rahul@upi), nickname, or identifier to search."
      }
    },
    "required": ["identifier"]
  }
  ```

### 2. `record_counterparty_memory`
- **Description:** Record or update counterparty classification, relationship, typical intent, and notes in Gullak memory graph with automatic contradiction detection and user confirmation auditing.
- **Input Schema:**
  ```json
  {
    "type": "object",
    "properties": {
      "counterparty": { "type": "string", "description": "Name or handle of the counterparty." },
      "vpa": { "type": "string", "description": "Virtual Payment Address (UPI ID) of the counterparty if known." },
      "classification": {
        "type": "string",
        "enum": ["PERSONAL", "VENDOR", "FRIEND_P2P", "SERVICE_PROVIDER", "LANDLORD", "REIMBURSABLE", "TRANSFER"]
      },
      "relationship": { "type": "string", "description": "Relationship to user (e.g. Friend, Roommate, Landlord, Self, Coworker)." },
      "typical_intent": { "type": "string", "description": "Typical nature of transactions (e.g. Dinner splits, Monthly Rent, Reimbursement)." },
      "notes": { "type": "string", "description": "Additional context or observations." },
      "confidence": { "type": "number", "description": "Confidence score between 0.0 and 1.0 (defaults to 0.95)." }
    },
    "required": ["counterparty"]
  }
  ```

### 3. `reconcile_transaction`
- **Description:** Reconcile a bank/UPI transaction through Gullak multi-evidence reconciliation engine. Distinguishes personal spending from splits, loans, repayments, transfers, and savings. Enforces 0.88 confidence floor and triggers Human-In-The-Loop (HITL) when uncertain.
- **Input Schema:**
  ```json
  {
    "type": "object",
    "properties": {
      "transaction_id": { "type": "string", "description": "Unique transaction identifier (e.g. TXN_001) for idempotency and duplicate detection." },
      "amount": { "type": "number", "description": "Transaction amount in INR." },
      "direction": { "type": "string", "enum": ["DEBIT", "CREDIT"], "description": "Flow direction of funds: DEBIT or CREDIT." },
      "counterparty": { "type": "string", "description": "Counterparty name or merchant name." },
      "vpa": { "type": "string", "description": "UPI VPA ID (e.g. rahul@oksbi)." },
      "raw_narration": { "type": "string", "description": "Bank statement narration or SMS description." },
      "user_clarification": { "type": "string", "description": "Direct user response or voice transcript explaining transaction intent if clarification was sought." },
      "delhivery_status": { "type": "string", "description": "Corroborating logistics package status (e.g. Delivered, Returned, In Transit) if applicable." }
    },
    "required": ["amount", "direction"]
  }
  ```

### 4. `adapt_daily_budget`
- **Description:** Adapt the user remaining daily spending budget based on verified personal spending. Enforces the inviolable ₹15,000 monthly savings protection rule, recalculating safe daily limits.
- **Input Schema:**
  ```json
  {
    "type": "object",
    "properties": {
      "actual_personal_spending": { "type": "number", "description": "Actual verified personal spending amount to deduct from remaining personal pool." },
      "planned_daily_budget": { "type": "number", "description": "Planned daily spending budget (optional, defaults to 500)." },
      "remaining_days": { "type": "number", "description": "Number of days remaining in billing cycle (optional, defaults to 20)." },
      "transaction_id": { "type": "string", "description": "Associated transaction ID if adapting in response to a transaction." }
    },
    "required": ["actual_personal_spending"]
  }
  ```

### 5. `check_budget_status`
- **Description:** Retrieve current budget health, monthly income, inviolable ₹15,000 savings shield status, total spent, and current adapted daily spending allowance.
- **Input Schema:**
  ```json
  {
    "type": "object",
    "properties": {}
  }
  ```

### 6. `track_delhivery_shipment`
- **Description:** Query Delhivery logistics rail for package shipment tracking, status history, and delivery timestamps to corroborate e-commerce transactions and returns.
- **Input Schema:**
  ```json
  {
    "type": "object",
    "properties": {
      "waybill": { "type": "string", "description": "Delhivery Waybill / AWB number (e.g. 123456789012, DELHIVERY_AMZN_9918, DELHIVERY_RET_7741)." },
      "ref_ids": { "type": "string", "description": "Merchant Order / Reference ID (e.g. AMZ_ORDER_9921)." },
      "simulate_error": { "type": "string", "description": "Optional error simulation for resilience testing (404, 500)." }
    }
  }
  ```

### 7. `get_system_health`
- **Description:** Check Gullak server operational status, platform configuration, active banking/voice/logistics rails, confidence floor (0.88), and local benchmark metrics.
- **Input Schema:**
  ```json
  {
    "type": "object",
    "properties": {}
  }
  ```

---

## 5. Test Verification Results

### A. MCP Protocol & Tool Suite (`test/test_mcp.js`)
- **Status:** **60/60 PASSED (100%)**
- **Suites Verified:**
  1. REST Core Endpoints & System Health (HTTP 200, confidence floor 0.88)
  2. OpenAPI 3.x Specification Integrity (valid OpenAPI 3.x document)
  3. MCP SSE & Protocol Transport Discovery (HTTP 200, `text/event-stream`)
  4. MCP JSON-RPC 2.0 Initialization (`protocolVersion: 2024-11-05`, `gullak-mcp-server`)
  5. MCP Tool Catalog Discovery (all 7 tools discovered by name)
  6. MCP Tool: `get_system_health` (returns status ONLINE)
  7. MCP Tool: `record_counterparty_memory` (stores counterparty with dual indexing)
  8. MCP Tool: `check_counterparty_memory` (retrieves memory; verifies state shared with REST)
  9. MCP Tool: `reconcile_transaction` (personal consumption separated; confidence $\ge 0.88$)
  10. MCP Tool: `reconcile_transaction` (split payment separated; recoverable amount calculated)
  11. MCP Tool: `reconcile_transaction` (HITL triggered on confidence $< 0.88$)
  12. MCP Tool: Input Validation & Structured Errors (returns `isError: true`, never fabricates data)
  13. MCP Tool: `adapt_daily_budget` (inviolable ₹15,000 savings shield enforced)
  14. MCP Tool: `check_budget_status` (verifies monthly budget state)
  15. MCP Tool: `track_delhivery_shipment` (Delivered status verified; 404 simulation returns structured error)

### B. Local Acceptance Benchmark (`test/run_20_evals.js`)
- **Status:** **20/20 PASSED (100% Acceptance)**
- **Gross Outflow Reconciled:** ₹49,399
- **Actual Personal Consumption:** ₹9,449
- **Discrepancy Eliminated:** ₹39,950

---

## 6. Public Deployment & Vercel Protection Audit

- **Live URL:** `https://gullak-gray.vercel.app`
- **Deployment Protection Status:** **INACTIVE (Public Unauthenticated Access Enabled)**
  - Response Code: `HTTP 200 OK`
  - CORS Header: `Access-Control-Allow-Origin: *`
  - SSO Interception: None (no 307 SSO redirect)
- **Serverless Compatibility:**
  - Vercel functions support streaming SSE responses and standard JSON-RPC HTTP POST requests.
  - The dual transport implementation guarantees that both stateful SSE sessions and stateless JSON-RPC calls are processed seamlessly across Vercel regions and cold starts.

---

## 7. Pine Labs AgenticOrg Connector & Agent Configuration

### Active Connector Details:
- **Connector Name:** `mcp_gullak_mcp_ayush`
- **Base URL:** `https://gullak-gray.vercel.app/sse`
- **MCP Checkbox:** Enabled
- **Authentication Type:** None
- **Status:** Active / Healthy

### Resolving "Invalid authorized_tools" in AgenticOrg:
When saving Agent Aashi, if you encounter the error:
```
"Invalid authorized_tools: mcp_gullak_mcp_ayush__check_account_balance, mcp_gullak_mcp_ayush__fetch_bank_statement. Use GET /connectors/registry or GET /tools to discover valid tool names."
```

#### Why this occurred:
AgenticOrg automatically prefixes tools belonging to a connector as `<connector_name>__<tool_name>`. Previously, Agent Aashi was configured with Banking Aa tools (`check_account_balance`, `fetch_bank_statement`). Because Banking Aa was unhealthy, those tools were mistakenly associated with or carried over into `mcp_gullak_mcp_ayush`. Since `mcp_gullak_mcp_ayush` only exposes Gullak's 7 reconciliation tools, AgenticOrg rejected saving the agent.

#### Exact Fix in AgenticOrg UI:
1. Open **Agent Aashi** in AgenticOrg $\to$ **Tools / Authorized Tools**.
2. **Remove / Uncheck** any nonexistent tools (e.g., `check_account_balance`, `fetch_bank_statement`).
3. **Uncheck** the native Banking Aa connector (Gullak MCP is completely autonomous and does not require Banking Aa).
4. Select **ONLY** the 7 tools discovered from `mcp_gullak_mcp_ayush`:
   - `get_system_health` (AgenticOrg ID: `mcp_gullak_mcp_ayush__get_system_health`)
   - `check_counterparty_memory` (AgenticOrg ID: `mcp_gullak_mcp_ayush__check_counterparty_memory`)
   - `record_counterparty_memory` (AgenticOrg ID: `mcp_gullak_mcp_ayush__record_counterparty_memory`)
   - `reconcile_transaction` (AgenticOrg ID: `mcp_gullak_mcp_ayush__reconcile_transaction`)
   - `adapt_daily_budget` (AgenticOrg ID: `mcp_gullak_mcp_ayush__adapt_daily_budget`)
   - `check_budget_status` (AgenticOrg ID: `mcp_gullak_mcp_ayush__check_budget_status`)
   - `track_delhivery_shipment` (AgenticOrg ID: `mcp_gullak_mcp_ayush__track_delhivery_shipment`)
5. Click **Save Agent**. The agent will save successfully without schema errors!

---

## 8. Decoupled Banking Aa Architecture

- **Zero Dependency:** Gullak's custom MCP connector does **NOT** depend on Pine Labs Banking Aa or any external OAuth token.
- **Self-Contained Verification:** All 7 tools operate directly against Gullak's in-memory semantic memory graph, multi-evidence reconciliation ledger, and adaptive budget engine.
- **Health Check Resilience:** `GET /api/v1/health` and MCP tool `get_system_health` return `status: ONLINE` and `banking_aa_dependency: NONE`.
- **Honest Data Guarantee:** Gullak never fabricates bank accounts or fake balances. If banking data is unavailable, Gullak gracefully accepts user clarification or narration without failing.

---

## 9. Remaining Actions

1. **AgenticOrg Agent Save:** Update Agent Aashi's authorized tools list in the AgenticOrg UI as outlined in Section 7.
2. **Execute Interactive Transactions:** Trigger test transactions with Agent Aashi in the AgenticOrg chat interface to populate the 20 platform shadow evaluation samples.
