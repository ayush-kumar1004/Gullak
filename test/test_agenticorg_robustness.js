/**
 * AGENTICORG ROBUSTNESS & FAULT-TOLERANCE TEST SUITE
 * 
 * Verifies all 10 explicit test scenarios from Phase 11 and the AgenticOrg simulation
 * from Phase 12, testing argument normalization, schema tolerance, and error handling.
 */

const assert = require('assert');
const http = require('http');
const memoryEngine = require('../src/memory');
const reconciliationEngine = require('../src/reconciliation');
const { executeTool, normalizeReconciliationArguments } = require('../src/mcp_server');

const PORT = process.env.PORT || 3000;
const HOST = 'localhost';

function postJsonRpc(body) {
  return new Promise((resolve, reject) => {
    const payload = JSON.stringify(body);
    const req = http.request({
      hostname: HOST,
      port: PORT,
      path: '/mcp',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(payload)
      }
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve({ statusCode: res.statusCode, body: JSON.parse(data), raw: data });
        } catch (e) {
          resolve({ statusCode: res.statusCode, body: null, raw: data, error: e.message });
        }
      });
    });
    req.on('error', reject);
    req.write(payload);
    req.end();
  });
}

async function runRobustnessTests() {
  console.log('=============================================================================');
  console.log(' GULLAK AGENTICORG ROBUSTNESS & MCP COMPATIBILITY TEST SUITE');
  console.log(' Scope: Phase 11 (Tests 1-10) + Phase 12 (AgenticOrg Simulation)');
  console.log('=============================================================================\n');

  memoryEngine.clear();
  reconciliationEngine.clear();

  // --------------------------------------------------------------------------
  // TEST 1: Ambiguous P2P UPI Transaction (Purpose Unknown)
  // --------------------------------------------------------------------------
  console.log('--- TEST 1: ₹500 to Rahul Sharma (Purpose Unknown) ---');
  const t1 = await executeTool('reconcile_transaction', {
    amount: 500,
    direction: 'DEBIT',
    counterparty: 'Rahul Sharma',
    channel: 'UPI'
  });
  console.log('Result 1:', {
    classification: t1.classification,
    confidence: t1.confidence,
    requires_clarification: t1.requires_clarification,
    budget_impact: t1.budget_impact,
    question: t1.question,
    status: t1.status,
    tool_status: t1.tool_status,
    reconciliation_status: t1.reconciliation_status
  });

  assert.strictEqual(t1.classification, 'UNKNOWN', 'Test 1 classification must be UNKNOWN');
  assert.ok(t1.confidence < 0.88, `Test 1 confidence (${t1.confidence}) must be < 0.88`);
  assert.strictEqual(t1.requires_clarification, true, 'Test 1 requires_clarification must be true');
  assert.strictEqual(t1.budget_impact, 0, 'Test 1 budget_impact must be 0');
  assert.strictEqual(t1.consumption_amount, 0, 'Test 1 consumption_amount must be 0');
  assert.strictEqual(t1.tool_status, 'SUCCESS', 'Test 1 tool_status must be SUCCESS');
  assert.strictEqual(t1.reconciliation_status, 'CLARIFICATION_REQUIRED', 'Test 1 reconciliation_status must be CLARIFICATION_REQUIRED');
  assert.ok(t1.question && t1.question.includes('Rahul Sharma'), 'Test 1 question must mention Rahul Sharma');
  console.log('[PASS] TEST 1 PASSED: Correctly unclassified with zero budget impact.\n');

  // --------------------------------------------------------------------------
  // TEST 2: Loan to Friend
  // --------------------------------------------------------------------------
  console.log('--- TEST 2: ₹500 to Rahul Sharma (Clarification: "I lent him the money.") ---');
  reconciliationEngine.clear();
  const t2 = await executeTool('reconcile_transaction', {
    amount: 500,
    direction: 'DEBIT',
    counterparty: 'Rahul Sharma',
    channel: 'UPI',
    user_clarification: 'I lent him the money.'
  });
  console.log('Result 2:', {
    classification: t2.classification,
    confidence: t2.confidence,
    consumption: t2.consumption_amount,
    budget_impact: t2.budget_impact,
    loan_amount: t2.loan_amount
  });

  assert.strictEqual(t2.classification, 'LOAN', 'Test 2 classification must be LOAN');
  assert.ok(t2.confidence >= 0.88, 'Test 2 confidence must be >= 0.88');
  assert.strictEqual(t2.consumption_amount, 0, 'Test 2 consumption must be 0');
  assert.strictEqual(t2.budget_impact, 0, 'Test 2 budget_impact must be 0');
  assert.strictEqual(t2.loan_amount, 500, 'Test 2 loan_amount must be 500');
  assert.strictEqual(t2.reconciliation_status, 'RECONCILED');
  console.log('[PASS] TEST 2 PASSED: Correctly identified as LOAN receivable.\n');

  // --------------------------------------------------------------------------
  // TEST 3: Personal Consumption
  // --------------------------------------------------------------------------
  console.log('--- TEST 3: ₹500 to Rahul Sharma (Clarification: "This was my dinner payment.") ---');
  reconciliationEngine.clear();
  const t3 = await executeTool('reconcile_transaction', {
    amount: 500,
    direction: 'DEBIT',
    counterparty: 'Rahul Sharma',
    channel: 'UPI',
    user_clarification: 'This was my dinner payment.'
  });
  console.log('Result 3:', {
    classification: t3.classification,
    confidence: t3.confidence,
    consumption: t3.consumption_amount,
    budget_impact: t3.budget_impact
  });

  assert.strictEqual(t3.classification, 'CONSUMPTION', 'Test 3 classification must be CONSUMPTION');
  assert.ok(t3.confidence >= 0.88, 'Test 3 confidence must be >= 0.88');
  assert.strictEqual(t3.consumption_amount, 500, 'Test 3 consumption must be 500');
  assert.strictEqual(t3.budget_impact, 500, 'Test 3 budget_impact must be 500');
  assert.strictEqual(t3.reconciliation_status, 'RECONCILED');
  console.log('[PASS] TEST 3 PASSED: Correctly identified as CONSUMPTION.\n');

  // --------------------------------------------------------------------------
  // TEST 4: Existing Memory with User Override
  // --------------------------------------------------------------------------
  console.log('--- TEST 4: Memory Conflict with Current Clarification (Rent -> Dinner) ---');
  memoryEngine.clear();
  reconciliationEngine.clear();
  await executeTool('record_counterparty_memory', {
    counterparty: 'Rahul Sharma',
    classification: 'RENT_REPAYMENT',
    typical_intent: 'RENT_REPAYMENT',
    notes: 'monthly rent repayment',
    confidence: 0.95
  });

  const t4 = await executeTool('reconcile_transaction', {
    amount: 500,
    direction: 'DEBIT',
    counterparty: 'Rahul Sharma',
    channel: 'UPI',
    user_clarification: 'This was my dinner payment.'
  });
  console.log('Result 4:', {
    classification: t4.classification,
    confidence: t4.confidence,
    conflict_detected: t4.conflict_detected,
    user_override: t4.user_override,
    budget_impact: t4.budget_impact
  });

  assert.strictEqual(t4.classification, 'CONSUMPTION', 'Test 4 classification must be CONSUMPTION');
  assert.strictEqual(t4.conflict_detected, true, 'Test 4 conflict_detected must be true');
  assert.strictEqual(t4.user_override, true, 'Test 4 user_override must be true');
  assert.strictEqual(t4.budget_impact, 500, 'Test 4 budget_impact must be 500');
  console.log('[PASS] TEST 4 PASSED: User override handled with memory conflict logged.\n');

  // --------------------------------------------------------------------------
  // TEST 5: Alternate Argument Aliases (transaction_amount, message)
  // --------------------------------------------------------------------------
  console.log('--- TEST 5: Parameter Aliases (transaction_amount: "500", message: "...") ---');
  reconciliationEngine.clear();
  const t5 = await executeTool('reconcile_transaction', {
    transaction_amount: '500',
    direction: 'DEBIT',
    counterparty: 'Rahul Sharma',
    message: "I don't remember what it was for"
  });
  console.log('Result 5:', {
    classification: t5.classification,
    confidence: t5.confidence,
    requires_clarification: t5.requires_clarification,
    budget_impact: t5.budget_impact
  });

  assert.strictEqual(t5.classification, 'UNKNOWN', 'Test 5 classification must be UNKNOWN');
  assert.strictEqual(t5.requires_clarification, true, 'Test 5 requires_clarification must be true');
  assert.strictEqual(t5.budget_impact, 0, 'Test 5 budget_impact must be 0');
  assert.strictEqual(t5.amount, 500, 'Test 5 normalized amount must be 500');
  console.log('[PASS] TEST 5 PASSED: Handled string amount and message alias seamlessly.\n');

  // --------------------------------------------------------------------------
  // TEST 6: Minimal Arguments (Only amount and direction)
  // --------------------------------------------------------------------------
  console.log('--- TEST 6: Minimal Payload ({ amount: 500, direction: "DEBIT" }) ---');
  reconciliationEngine.clear();
  const t6 = await executeTool('reconcile_transaction', {
    amount: 500,
    direction: 'DEBIT'
  });
  console.log('Result 6:', {
    classification: t6.classification,
    confidence: t6.confidence,
    counterparty: t6.counterparty,
    channel: t6.channel,
    budget_impact: t6.budget_impact
  });

  assert.ok(t6.transaction_id, 'Test 6 must auto-generate transaction_id');
  assert.strictEqual(t6.counterparty, 'UNKNOWN', 'Test 6 counterparty must default to UNKNOWN');
  assert.strictEqual(t6.classification, 'UNKNOWN', 'Test 6 classification must be UNKNOWN');
  assert.strictEqual(t6.budget_impact, 0, 'Test 6 budget_impact must be 0');
  console.log('[PASS] TEST 6 PASSED: Minimal payload executed safely without crash.\n');

  // --------------------------------------------------------------------------
  // TEST 7: Missing Channel
  // --------------------------------------------------------------------------
  console.log('--- TEST 7: Missing Optional Channel ---');
  reconciliationEngine.clear();
  const t7 = await executeTool('reconcile_transaction', {
    amount: 250,
    direction: 'DEBIT',
    counterparty: 'Cafe Coffee Day'
  });
  assert.strictEqual(t7.channel, 'UNKNOWN');
  assert.strictEqual(t7.tool_status, 'SUCCESS');
  console.log('[PASS] TEST 7 PASSED: Missing channel handled safely.\n');

  // --------------------------------------------------------------------------
  // TEST 8: Missing Transaction ID
  // --------------------------------------------------------------------------
  console.log('--- TEST 8: Missing Transaction ID ---');
  reconciliationEngine.clear();
  const t8 = await executeTool('reconcile_transaction', {
    amount: 100,
    direction: 'CREDIT',
    counterparty: 'Friend'
  });
  assert.ok(t8.transaction_id && t8.transaction_id.startsWith('TXN_'), 'Must generate a safe TXN_ id');
  console.log('[PASS] TEST 8 PASSED: Safe transaction ID auto-generated.\n');

  // --------------------------------------------------------------------------
  // TEST 9: Malformed Amount
  // --------------------------------------------------------------------------
  console.log('--- TEST 9: Malformed Amount ({ amount: "five hundred" }) ---');
  const t9 = await executeTool('reconcile_transaction', {
    amount: 'five hundred',
    direction: 'DEBIT',
    counterparty: 'Rahul Sharma'
  });
  console.log('Result 9:', {
    tool_status: t9.tool_status,
    reconciliation_status: t9.reconciliation_status,
    confidence: t9.confidence,
    error: t9.error
  });

  assert.strictEqual(t9.tool_status, 'VALIDATION_ERROR', 'Must return VALIDATION_ERROR');
  assert.strictEqual(t9.reconciliation_status, 'UNABLE_TO_RECONCILE', 'Must return UNABLE_TO_RECONCILE');
  assert.strictEqual(t9.confidence, 0, 'Must have 0 confidence on validation failure');
  assert.strictEqual(t9.budget_impact, 0, 'Must not impact budget');
  console.log('[PASS] TEST 9 PASSED: Malformed amount rejected safely with VALIDATION_ERROR.\n');

  // --------------------------------------------------------------------------
  // TEST 10: Simulated Technical Error
  // --------------------------------------------------------------------------
  console.log('--- TEST 10: Simulated External Rail Error ---');
  const t10 = await executeTool('reconcile_transaction', {
    amount: 500,
    direction: 'DEBIT',
    simulate_timeout: true
  });
  console.log('Result 10:', {
    error: t10.error,
    tool_status: t10.tool_status,
    reconciliation_status: t10.reconciliation_status,
    budget_impact: t10.budget_impact
  });

  assert.strictEqual(t10.tool_status, 'INTERNAL_ERROR', 'Must flag INTERNAL_ERROR');
  assert.strictEqual(t10.reconciliation_status, 'UNABLE_TO_RECONCILE', 'Must flag UNABLE_TO_RECONCILE');
  assert.strictEqual(t10.budget_impact, 0, 'No budget impact on technical failure');
  console.log('[PASS] TEST 10 PASSED: Technical error represented deterministically without false confidence.\n');

  // --------------------------------------------------------------------------
  // PHASE 12: Exact AgenticOrg Simulation Test
  // --------------------------------------------------------------------------
  console.log('=============================================================================');
  console.log(' PHASE 12: EXACT AGENTICORG SIMULATION TEST');
  console.log(' Payload: { amount: 500, direction: "DEBIT", counterparty: "Rahul Sharma", channel: "UPI", user_clarification: "I sent ₹500 to Rahul Sharma via UPI, but I don\'t remember what it was for." }');
  console.log('=============================================================================');
  reconciliationEngine.clear();

  const simResult = await executeTool('reconcile_transaction', {
    amount: 500,
    direction: 'DEBIT',
    counterparty: 'Rahul Sharma',
    channel: 'UPI',
    user_clarification: "I sent ₹500 to Rahul Sharma via UPI, but I don't remember what it was for."
  });

  console.log('\nExact AgenticOrg Simulation Output:');
  console.log(JSON.stringify(simResult, null, 2));

  assert.strictEqual(simResult.category, 'UNKNOWN', 'Category must be UNKNOWN');
  assert.strictEqual(simResult.classification, 'UNKNOWN', 'Classification must be UNKNOWN');
  assert.strictEqual(simResult.confidence, 0.52, 'Confidence must be exactly 0.52');
  assert.ok(simResult.confidence < 0.88, 'Confidence must be < 0.88');
  assert.strictEqual(simResult.requires_clarification, true, 'requires_clarification must be true');
  assert.strictEqual(simResult.consumption_amount, 0, 'consumption_amount must be 0');
  assert.strictEqual(simResult.consumptionImpact, 0, 'consumptionImpact must be 0');
  assert.strictEqual(simResult.budget_impact, 0, 'budget_impact must be 0');
  assert.strictEqual(simResult.budgetImpact, 0, 'budgetImpact must be 0');
  assert.strictEqual(simResult.savings_impact, 0, 'savings_impact must be 0');
  assert.strictEqual(simResult.tool_status, 'SUCCESS', 'tool_status must be SUCCESS');
  assert.strictEqual(simResult.reconciliation_status, 'CLARIFICATION_REQUIRED', 'reconciliation_status must be CLARIFICATION_REQUIRED');
  assert.strictEqual(simResult.status, 'CLARIFICATION_REQUIRED');
  assert.strictEqual(simResult.question, 'Ayush, what was the ₹500 sent to Rahul Sharma for?');
  assert.strictEqual(simResult.explanation, 'The transaction purpose is unknown. No budget deduction has been applied.');

  console.log('\n[PASS] PHASE 12 SIMULATION PASSED 100%: Safe, deterministic UNKNOWN classification with ₹0 impact.\n');

  console.log('=============================================================================');
  console.log(' ALL 10 TESTS + PHASE 12 SIMULATION PASSED PERFECTLY');
  console.log('=============================================================================');
}

if (require.main === module) {
  runRobustnessTests().catch(err => {
    console.error('[FAIL] Robustness test suite failed:', err);
    process.exit(1);
  });
}

module.exports = { runRobustnessTests };
