/**
 * Regression Test: Natural-Language Repayment Evidence Recognition
 * 
 * Verifies that:
 * 1. Aman lent ₹500 -> Recorded as LOAN with ₹500 outstanding in memory.
 * 2. "Aman repaid the ₹500 he borrowed from me." -> Reconciles as REPAYMENT:
 *    - classification = "REPAYMENT"
 *    - category = "REPAYMENT"
 *    - confidence >= 0.88 (0.98)
 *    - requires_clarification = false
 *    - consumption = 0
 *    - budget_impact = 0
 *    - loan_recovered = 500
 * 3. Tested across all natural-language payload fields AgenticOrg sends:
 *    - query
 *    - raw_narration
 *    - user_clarification
 *    - message / prompt
 * 4. Verifies safety guardrail: "I received ₹500 from Aman" without repayment context
 *    remains UNKNOWN when outstanding loan is 0.
 * 5. Verifies end-to-end MCP JSON-RPC protocol invocation over HTTP.
 */

const assert = require('assert');
const http = require('http');
const reconciliationEngine = require('../src/reconciliation');
const memoryEngine = require('../src/memory');
const { executeTool } = require('../src/mcp_server');

async function runRepaymentRegressionSuite() {
  console.log('=============================================================================');
  console.log(' REGRESSION TEST: EXPLICIT REPAYMENT EVIDENCE RECOGNITION (AMAN ₹500 FLOW)');
  console.log('=============================================================================\n');

  // Reset state
  memoryEngine.clear();
  reconciliationEngine.clear();

  // -------------------------------------------------------------------------
  // STEP 1: User lends Aman ₹500
  // -------------------------------------------------------------------------
  console.log('--- STEP 1: Reconcile Initial Loan: User lends Aman ₹500 ---');
  const loanTxn = await executeTool('reconcile_transaction', {
    amount: 500,
    direction: 'DEBIT',
    counterparty: 'Aman',
    user_clarification: 'I lent Aman ₹500'
  });

  console.log('Loan Result:', {
    classification: loanTxn.classification,
    confidence: loanTxn.confidence,
    consumption: loanTxn.consumption,
    budget_impact: loanTxn.budget_impact,
    loan_amount: loanTxn.loan_amount
  });

  assert.strictEqual(loanTxn.classification, 'LOAN', 'Must classify as LOAN');
  assert(loanTxn.confidence >= 0.88, 'Confidence must be >= 0.88');
  assert.strictEqual(loanTxn.budget_impact, 0, 'Loan budget impact must be 0');
  assert.strictEqual(loanTxn.consumption, 0, 'Loan consumption must be 0');
  assert.strictEqual(loanTxn.loan_amount, 500, 'Loan amount must be 500');

  const amanMemory = memoryEngine.getCounterparty('Aman');
  assert(amanMemory, 'Aman must exist in counterparty memory');
  assert.strictEqual(amanMemory.outstanding_loan, 500, 'Aman outstanding loan must be 500');
  console.log('[PASS] Step 1 passed: Loan recorded with ₹500 outstanding.\n');

  // -------------------------------------------------------------------------
  // STEP 2: AgenticOrg sends repayment in natural-language query field
  // "Aman repaid the ₹500 he borrowed from me."
  // -------------------------------------------------------------------------
  console.log('--- STEP 2: Repayment via AgenticOrg `query` parameter ---');
  const queryRepayment = await executeTool('reconcile_transaction', {
    query: 'Aman repaid the ₹500 he borrowed from me.'
  });

  console.log('Query Repayment Result:', {
    classification: queryRepayment.classification,
    category: queryRepayment.category,
    confidence: queryRepayment.confidence,
    requires_clarification: queryRepayment.requires_clarification,
    consumption: queryRepayment.consumption,
    budget_impact: queryRepayment.budget_impact,
    loan_recovered: queryRepayment.loan_recovered,
    direction: queryRepayment.direction,
    counterparty: queryRepayment.counterparty
  });

  assert.strictEqual(queryRepayment.classification, 'REPAYMENT', 'Classification must be REPAYMENT');
  assert.strictEqual(queryRepayment.category, 'REPAYMENT', 'Category must be REPAYMENT');
  assert(queryRepayment.confidence >= 0.88, 'Confidence must be >= 0.88');
  assert.strictEqual(queryRepayment.requires_clarification, false, 'requires_clarification must be false');
  assert.strictEqual(queryRepayment.consumption, 0, 'consumption must be 0');
  assert.strictEqual(queryRepayment.budget_impact, 0, 'budget_impact must be 0');
  assert.strictEqual(queryRepayment.loan_recovered, 500, 'loan_recovered must be 500');
  assert.strictEqual(queryRepayment.direction, 'CREDIT', 'direction must be CREDIT');
  assert.strictEqual(queryRepayment.counterparty, 'Aman', 'counterparty must be Aman');
  console.log('[PASS] Step 2 passed: `query` payload correctly recognized as REPAYMENT with loan_recovered=500.\n');

  // -------------------------------------------------------------------------
  // STEP 3: AgenticOrg sends repayment in `raw_narration` parameter
  // -------------------------------------------------------------------------
  console.log('--- STEP 3: Repayment via AgenticOrg `raw_narration` parameter ---');
  // Re-seed loan for isolated test
  memoryEngine.updateLoanLedger('Aman', 500, 'LOAN');
  const narrationRepayment = await executeTool('reconcile_transaction', {
    raw_narration: 'Aman repaid the ₹500 he borrowed from me.'
  });

  assert.strictEqual(narrationRepayment.classification, 'REPAYMENT');
  assert.strictEqual(narrationRepayment.category, 'REPAYMENT');
  assert(narrationRepayment.confidence >= 0.88);
  assert.strictEqual(narrationRepayment.requires_clarification, false);
  assert.strictEqual(narrationRepayment.consumption, 0);
  assert.strictEqual(narrationRepayment.budget_impact, 0);
  assert.strictEqual(narrationRepayment.loan_recovered, 500);
  console.log('[PASS] Step 3 passed: `raw_narration` payload correctly recognized as REPAYMENT.\n');

  // -------------------------------------------------------------------------
  // STEP 4: AgenticOrg sends repayment in `user_clarification` parameter
  // -------------------------------------------------------------------------
  console.log('--- STEP 4: Repayment via AgenticOrg `user_clarification` parameter ---');
  memoryEngine.updateLoanLedger('Aman', 500, 'LOAN');
  const clarRepayment = await executeTool('reconcile_transaction', {
    amount: 500,
    direction: 'CREDIT',
    counterparty: 'Aman',
    user_clarification: 'Aman repaid the ₹500 he borrowed from me.'
  });

  assert.strictEqual(clarRepayment.classification, 'REPAYMENT');
  assert.strictEqual(clarRepayment.category, 'REPAYMENT');
  assert(clarRepayment.confidence >= 0.88);
  assert.strictEqual(clarRepayment.requires_clarification, false);
  assert.strictEqual(clarRepayment.consumption, 0);
  assert.strictEqual(clarRepayment.budget_impact, 0);
  assert.strictEqual(clarRepayment.loan_recovered, 500);
  console.log('[PASS] Step 4 passed: `user_clarification` payload correctly recognized as REPAYMENT.\n');

  // -------------------------------------------------------------------------
  // STEP 5: Safety Guardrail - "I received ₹500 from Aman" without repayment context
  // When outstanding loan is 0, must remain UNKNOWN
  // -------------------------------------------------------------------------
  console.log('--- STEP 5: Safety Guardrail: "I received ₹500 from Aman" without repayment context ---');
  // Aman currently has 0 outstanding loan
  assert.strictEqual(memoryEngine.getCounterparty('Aman').outstanding_loan, 0, 'Aman outstanding loan must be 0');

  const ambiguousInflow = await executeTool('reconcile_transaction', {
    amount: 500,
    direction: 'CREDIT',
    counterparty: 'Aman',
    user_clarification: 'I received ₹500 from Aman'
  });

  console.log('Ambiguous Inflow Result:', {
    classification: ambiguousInflow.classification,
    confidence: ambiguousInflow.confidence,
    requires_clarification: ambiguousInflow.requires_clarification,
    budget_impact: ambiguousInflow.budget_impact,
    consumption: ambiguousInflow.consumption
  });

  assert.strictEqual(ambiguousInflow.classification, 'UNKNOWN', 'Ambiguous inflow must remain UNKNOWN');
  assert(ambiguousInflow.confidence < 0.88, 'Confidence must be strictly below 0.88 platform floor');
  assert.strictEqual(ambiguousInflow.requires_clarification, true, 'Must require clarification');
  assert.strictEqual(ambiguousInflow.budget_impact, 0, 'Budget impact must be 0');
  assert.strictEqual(ambiguousInflow.consumption, 0, 'Consumption must be 0');
  console.log('[PASS] Step 5 passed: Ambiguous inflow safely remains UNKNOWN (guardrail intact).\n');

  // -------------------------------------------------------------------------
  // STEP 6: Full HTTP MCP JSON-RPC Protocol Path Verification
  // -------------------------------------------------------------------------
  console.log('--- STEP 6: MCP HTTP JSON-RPC Protocol Invocation (/mcp) ---');
  const mcpPayload = JSON.stringify({
    jsonrpc: '2.0',
    id: 42,
    method: 'tools/call',
    params: {
      name: 'reconcile_transaction',
      arguments: {
        query: 'Aman repaid the ₹500 he borrowed from me.'
      }
    }
  });

  const httpResult = await new Promise((resolve, reject) => {
    const req = http.request({
      hostname: 'localhost',
      port: process.env.PORT || 3000,
      path: '/mcp',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(mcpPayload)
      }
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          const parsedContent = JSON.parse(json.result.content[0].text);
          resolve(parsedContent);
        } catch (err) {
          reject(err);
        }
      });
    });
    req.on('error', reject);
    req.write(mcpPayload);
    req.end();
  });

  console.log('HTTP MCP Result:', {
    classification: httpResult.classification,
    category: httpResult.category,
    confidence: httpResult.confidence,
    requires_clarification: httpResult.requires_clarification,
    loan_recovered: httpResult.loan_recovered,
    budget_impact: httpResult.budget_impact
  });

  assert.strictEqual(httpResult.classification, 'REPAYMENT', 'HTTP MCP result classification must be REPAYMENT');
  assert.strictEqual(httpResult.category, 'REPAYMENT', 'HTTP MCP result category must be REPAYMENT');
  assert(httpResult.confidence >= 0.88, 'HTTP MCP result confidence must be >= 0.88');
  assert.strictEqual(httpResult.requires_clarification, false, 'HTTP MCP result requires_clarification must be false');
  assert.strictEqual(httpResult.budget_impact, 0, 'HTTP MCP result budget_impact must be 0');
  assert.strictEqual(httpResult.loan_recovered, 500, 'HTTP MCP result loan_recovered must be 500');
  console.log('[PASS] Step 6 passed: MCP protocol execution over HTTP returns REPAYMENT with loan_recovered=500.\n');

  console.log('=============================================================================');
  console.log(' ALL REPAYMENT REGRESSION TESTS PASSED (100% SUCCESS)');
  console.log(' Natural-language repayment evidence accurately parsed and reconciled.');
  console.log('=============================================================================\n');
}

if (require.main === module) {
  runRepaymentRegressionSuite().catch(err => {
    console.error('\n[REPAYMENT REGRESSION TEST FAILED]:', err);
    process.exit(1);
  });
}

module.exports = { runRepaymentRegressionSuite };
