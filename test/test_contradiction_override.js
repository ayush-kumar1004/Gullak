/**
 * Test Suite: Contradiction Override & Explicit Evidence Precedence
 *
 * Verifies that explicit current-user transaction intent takes precedence
 * over historical counterparty memory without triggering HITL or overwriting
 * permanent memory.
 */

const assert = require('assert');
const memoryEngine = require('../src/memory');
const reconciliationEngine = require('../src/reconciliation');
const budgetEngine = require('../src/budget');
const { executeTool } = require('../src/mcp_server');

async function runContradictionOverrideTests() {
  console.log('=============================================================================');
  console.log(' RUNNING CONTRADICTION OVERRIDE & EXPLICIT EVIDENCE PRECEDENCE TESTS');
  console.log('=============================================================================\n');

  // Setup: Reset engines
  memoryEngine.clear();
  reconciliationEngine.clear();
  budgetEngine.reset();

  // Setup historical counterparty memory for Rahul Sharma as frequent borrower / LOAN
  memoryEngine.recordCounterparty({
    counterparty: 'Rahul Sharma',
    vpa: 'rahul@oksbi',
    classification: 'LOAN',
    relationship: 'friend',
    typical_intent: 'LOAN',
    confidence: 0.95,
    notes: 'User frequently lends money or provides personal loans'
  });

  console.log('Setup: Recorded historical LOAN memory for Rahul Sharma.');
  const initialMemory = memoryEngine.getCounterparty('Rahul Sharma');
  assert.strictEqual(initialMemory.typical_intent, 'LOAN');

  // -------------------------------------------------------------------------
  // CASE 1: ₹500 sent to Rahul for dinner.
  // -------------------------------------------------------------------------
  console.log('\n--- CASE 1: ₹500 sent to Rahul for dinner ---');

  // Test 1A: Via reconciliationEngine.reconcile with raw_narration
  const case1A = reconciliationEngine.reconcile({
    transaction_id: 'TXN_CASE_1A',
    amount: 500,
    direction: 'DEBIT',
    counterparty: 'Rahul',
    raw_narration: '₹500 sent to Rahul for dinner.'
  });

  console.log('Case 1A Result:', {
    classification: case1A.classification,
    category: case1A.category,
    confidence: case1A.confidence,
    requires_clarification: case1A.requires_clarification,
    consumption: case1A.consumption,
    budget_impact: case1A.budget_impact,
    conflict_detected: case1A.conflict_detected,
    user_override: case1A.user_override,
    stored_memory_intent: case1A.stored_memory_intent
  });

  assert.strictEqual(case1A.classification, 'CONSUMPTION', 'Case 1A classification must be CONSUMPTION');
  assert.strictEqual(case1A.category, 'CONSUMPTION', 'Case 1A category must be CONSUMPTION');
  assert(case1A.confidence >= 0.88, `Case 1A confidence must be >= 0.88, got ${case1A.confidence}`);
  assert.strictEqual(case1A.requires_clarification, false, 'Case 1A requires_clarification must be false (no HITL)');
  assert.strictEqual(case1A.consumption, 500, 'Case 1A consumption must be 500');
  assert.strictEqual(case1A.budget_impact, 500, 'Case 1A budget_impact must be 500');
  assert.strictEqual(case1A.conflict_detected, true, 'Case 1A conflict_detected must be true');
  assert.strictEqual(case1A.user_override, true, 'Case 1A user_override must be true');
  assert.strictEqual(case1A.stored_memory_intent, 'LOAN', 'Case 1A stored_memory_intent must be LOAN');
  console.log('✓ Case 1A passed (direct engine invocation)');

  // Test 1B: Via executeTool('reconcile_transaction', ...)
  const case1B = await executeTool('reconcile_transaction', {
    counterparty: 'Rahul Sharma',
    amount: 500,
    direction: 'DEBIT',
    user_clarification: 'I paid Rahul ₹500 for dinner.'
  });

  assert.strictEqual(case1B.classification, 'CONSUMPTION', 'Case 1B classification must be CONSUMPTION');
  assert.strictEqual(case1B.category, 'CONSUMPTION', 'Case 1B category must be CONSUMPTION');
  assert(case1B.confidence >= 0.88, `Case 1B confidence must be >= 0.88, got ${case1B.confidence}`);
  assert.strictEqual(case1B.requires_clarification, false, 'Case 1B requires_clarification must be false');
  assert.strictEqual(case1B.consumption, 500, 'Case 1B consumption must be 500');
  assert.strictEqual(case1B.budget_impact, 500, 'Case 1B budget_impact must be 500');
  assert.strictEqual(case1B.conflict_detected, true, 'Case 1B conflict_detected must be true');
  assert.strictEqual(case1B.user_override, true, 'Case 1B user_override must be true');
  assert.strictEqual(case1B.stored_memory_intent, 'LOAN', 'Case 1B stored_memory_intent must be LOAN');
  console.log('✓ Case 1B passed (MCP tool execution)');

  // -------------------------------------------------------------------------
  // CASE 2: ₹600 sent to Rahul for dinner.
  // -------------------------------------------------------------------------
  console.log('\n--- CASE 2: ₹600 sent to Rahul for dinner ---');

  // Test 2A: Via reconciliationEngine.reconcile with user_clarification
  const case2A = reconciliationEngine.reconcile({
    transaction_id: 'TXN_CASE_2A',
    amount: 600,
    direction: 'DEBIT',
    counterparty: 'Rahul',
    user_clarification: 'I sent Rahul ₹600 for dinner.'
  });

  console.log('Case 2A Result:', {
    classification: case2A.classification,
    confidence: case2A.confidence,
    requires_clarification: case2A.requires_clarification,
    consumption: case2A.consumption,
    budget_impact: case2A.budget_impact,
    conflict_detected: case2A.conflict_detected,
    user_override: case2A.user_override
  });

  assert.strictEqual(case2A.classification, 'CONSUMPTION', 'Case 2A classification must be CONSUMPTION');
  assert(case2A.confidence >= 0.88, `Case 2A confidence must be >= 0.88, got ${case2A.confidence}`);
  assert.strictEqual(case2A.requires_clarification, false, 'Case 2A requires_clarification must be false');
  assert.strictEqual(case2A.consumption, 600, 'Case 2A consumption must be 600');
  assert.strictEqual(case2A.budget_impact, 600, 'Case 2A budget_impact must be 600');
  assert.strictEqual(case2A.conflict_detected, true, 'Case 2A conflict_detected must be true');
  assert.strictEqual(case2A.user_override, true, 'Case 2A user_override must be true');
  console.log('✓ Case 2A passed (direct engine invocation)');

  // Test 2B: Via executeTool with query string
  const case2B = await executeTool('reconcile_transaction', {
    amount: 600,
    counterparty: 'Rahul',
    direction: 'DEBIT',
    raw_narration: '₹600 sent to Rahul for dinner.'
  });

  assert.strictEqual(case2B.classification, 'CONSUMPTION', 'Case 2B classification must be CONSUMPTION');
  assert(case2B.confidence >= 0.88, `Case 2B confidence must be >= 0.88, got ${case2B.confidence}`);
  assert.strictEqual(case2B.requires_clarification, false, 'Case 2B requires_clarification must be false');
  assert.strictEqual(case2B.consumption, 600, 'Case 2B consumption must be 600');
  assert.strictEqual(case2B.budget_impact, 600, 'Case 2B budget_impact must be 600');
  assert.strictEqual(case2B.conflict_detected, true, 'Case 2B conflict_detected must be true');
  assert.strictEqual(case2B.user_override, true, 'Case 2B user_override must be true');
  console.log('✓ Case 2B passed (MCP tool execution)');

  // -------------------------------------------------------------------------
  // CASE 3: ₹1,000 paid for dinner for me and Rahul. Rahul owes me ₹500.
  // -------------------------------------------------------------------------
  console.log('\n--- CASE 3: ₹1,000 paid for dinner for me and Rahul. Rahul owes me ₹500 ---');

  // Test 3A: Via reconciliationEngine.reconcile
  const case3A = reconciliationEngine.reconcile({
    transaction_id: 'TXN_CASE_3A',
    amount: 1000,
    direction: 'DEBIT',
    counterparty: 'Rahul',
    user_clarification: 'I paid ₹1,000 for dinner for me and Rahul. Rahul owes me ₹500.'
  });

  console.log('Case 3A Result:', {
    classification: case3A.classification,
    confidence: case3A.confidence,
    requires_clarification: case3A.requires_clarification,
    consumption: case3A.consumption,
    budget_impact: case3A.budget_impact,
    amountReceivable: case3A.amountReceivable,
    conflict_detected: case3A.conflict_detected,
    user_override: case3A.user_override
  });

  assert.strictEqual(case3A.classification, 'SPLIT', 'Case 3A classification must be SPLIT');
  assert(case3A.confidence >= 0.88, `Case 3A confidence must be >= 0.88, got ${case3A.confidence}`);
  assert.strictEqual(case3A.requires_clarification, false, 'Case 3A requires_clarification must be false');
  assert.strictEqual(case3A.consumption, 500, 'Case 3A consumption must be 500');
  assert.strictEqual(case3A.budget_impact, 500, 'Case 3A budget_impact must be 500');
  assert.strictEqual(case3A.amountReceivable, 500, 'Case 3A amountReceivable must be 500');
  assert.strictEqual(case3A.conflict_detected, true, 'Case 3A conflict_detected must be true');
  assert.strictEqual(case3A.user_override, true, 'Case 3A user_override must be true');
  console.log('✓ Case 3A passed (direct engine invocation)');

  // Test 3B: Via executeTool
  const case3B = await executeTool('reconcile_transaction', {
    amount: 1000,
    counterparty: 'Rahul',
    direction: 'DEBIT',
    raw_narration: '₹1,000 paid for dinner for me and Rahul. Rahul owes me ₹500.'
  });

  assert.strictEqual(case3B.classification, 'SPLIT', 'Case 3B classification must be SPLIT');
  assert(case3B.confidence >= 0.88, `Case 3B confidence must be >= 0.88, got ${case3B.confidence}`);
  assert.strictEqual(case3B.requires_clarification, false, 'Case 3B requires_clarification must be false');
  assert.strictEqual(case3B.consumption, 500, 'Case 3B consumption must be 500');
  assert.strictEqual(case3B.budget_impact, 500, 'Case 3B budget_impact must be 500');
  assert.strictEqual(case3B.amountReceivable, 500, 'Case 3B amountReceivable must be 500');
  assert.strictEqual(case3B.conflict_detected, true, 'Case 3B conflict_detected must be true');
  assert.strictEqual(case3B.user_override, true, 'Case 3B user_override must be true');
  console.log('✓ Case 3B passed (MCP tool execution)');

  // -------------------------------------------------------------------------
  // EXACT AGENTICORG PAYLOAD SCENARIOS (From live production Vercel logs)
  // In live production, AgenticOrg sends user_clarification: null and puts the
  // user's statement or note in raw_narration.
  // -------------------------------------------------------------------------
  console.log('\n--- EXACT AGENTICORG PRODUCTION PAYLOAD SCENARIOS ---');

  // AGENTICORG CASE A: "I paid Rahul ₹500 for dinner."
  const agenticOrgCaseA = await executeTool('reconcile_transaction', {
    vpa: null,
    amount: 500,
    direction: 'DEBIT',
    counterparty: 'Rahul',
    raw_narration: 'I paid Rahul ₹500 for dinner.',
    transaction_id: null,
    delhivery_status: null,
    user_clarification: null
  });

  assert.strictEqual(agenticOrgCaseA.classification, 'CONSUMPTION', 'AgenticOrg Case A must be CONSUMPTION');
  assert(agenticOrgCaseA.confidence >= 0.88, `AgenticOrg Case A confidence must be >= 0.88, got ${agenticOrgCaseA.confidence}`);
  assert.strictEqual(agenticOrgCaseA.requires_clarification, false, 'AgenticOrg Case A requires_clarification must be false');
  assert.strictEqual(agenticOrgCaseA.consumption, 500, 'AgenticOrg Case A consumption must be 500');
  assert.strictEqual(agenticOrgCaseA.budget_impact, 500, 'AgenticOrg Case A budget_impact must be 500');
  assert.strictEqual(agenticOrgCaseA.conflict_detected, true, 'AgenticOrg Case A conflict_detected must be true');
  assert.strictEqual(agenticOrgCaseA.user_override, true, 'AgenticOrg Case A user_override must be true');
  console.log('✓ AgenticOrg Case A passed (exact production argument mapping)');

  // AGENTICORG CASE B: "I sent Rahul ₹600 for dinner."
  const agenticOrgCaseB = await executeTool('reconcile_transaction', {
    vpa: null,
    amount: 600,
    direction: 'DEBIT',
    counterparty: 'Rahul',
    raw_narration: 'I sent Rahul ₹600 for dinner.',
    transaction_id: null,
    delhivery_status: null,
    user_clarification: null
  });

  assert.strictEqual(agenticOrgCaseB.classification, 'CONSUMPTION', 'AgenticOrg Case B must be CONSUMPTION');
  assert(agenticOrgCaseB.confidence >= 0.88, `AgenticOrg Case B confidence must be >= 0.88, got ${agenticOrgCaseB.confidence}`);
  assert.strictEqual(agenticOrgCaseB.requires_clarification, false, 'AgenticOrg Case B requires_clarification must be false');
  assert.strictEqual(agenticOrgCaseB.consumption, 600, 'AgenticOrg Case B consumption must be 600');
  assert.strictEqual(agenticOrgCaseB.budget_impact, 600, 'AgenticOrg Case B budget_impact must be 600');
  assert.strictEqual(agenticOrgCaseB.conflict_detected, true, 'AgenticOrg Case B conflict_detected must be true');
  assert.strictEqual(agenticOrgCaseB.user_override, true, 'AgenticOrg Case B user_override must be true');
  console.log('✓ AgenticOrg Case B passed (exact production argument mapping)');

  // AGENTICORG CASE C: "I paid ₹1,000 for dinner for me and Rahul. Rahul owes me ₹500."
  const agenticOrgCaseC = await executeTool('reconcile_transaction', {
    vpa: null,
    amount: 1000,
    direction: 'DEBIT',
    counterparty: 'Rahul',
    raw_narration: 'I paid ₹1,000 for dinner for me and Rahul. Rahul owes me ₹500.',
    transaction_id: null,
    delhivery_status: null,
    user_clarification: null
  });

  assert.strictEqual(agenticOrgCaseC.classification, 'SPLIT', 'AgenticOrg Case C must be SPLIT');
  assert(agenticOrgCaseC.confidence >= 0.88, `AgenticOrg Case C confidence must be >= 0.88, got ${agenticOrgCaseC.confidence}`);
  assert.strictEqual(agenticOrgCaseC.requires_clarification, false, 'AgenticOrg Case C requires_clarification must be false');
  assert.strictEqual(agenticOrgCaseC.consumption, 500, 'AgenticOrg Case C consumption must be 500');
  assert.strictEqual(agenticOrgCaseC.amountReceivable, 500, 'AgenticOrg Case C amountReceivable must be 500');
  assert.strictEqual(agenticOrgCaseC.budget_impact, 500, 'AgenticOrg Case C budget_impact must be 500');
  assert.strictEqual(agenticOrgCaseC.conflict_detected, true, 'AgenticOrg Case C conflict_detected must be true');
  assert.strictEqual(agenticOrgCaseC.user_override, true, 'AgenticOrg Case C user_override must be true');
  console.log('✓ AgenticOrg Case C passed (exact production argument mapping)');

  // -------------------------------------------------------------------------
  // SAFEGUARD CHECKS
  // -------------------------------------------------------------------------
  console.log('\n--- SAFEGUARD CHECKS ---');

  // Safeguard 1: Permanent counterparty memory for Rahul must NOT be overwritten by one-off dinner/split
  const finalMemory = memoryEngine.getCounterparty('Rahul Sharma');
  console.log('Rahul Sharma memory after all tests:', {
    typical_intent: finalMemory.typical_intent,
    classification: finalMemory.classification
  });
  assert.strictEqual(finalMemory.typical_intent, 'LOAN', 'Rahul Sharma permanent memory must remain LOAN');
  assert.strictEqual(finalMemory.classification, 'LOAN', 'Rahul Sharma permanent classification must remain LOAN');
  console.log('✓ Safeguard 1: Rahul Sharma permanent memory preserved as LOAN (not overwritten by one-off dinner/split)');

  // Safeguard 2: Bank rail narration without user statement (CASE-15) must STILL trigger contradiction HITL
  const bankContradiction = reconciliationEngine.reconcile({
    transaction_id: 'TXN_BANK_CONTRADICTION',
    amount: 800,
    direction: 'DEBIT',
    counterparty: 'Rahul',
    vpa: 'rahul@oksbi',
    raw_narration: 'UPI/Dinner split with Rahul at Toit'
  });
  assert.strictEqual(bankContradiction.classification, 'UNKNOWN', 'Automated bank narration contradiction must be UNKNOWN');
  assert.strictEqual(bankContradiction.requires_clarification, true, 'Automated bank narration contradiction must require clarification');
  assert(bankContradiction.confidence < 0.88, 'Confidence must be below 0.88 floor for bank narration contradiction');
  assert.strictEqual(bankContradiction.budget_impact, 0, 'Budget impact must be 0 for UNKNOWN');
  assert.strictEqual(bankContradiction.conflict_detected, true, 'Conflict detected must be true');
  console.log('✓ Safeguard 2: Automated bank narration contradiction without explicit user clarification safely triggers HITL (0 budget impact)');

  // Safeguard 3: Attempting to record one-off dinner expense in counterparty memory via MCP tool is ignored
  const ignoreResult = await executeTool('record_counterparty_memory', {
    counterparty: 'Rahul Sharma',
    typical_intent: 'Dinner payment'
  });
  assert.strictEqual(ignoreResult.status, 'IGNORED', 'One-off dinner intent in record_counterparty_memory must be IGNORED');
  assert.strictEqual(memoryEngine.getCounterparty('Rahul Sharma').typical_intent, 'LOAN');
  console.log('✓ Safeguard 3: record_counterparty_memory rejects one-off expense overwrites');

  // Safeguard 4: UNKNOWN + confidence < 0.88 => ₹0 budget impact
  const unknownTxn = reconciliationEngine.reconcile({
    transaction_id: 'TXN_UNKNOWN_TEST',
    amount: 500,
    direction: 'DEBIT',
    counterparty: 'SomeUnknownPerson'
  });
  assert.strictEqual(unknownTxn.classification, 'UNKNOWN');
  assert(unknownTxn.confidence < 0.88);
  assert.strictEqual(unknownTxn.consumption, 0);
  assert.strictEqual(unknownTxn.budget_impact, 0);
  console.log('✓ Safeguard 4: UNKNOWN + confidence < 0.88 enforces ₹0 budget impact');

  console.log('\n=============================================================================');
  console.log(' ALL CONTRADICTION OVERRIDE & EXPLICIT EVIDENCE PRECEDENCE TESTS PASSED!');
  console.log('=============================================================================');
}

if (require.main === module) {
  runContradictionOverrideTests().catch(err => {
    console.error('\n❌ Test failed with error:', err);
    process.exit(1);
  });
}

module.exports = { runContradictionOverrideTests };
