const assert = require('assert');
const reconciliationEngine = require('../src/reconciliation');
const memoryEngine = require('../src/memory');
const budgetEngine = require('../src/budget');

async function runCases() {
  console.log('====================================================');
  console.log('RUNNING THE 4 TARGETED BUSINESS LOGIC CASES');
  console.log('====================================================\n');

  // Reset states
  reconciliationEngine.clear();
  memoryEngine.clear();

  // --------------------------------------------------------------------------
  // CASE 1: ₹500 → Rahul Sharma, UPI, purpose unknown.
  // Expected: UNKNOWN + clarification + ₹0 budget impact.
  // --------------------------------------------------------------------------
  console.log('--- CASE 1: ₹500 -> Rahul Sharma, UPI, purpose unknown ---');
  // Scenario A: Without clarification field (standard API call)
  const case1A = reconciliationEngine.reconcile({
    transaction_id: 'TXN_CASE_1A',
    amount: 500,
    direction: 'DEBIT',
    counterparty: 'Rahul Sharma',
    raw_narration: 'UPI/RAHUL/UNKNOWN'
  });

  console.log('Case 1A Result (raw narration unknown):');
  console.log({
    classification: case1A.classification,
    confidence: case1A.confidence,
    requires_clarification: case1A.requires_clarification,
    consumption: case1A.consumption_amount,
    budget_impact: case1A.budget_impact,
    question: case1A.question
  });

  assert.strictEqual(case1A.classification, 'UNKNOWN', 'Case 1A classification must be UNKNOWN');
  assert.ok(case1A.confidence < 0.88, `Case 1A confidence (${case1A.confidence}) must be < 0.88`);
  assert.strictEqual(case1A.requires_clarification, true, 'Case 1A requires_clarification must be true');
  assert.strictEqual(case1A.budget_impact, 0, 'Case 1A budget_impact must be 0');
  assert.strictEqual(case1A.consumption_amount, 0, 'Case 1A consumption must be 0');

  // Scenario B: With user query passed into user_clarification ("I don't remember what it was for")
  const case1B = reconciliationEngine.reconcile({
    transaction_id: 'TXN_CASE_1B',
    amount: 500,
    direction: 'DEBIT',
    counterparty: 'Rahul Sharma',
    user_clarification: "I sent ₹500 to Rahul Sharma via UPI, but I don't remember what it was for. Determine whether you can classify it confidently; if not, ask me for clarification and do not assign it to my spending budget."
  });

  console.log('\nCase 1B Result (user states cannot remember in clarification):');
  console.log({
    classification: case1B.classification,
    confidence: case1B.confidence,
    requires_clarification: case1B.requires_clarification,
    consumption: case1B.consumption_amount,
    budget_impact: case1B.budget_impact,
    question: case1B.question,
    reasoning: case1B.reasoning
  });

  assert.strictEqual(case1B.classification, 'UNKNOWN', 'Case 1B classification must remain UNKNOWN');
  assert.ok(case1B.confidence < 0.88, `Case 1B confidence (${case1B.confidence}) must be < 0.88`);
  assert.strictEqual(case1B.requires_clarification, true, 'Case 1B requires_clarification must be true');
  assert.strictEqual(case1B.budget_impact, 0, 'Case 1B budget_impact must remain 0');
  assert.strictEqual(case1B.consumption_amount, 0, 'Case 1B consumption must remain 0');
  console.log('>>> CASE 1 PASSED!\n');

  // --------------------------------------------------------------------------
  // CASE 2: ₹500 → Rahul Sharma, UPI, counterparty memory explicitly says "monthly rent repayment".
  // Expected: classify according to the stored evidence with appropriate confidence.
  // --------------------------------------------------------------------------
  console.log('--- CASE 2: Counterparty memory explicitly says "monthly rent repayment" ---');
  memoryEngine.recordCounterparty({
    counterparty: 'Rahul Sharma',
    classification: 'RENT_REPAYMENT',
    typical_intent: 'RENT_REPAYMENT',
    notes: 'monthly rent repayment',
    confidence: 0.95
  });

  const case2 = reconciliationEngine.reconcile({
    transaction_id: 'TXN_CASE_2',
    amount: 500,
    direction: 'DEBIT',
    counterparty: 'Rahul Sharma'
  });

  console.log('Case 2 Result:');
  console.log({
    classification: case2.classification,
    confidence: case2.confidence,
    requires_clarification: case2.requires_clarification,
    consumption: case2.consumption_amount,
    budget_impact: case2.budget_impact,
    reasoning: case2.reasoning
  });

  assert.strictEqual(case2.classification, 'RENT_REPAYMENT', 'Case 2 classification must match stored memory (RENT_REPAYMENT)');
  assert.ok(case2.confidence >= 0.88, `Case 2 confidence (${case2.confidence}) must be >= 0.88 floor`);
  assert.strictEqual(case2.requires_clarification, false, 'Case 2 requires_clarification must be false');
  assert.strictEqual(case2.budget_impact, 0, 'Case 2 rent repayment must not reduce discretionary daily budget');
  assert.strictEqual(case2.consumption_amount, 0, 'Case 2 consumption is 0');
  console.log('>>> CASE 2 PASSED!\n');

  // --------------------------------------------------------------------------
  // CASE 3: ₹500 → Rahul Sharma, UPI, user says "this was my dinner payment."
  // Expected: classify using the user's explicit clarification and then apply the appropriate budget impact.
  // --------------------------------------------------------------------------
  console.log('--- CASE 3: User says "this was my dinner payment." ---');
  // First test on fresh counterparty (no prior memory)
  memoryEngine.clear();
  const case3 = reconciliationEngine.reconcile({
    transaction_id: 'TXN_CASE_3',
    amount: 500,
    direction: 'DEBIT',
    counterparty: 'Rahul Sharma',
    user_clarification: 'this was my dinner payment.'
  });

  console.log('Case 3 Result:');
  console.log({
    classification: case3.classification,
    confidence: case3.confidence,
    requires_clarification: case3.requires_clarification,
    consumption: case3.consumption_amount,
    budget_impact: case3.budget_impact,
    reasoning: case3.reasoning
  });

  assert.strictEqual(case3.classification, 'CONSUMPTION', 'Case 3 classification must be CONSUMPTION');
  assert.ok(case3.confidence >= 0.88, `Case 3 confidence (${case3.confidence}) must be >= 0.88`);
  assert.strictEqual(case3.requires_clarification, false, 'Case 3 requires_clarification must be false');
  assert.strictEqual(case3.consumption_amount, 500, 'Case 3 consumption must be ₹500');
  assert.strictEqual(case3.budget_impact, 500, 'Case 3 budget_impact must be ₹500');

  // Test subsequent budget update
  const budgetResult = budgetEngine.adaptBudget({
    actual_personal_spending: case3.consumption_amount,
    planned_daily_budget: 1000,
    remaining_days: 20,
    transaction_id: case3.transaction_id
  });
  console.log('Case 3 Budget Adaptation Result:');
  console.log({
    actual_personal_spending: budgetResult.actual_personal_spending,
    status: budgetResult.status,
    savings_goal_protected: budgetResult.savings_goal_protected
  });
  assert.strictEqual(budgetResult.actual_personal_spending, 500, 'Budget spending updated with verified ₹500');
  console.log('>>> CASE 3 PASSED!\n');

  // --------------------------------------------------------------------------
  // CASE 4: Conflicting counterparty memory and user clarification.
  // Expected: user clarification should be handled explicitly and the system should not silently choose an arbitrary classification.
  // --------------------------------------------------------------------------
  console.log('--- CASE 4: Conflicting counterparty memory and user clarification ---');
  // Counterparty memory says "monthly rent repayment"
  memoryEngine.recordCounterparty({
    counterparty: 'Rahul Sharma',
    classification: 'RENT_REPAYMENT',
    typical_intent: 'RENT_REPAYMENT',
    notes: 'monthly rent repayment',
    confidence: 0.95
  });

  // User clarification for this specific transaction says "this was my dinner payment."
  const case4 = reconciliationEngine.reconcile({
    transaction_id: 'TXN_CASE_4',
    amount: 500,
    direction: 'DEBIT',
    counterparty: 'Rahul Sharma',
    user_clarification: 'this was my dinner payment.'
  });

  console.log('Case 4 Result:');
  console.log({
    classification: case4.classification,
    confidence: case4.confidence,
    conflict_detected: case4.conflict_detected,
    stored_memory_intent: case4.stored_memory_intent,
    user_override: case4.user_override,
    consumption: case4.consumption_amount,
    budget_impact: case4.budget_impact,
    reasoning: case4.reasoning
  });

  assert.strictEqual(case4.conflict_detected, true, 'Case 4 conflict_detected must be true');
  assert.ok(case4.reasoning.includes('Conflict explicitly handled'), 'Case 4 explanation must explicitly state conflict was handled');
  assert.strictEqual(case4.classification, 'CONSUMPTION', 'Case 4 user explicit clarification takes precedence for this transaction');
  assert.strictEqual(case4.budget_impact, 500, 'Case 4 applies verified budget impact');
  assert.strictEqual(case4.user_override, true, 'Case 4 user_override flag is set');
  console.log('>>> CASE 4 PASSED!\n');

  // --------------------------------------------------------------------------
  // Guardrail Verification
  // --------------------------------------------------------------------------
  console.log('--- GUARDRAIL VERIFICATION ---');
  const guardrailCheck = reconciliationEngine.createReconciliationResult({
    transaction_id: 'TXN_GUARDRAIL_01',
    amount: 9999,
    direction: 'DEBIT',
    counterparty: 'Random Stranger',
    classification: 'UNKNOWN',
    confidence: 0.50,
    consumption: 9999, // Attempted violation
    budget_impact: 9999 // Attempted violation
  });

  assert.strictEqual(guardrailCheck.consumption_amount, 0, 'Guardrail: consumption forced to 0 for UNKNOWN');
  assert.strictEqual(guardrailCheck.budget_impact, 0, 'Guardrail: budget_impact forced to 0 for UNKNOWN');
  assert.strictEqual(guardrailCheck.requires_clarification, true, 'Guardrail: requires_clarification forced to true');
  console.log('>>> INVIOLABLE GUARDRAIL PASSED!\n');

  console.log('====================================================');
  console.log('ALL 4 CASES AND GUARDRAILS PASSED PERFECTLY!');
  console.log('====================================================');
}

runCases().catch(err => {
  console.error('Test execution failed:', err);
  process.exit(1);
});
