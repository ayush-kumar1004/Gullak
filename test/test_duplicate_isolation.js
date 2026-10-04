/**
 * Regression Test: State & Memory Isolation on Duplicate Confirmation Flow
 * 
 * Verifies that:
 * 1. Transaction A (₹500 -> Rahul -> DINNER -> CONSUMPTION) affects budget by ₹500.
 * 2. Transaction B (₹500 -> Rahul) triggers duplicate suspicion.
 * 3. User confirms: "This is a separate second transaction, not a duplicate."
 * 4. Transaction B purpose remains UNKNOWN with confidence < 0.88 and budget_impact = ₹0.
 * 5. No "Dinner payment" intent is inferred for Transaction B.
 * 6. Counterparty memory for Rahul is NOT updated or overwritten to "Dinner payment".
 * 7. requires_clarification is true and a targeted question is provided.
 * 8. Historical transactions in the ledger are preserved independently.
 */

const assert = require('assert');
const reconciliationEngine = require('../src/reconciliation');
const memoryEngine = require('../src/memory');
const { executeTool } = require('../src/mcp_server');

async function runRegressionTest() {
  console.log('=============================================================================');
  console.log(' REGRESSION TEST: DUPLICATE RESOLUTION & STATE ISOLATION');
  console.log('=============================================================================\n');

  // Reset memory and reconciliation state for clean test run
  memoryEngine.clear();
  reconciliationEngine.seenTransactions.clear();
  reconciliationEngine.ledger = [];

  // ===========================================================================
  // SCENARIO 1: The Reported Regression Case
  // Transaction A: ₹500 -> Rahul -> DINNER -> CONSUMPTION
  // Transaction B: ₹500 -> Rahul -> possible duplicate
  // User: "This is a separate second transaction, not a duplicate."
  // ===========================================================================

  console.log('--- STEP 1: Reconcile Transaction A (₹500 to Rahul for Dinner) ---');
  const txnA = reconciliationEngine.reconcile({
    transaction_id: 'TXN_A_101',
    amount: 500,
    direction: 'DEBIT',
    counterparty: 'Rahul',
    user_clarification: 'This was for dinner'
  });

  console.log('Txn A Result:', {
    id: txnA.transaction_id,
    classification: txnA.classification,
    confidence: txnA.confidence,
    consumption: txnA.consumption,
    budget_impact: txnA.budget_impact
  });

  assert.strictEqual(txnA.classification, 'CONSUMPTION', 'Transaction A must be classified as CONSUMPTION');
  assert.strictEqual(txnA.consumption, 500, 'Transaction A consumption must be ₹500');
  assert.strictEqual(txnA.budget_impact, 500, 'Transaction A budget impact must be ₹500');
  assert(txnA.confidence >= 0.88, 'Transaction A confidence must be >= 0.88');
  console.log('[PASS] Step 1 passed: Transaction A recorded as CONSUMPTION.\n');

  console.log('--- STEP 2: Reconcile Transaction B (₹500 to Rahul, identical amount & counterparty) ---');
  const txnB_initial = reconciliationEngine.reconcile({
    transaction_id: 'TXN_B_102',
    amount: 500,
    direction: 'DEBIT',
    counterparty: 'Rahul'
  });

  console.log('Txn B Initial Result:', {
    id: txnB_initial.transaction_id,
    classification: txnB_initial.classification,
    confidence: txnB_initial.confidence,
    requires_clarification: txnB_initial.requires_clarification,
    budget_impact: txnB_initial.budget_impact,
    question: txnB_initial.question
  });

  assert.strictEqual(txnB_initial.classification, 'UNKNOWN', 'Txn B must be UNKNOWN due to duplicate suspicion');
  assert(txnB_initial.confidence < 0.88, 'Txn B confidence must be below 0.88 floor');
  assert.strictEqual(txnB_initial.requires_clarification, true, 'Txn B must require clarification');
  assert.strictEqual(txnB_initial.budget_impact, 0, 'Txn B budget impact must be ₹0');
  assert(txnB_initial.question && txnB_initial.question.toLowerCase().includes('duplicate'), 'Question must flag potential duplicate');
  console.log('[PASS] Step 2 passed: Transaction B flagged as potential duplicate.\n');

  console.log('--- STEP 3: User Confirms: "This is a separate second transaction, not a duplicate." ---');
  const txnB_resolved = reconciliationEngine.reconcile({
    transaction_id: 'TXN_B_102',
    amount: 500,
    direction: 'DEBIT',
    counterparty: 'Rahul',
    user_clarification: 'This is a separate second transaction, not a duplicate.'
  });

  console.log('Txn B Resolved Result:', {
    id: txnB_resolved.transaction_id,
    classification: txnB_resolved.classification,
    confidence: txnB_resolved.confidence,
    requires_clarification: txnB_resolved.requires_clarification,
    consumption: txnB_resolved.consumption,
    budget_impact: txnB_resolved.budget_impact,
    duplicate_resolved: txnB_resolved.duplicate_resolved,
    is_duplicate: txnB_resolved.is_duplicate,
    question: txnB_resolved.question,
    explanation: txnB_resolved.explanation
  });

  // Verify critical assertions from user prompt
  assert.strictEqual(txnB_resolved.classification, 'UNKNOWN', 'Txn B purpose must remain UNKNOWN');
  assert(txnB_resolved.confidence < 0.88, 'Txn B confidence must be strictly < 0.88 platform floor');
  assert.strictEqual(txnB_resolved.requires_clarification, true, 'Txn B must require clarification for purpose');
  assert.strictEqual(txnB_resolved.consumption, 0, 'Txn B consumption must be 0');
  assert.strictEqual(txnB_resolved.consumption_amount, 0, 'Txn B consumption_amount must be 0');
  assert.strictEqual(txnB_resolved.budget_impact, 0, 'Txn B budget impact must be ₹0');
  assert.strictEqual(txnB_resolved.is_duplicate, false, 'Txn B is NOT a duplicate');
  assert.strictEqual(txnB_resolved.duplicate_resolved, true, 'Txn B duplicate ambiguity was resolved');
  
  // Guard against dinner inference
  const resultString = JSON.stringify(txnB_resolved).toLowerCase();
  assert(!resultString.includes('dinner'), 'No "Dinner" or "Dinner payment" must be inferred for Transaction B');
  assert(txnB_resolved.question && txnB_resolved.question.includes('second ₹500'), 'Question must ask what the second ₹500 was for');

  // Verify counterparty memory was NOT updated to "Dinner payment"
  const rahulMemory = memoryEngine.getCounterparty('Rahul');
  console.log('Rahul Counterparty Memory:', rahulMemory);
  if (rahulMemory) {
    const memoryString = JSON.stringify(rahulMemory).toLowerCase();
    assert(!memoryString.includes('dinner'), 'Rahul counterparty memory must NOT be set to dinner');
  }
  console.log('[PASS] Step 3 passed: Txn B remains UNKNOWN with ₹0 budget impact and no Dinner inference.\n');

  // ===========================================================================
  // SCENARIO 2: MCP Tool Call Flow via handleCallTool
  // User clarifies "I confirm this is a separate second transaction, not a duplicate."
  // Test via MCP JSON-RPC tool router
  // ===========================================================================
  console.log('--- STEP 4: MCP Protocol Invocation for Duplicate Resolution ---');
  const mcpCallResult = await executeTool('reconcile_transaction', {
    amount: 500,
    direction: 'DEBIT',
    counterparty: 'Rahul Sharma',
    channel: 'UPI',
    user_clarification: 'I confirm this is a separate second transaction, not a duplicate.'
  });

  assert.strictEqual(mcpCallResult.classification, 'UNKNOWN', 'MCP result classification must be UNKNOWN');
  assert(mcpCallResult.confidence < 0.88, 'MCP result confidence must be < 0.88');
  assert.strictEqual(mcpCallResult.requires_clarification, true, 'MCP result must require clarification');
  assert.strictEqual(mcpCallResult.budget_impact, 0, 'MCP result budget impact must be 0');
  assert.strictEqual(mcpCallResult.consumption, 0, 'MCP result consumption must be 0');
  assert(mcpCallResult.question && mcpCallResult.question.includes('second ₹500'), 'MCP question must ask what second transaction was for');
  console.log('[PASS] Step 4 passed: MCP tool invocation returns UNKNOWN with requires_clarification=true.\n');

  // ===========================================================================
  // SCENARIO 3: AgenticOrg Attempt to Record "Dinner payment" Counterparty Memory
  // Ensure the guard prevents recording one-off dinner expenses as counterparty relationship
  // ===========================================================================
  console.log('--- STEP 5: Guard against AgenticOrg recording "Dinner payment" Counterparty Memory ---');
  const memoryCallResult = await executeTool('record_counterparty_memory', {
    counterparty: 'Rahul Sharma',
    classification: 'FRIEND_P2P',
    typical_intent: 'Dinner payment'
  });

  console.log('Record Memory Tool Response:', memoryCallResult);
  assert.strictEqual(memoryCallResult.status, 'IGNORED', 'One-off dinner payment must be ignored as counterparty typical intent');
  const cpCheck = memoryEngine.getCounterparty('Rahul Sharma');
  if (cpCheck) {
    assert(cpCheck.typical_intent !== 'Dinner payment', 'Rahul Sharma typical_intent must NOT be Dinner payment');
  }
  console.log('[PASS] Step 5 passed: Guard successfully prevented recording one-off dinner expense in counterparty memory.\n');

  // ===========================================================================
  // SCENARIO 4: Prior LOAN relationship preserved and not auto-inferred on duplicate confirmation
  // 1. ₹500 -> Rahul -> LOAN
  // 2. ₹500 -> Rahul -> possible duplicate
  // 3. User: "This is a separate second transaction, not a duplicate."
  // ===========================================================================
  console.log('--- STEP 6: Multi-turn State Isolation (Loan -> Duplicate -> Confirmed Separate) ---');
  memoryEngine.clear();
  reconciliationEngine.seenTransactions.clear();
  reconciliationEngine.ledger = [];

  // Step 6a: ₹500 to Rahul for a loan
  const loanTxn = reconciliationEngine.reconcile({
    transaction_id: 'TXN_LOAN_01',
    amount: 500,
    direction: 'DEBIT',
    counterparty: 'Rahul',
    user_clarification: 'I lent Rahul the money.'
  });
  assert.strictEqual(loanTxn.classification, 'LOAN', 'First transaction must be LOAN');
  assert.strictEqual(loanTxn.budget_impact, 0, 'Loan budget impact must be 0');

  // Step 6b: Second ₹500 to Rahul -> duplicate detected
  const dupTxn = reconciliationEngine.reconcile({
    transaction_id: 'TXN_LOAN_02',
    amount: 500,
    direction: 'DEBIT',
    counterparty: 'Rahul'
  });
  assert(dupTxn.question && dupTxn.question.toLowerCase().includes('duplicate'), 'Second txn must flag duplicate');

  // Step 6c: User confirms separate transaction
  const separateTxn = reconciliationEngine.reconcile({
    transaction_id: 'TXN_LOAN_02',
    amount: 500,
    direction: 'DEBIT',
    counterparty: 'Rahul',
    user_clarification: 'I confirm this is a separate second transaction, not a duplicate.'
  });

  assert.strictEqual(separateTxn.classification, 'UNKNOWN', 'Confirmed second transaction must NOT auto-infer LOAN from memory');
  assert(separateTxn.confidence < 0.88, 'Confidence must remain < 0.88');
  assert.strictEqual(separateTxn.requires_clarification, true, 'Must ask what the second transaction was for');
  assert.strictEqual(separateTxn.budget_impact, 0, 'Budget impact must be 0');
  console.log('[PASS] Step 6 passed: Prior LOAN memory did not contaminate unclassified second transaction.\n');

  // ===========================================================================
  // SCENARIO 5: Ledger Integrity Check
  // Both transactions exist independently in the ledger
  // ===========================================================================
  console.log('--- STEP 7: Ledger Integrity Verification ---');
  const ledger = reconciliationEngine.ledger;
  const loanInLedger = ledger.find(t => t.transaction_id === 'TXN_LOAN_01');
  const separateInLedger = ledger.find(t => t.transaction_id === 'TXN_LOAN_02');

  assert(loanInLedger, 'TXN_LOAN_01 must be preserved in ledger');
  assert(separateInLedger, 'TXN_LOAN_02 must be preserved in ledger');
  assert.strictEqual(loanInLedger.classification, 'LOAN', 'TXN_LOAN_01 must remain LOAN');
  assert.strictEqual(separateInLedger.classification, 'UNKNOWN', 'TXN_LOAN_02 must remain UNKNOWN');
  // ===========================================================================
  // SCENARIO 6: Exact User Prompt 7-Step Orchestration Flow
  // 1. User sends Rahul ₹500.
  // 2. Agent asks whether it is a duplicate.
  // 3. User says: "It was another loan to Rahul."
  // 4. Agent correctly classifies it as LOAN.
  // 5. A later transaction is ₹500 to Rahul.
  // 6. Agent asks whether it is a duplicate.
  // 7. User replies: "I confirm this is a separate transaction, not a duplicate."
  // Required: UNKNOWN, confidence < 0.88, requires_clarification = true, budget_impact = 0, duplicate_resolved = true
  // ===========================================================================
  console.log('--- STEP 8: Exact 7-Step Sequence Verification ---');
  memoryEngine.clear();
  reconciliationEngine.seenTransactions.clear();
  reconciliationEngine.ledger = [];

  // Step 1: User sends Rahul ₹500
  const step1 = reconciliationEngine.reconcile({
    transaction_id: 'TXN_STEP1',
    amount: 500,
    direction: 'DEBIT',
    counterparty: 'Rahul'
  });

  // Step 2 & 3: User says "It was another loan to Rahul."
  const step3 = reconciliationEngine.reconcile({
    transaction_id: 'TXN_STEP1',
    amount: 500,
    direction: 'DEBIT',
    counterparty: 'Rahul',
    user_clarification: 'It was another loan to Rahul.'
  });
  console.log('Step 3-4 (Classify as LOAN):', step3.classification, 'confidence:', step3.confidence);
  assert.strictEqual(step3.classification, 'LOAN');
  assert.strictEqual(step3.budget_impact, 0);

  // Step 5: A later transaction is ₹500 to Rahul
  const step5 = reconciliationEngine.reconcile({
    transaction_id: 'TXN_STEP5',
    amount: 500,
    direction: 'DEBIT',
    counterparty: 'Rahul'
  });
  console.log('Step 5-6 (Duplicate Check):', step5.is_duplicate, 'question:', step5.question);
  assert(step5.requires_clarification, 'Step 5 must require clarification');

  // Step 7: User replies: "I confirm this is a separate transaction, not a duplicate."
  const step7 = await executeTool('reconcile_transaction', {
    transaction_id: 'TXN_STEP5',
    amount: 500,
    direction: 'DEBIT',
    counterparty: 'Rahul',
    user_clarification: 'I confirm this is a separate transaction, not a duplicate.'
  });

  console.log('Step 7 Final Result:', {
    classification: step7.classification,
    category: step7.category,
    confidence: step7.confidence,
    requires_clarification: step7.requires_clarification,
    consumption: step7.consumption,
    consumption_amount: step7.consumption_amount,
    budget_impact: step7.budget_impact,
    budgetImpact: step7.budgetImpact,
    duplicate_resolved: step7.duplicate_resolved,
    is_duplicate: step7.is_duplicate,
    question: step7.question
  });

  assert.strictEqual(step7.classification, 'UNKNOWN', 'Must NOT classify as LOAN; must be UNKNOWN');
  assert.strictEqual(step7.category, 'UNKNOWN', 'Category must be UNKNOWN');
  assert(step7.confidence < 0.88, 'Confidence must be strictly < 0.88 platform floor');
  assert.strictEqual(step7.requires_clarification, true, 'requires_clarification must be true');
  assert.strictEqual(step7.consumption, 0, 'consumption must be 0');
  assert.strictEqual(step7.consumption_amount, 0, 'consumption_amount must be 0');
  assert.strictEqual(step7.budget_impact, 0, 'budget_impact must be 0');
  assert.strictEqual(step7.budgetImpact, 0, 'budgetImpact must be 0');
  assert.strictEqual(step7.duplicate_resolved, true, 'duplicate_resolved must be true');
  assert.strictEqual(step7.is_duplicate, false, 'is_duplicate must be false');
  assert(step7.question && step7.question.includes('second ₹500'), 'Question must ask what second ₹500 was for');
  console.log('[PASS] Step 8 passed: 7-step flow correctly isolates duplicate resolution and keeps separate transaction UNKNOWN.\n');

  console.log('=============================================================================');
  console.log(' ALL REGRESSION TESTS PASSED (100% SUCCESS)');
  console.log(' State and memory isolation verified for duplicate transaction flows.');
  console.log('=============================================================================\n');
}

if (require.main === module) {
  runRegressionTest().catch(err => {
    console.error('\n[REGRESSION TEST FAILED]:', err);
    process.exit(1);
  });
}

module.exports = { runRegressionTest };
