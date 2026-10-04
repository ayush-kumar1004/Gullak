/**
 * Gullak Comprehensive Hardening Regression Suite (Scenarios A through P)
 * 
 * Validates all P0 and P1 fixes:
 * A. Unknown transaction (ambiguous, confidence < 0.88, budget=0)
 * B. Loan (classification=LOAN, confidence >= 0.88, budget=0, receivable=800)
 * C. Repayment (classification=REPAYMENT, CREDIT, loan_recovered=800, budget=0)
 * D. Dinner (classification=CONSUMPTION, confidence >= 0.88, budget=600)
 * E. Split (classification=SPLIT, consumption=500, receivable=500, budget=500)
 * F. Duplicate (identical amount & counterparty -> potential duplicate + HITL)
 * G. Duplicate resolved ("separate transaction" -> UNKNOWN, not duplicate, budget=0, asks purpose)
 * H. Memory conflict (Aman remembered as LOAN, paid for dinner -> CONSUMPTION, user_override=true, memory remains LOAN)
 * I. Budget unauthorized (adapt_daily_budget without classification/confidence -> REJECTED, no mutation)
 * J. Budget UNKNOWN (UNKNOWN + 0.52 -> no mutation)
 * K. Budget verified consumption (CONSUMPTION + 0.98 -> mutation allowed)
 * L. Savings protection (extreme overspend -> savings goal remains ₹15,000, tradeoff required)
 * M. Temporary adjustment authorization (explicit backend authorization -> mutates deterministically, savings goal protected)
 * N. Gnani parser (arbitrary names: Neha, Aman, Priya, arbitrary amounts)
 * O. Gnani unavailable (never fabricates hardcoded Rahul transaction)
 * P. Dashboard production state safety (opening dashboard never executes benchmark or mutates state)
 */

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const reconciliationEngine = require('../src/reconciliation');
const memoryEngine = require('../src/memory');
const budgetEngine = require('../src/budget');
const gnaniVoice = require('../src/gnani');
const { executeTool } = require('../src/mcp_server');

async function runHardeningTests() {
  console.log('=============================================================================');
  console.log(' GULLAK COMPREHENSIVE HARDENING REGRESSION SUITE (SCENARIOS A - P)');
  console.log('=============================================================================\n');

  let passed = 0;
  let total = 16;

  // Helper to reset state
  function resetState() {
    reconciliationEngine.clear();
    memoryEngine.clear();
    budgetEngine.reset();
  }

  // ---------------------------------------------------------------------------
  // SCENARIO A: Unknown transaction
  // ---------------------------------------------------------------------------
  console.log('Test A: Unknown transaction');
  resetState();
  const resA = reconciliationEngine.reconcile({
    amount: 800,
    direction: 'DEBIT',
    counterparty: 'Neha',
    raw_narration: "I sent Neha ₹800 via UPI, but I don't remember what it was for."
  });
  assert.strictEqual(resA.classification, 'UNKNOWN', 'A: classification must be UNKNOWN');
  assert.ok(resA.confidence < 0.88, 'A: confidence must be < 0.88');
  assert.strictEqual(resA.requires_clarification, true, 'A: clarification must be true');
  assert.strictEqual(resA.budget_impact, 0, 'A: budget impact must be 0');
  assert.strictEqual(resA.consumption, 0, 'A: consumption must be 0');
  console.log('  [PASS] Scenario A passed\n');
  passed++;

  // ---------------------------------------------------------------------------
  // SCENARIO B: Loan
  // ---------------------------------------------------------------------------
  console.log('Test B: Loan');
  resetState();
  const resB = reconciliationEngine.reconcile({
    amount: 800,
    direction: 'DEBIT',
    counterparty: 'Neha',
    user_clarification: 'I lent Neha ₹800 because she needed money.'
  });
  assert.strictEqual(resB.classification, 'LOAN', 'B: classification must be LOAN');
  assert.ok(resB.confidence >= 0.88, 'B: confidence must be >= 0.88');
  assert.strictEqual(resB.budget_impact, 0, 'B: budget impact must be 0');
  assert.strictEqual(resB.consumption, 0, 'B: consumption must be 0');
  assert.strictEqual(resB.amountReceivable, 800, 'B: receivable must be 800');
  console.log('  [PASS] Scenario B passed\n');
  passed++;

  // ---------------------------------------------------------------------------
  // SCENARIO C: Repayment
  // ---------------------------------------------------------------------------
  console.log('Test C: Repayment');
  resetState();
  const resC = reconciliationEngine.reconcile({
    amount: 800,
    direction: 'CREDIT',
    counterparty: 'Neha',
    user_clarification: 'Neha repaid the ₹800 she borrowed from me.'
  });
  assert.strictEqual(resC.classification, 'REPAYMENT', 'C: classification must be REPAYMENT');
  assert.strictEqual(resC.direction, 'CREDIT', 'C: direction must be CREDIT');
  assert.ok(resC.confidence >= 0.88, 'C: confidence must be >= 0.88');
  assert.strictEqual(resC.requires_clarification, false, 'C: requires_clarification must be false');
  assert.strictEqual(resC.budget_impact, 0, 'C: budget impact must be 0');
  assert.strictEqual(resC.consumption, 0, 'C: consumption must be 0');
  assert.strictEqual(resC.loan_recovered, 800, 'C: loan_recovered must be 800');
  console.log('  [PASS] Scenario C passed\n');
  passed++;

  // ---------------------------------------------------------------------------
  // SCENARIO D: Dinner
  // ---------------------------------------------------------------------------
  console.log('Test D: Dinner');
  resetState();
  const resD = reconciliationEngine.reconcile({
    amount: 600,
    direction: 'DEBIT',
    counterparty: 'Neha',
    user_clarification: 'I paid Neha ₹600 for dinner.'
  });
  assert.strictEqual(resD.classification, 'CONSUMPTION', 'D: classification must be CONSUMPTION');
  assert.ok(resD.confidence >= 0.88, 'D: confidence must be >= 0.88');
  assert.strictEqual(resD.budget_impact, 600, 'D: budget impact must be 600');
  assert.strictEqual(resD.consumption, 600, 'D: consumption must be 600');
  console.log('  [PASS] Scenario D passed\n');
  passed++;

  // ---------------------------------------------------------------------------
  // SCENARIO E: Split
  // ---------------------------------------------------------------------------
  console.log('Test E: Split');
  resetState();
  const resE = reconciliationEngine.reconcile({
    amount: 1000,
    direction: 'DEBIT',
    counterparty: 'Neha',
    user_clarification: 'I paid ₹1000 for dinner for me and Neha. Neha owes me ₹500.'
  });
  assert.strictEqual(resE.classification, 'SPLIT', 'E: classification must be SPLIT');
  assert.ok(resE.confidence >= 0.88, 'E: confidence must be >= 0.88');
  assert.strictEqual(resE.consumption, 500, 'E: consumption must be 500');
  assert.strictEqual(resE.amountReceivable, 500, 'E: receivable must be 500');
  assert.strictEqual(resE.budget_impact, 500, 'E: budget impact must be 500');
  console.log('  [PASS] Scenario E passed\n');
  passed++;

  // ---------------------------------------------------------------------------
  // SCENARIO F: Duplicate
  // ---------------------------------------------------------------------------
  console.log('Test F: Duplicate');
  resetState();
  // First transaction
  const txnF1 = reconciliationEngine.reconcile({
    transaction_id: 'TXN_F1',
    amount: 500,
    direction: 'DEBIT',
    counterparty: 'Priya',
    user_clarification: 'Coffee'
  });
  // Second identical transaction
  const txnF2 = reconciliationEngine.reconcile({
    transaction_id: 'TXN_F2',
    amount: 500,
    direction: 'DEBIT',
    counterparty: 'Priya'
  });
  assert.strictEqual(txnF2.is_duplicate, true, 'F: is_duplicate must be true');
  assert.strictEqual(txnF2.requires_clarification, true, 'F: requires_clarification must be true');
  assert.ok(txnF2.confidence < 0.88, 'F: confidence must be < 0.88');
  assert.strictEqual(txnF2.budget_impact, 0, 'F: budget_impact must be 0');
  console.log('  [PASS] Scenario F passed\n');
  passed++;

  // ---------------------------------------------------------------------------
  // SCENARIO G: Duplicate resolved
  // ---------------------------------------------------------------------------
  console.log('Test G: Duplicate resolved');
  const txnG = reconciliationEngine.reconcile({
    transaction_id: 'TXN_F2',
    amount: 500,
    direction: 'DEBIT',
    counterparty: 'Priya',
    user_clarification: 'I confirm this is a separate transaction, not a duplicate.'
  });
  assert.strictEqual(txnG.duplicate_resolved, true, 'G: duplicate_resolved must be true');
  assert.strictEqual(txnG.is_duplicate, false, 'G: is_duplicate must be false');
  assert.strictEqual(txnG.classification, 'UNKNOWN', 'G: classification must be UNKNOWN');
  assert.ok(txnG.confidence < 0.88, 'G: confidence must be < 0.88');
  assert.strictEqual(txnG.requires_clarification, true, 'G: requires_clarification must be true');
  assert.strictEqual(txnG.budget_impact, 0, 'G: budget_impact must be 0');
  assert.strictEqual(txnG.consumption, 0, 'G: consumption must be 0');
  console.log('  [PASS] Scenario G passed\n');
  passed++;

  // ---------------------------------------------------------------------------
  // SCENARIO H: Memory conflict
  // ---------------------------------------------------------------------------
  console.log('Test H: Memory conflict');
  resetState();
  // Set memory for Aman as LOAN
  memoryEngine.recordCounterparty({
    counterparty: 'Aman',
    classification: 'LOAN',
    typical_intent: 'LOAN',
    notes: 'User frequently lends money to Aman',
    confidence: 0.95
  });
  const resH = reconciliationEngine.reconcile({
    amount: 600,
    direction: 'DEBIT',
    counterparty: 'Aman',
    user_clarification: 'I paid Aman ₹600 for dinner.'
  });
  assert.strictEqual(resH.classification, 'CONSUMPTION', 'H: classification must be CONSUMPTION');
  assert.ok(resH.confidence >= 0.88, 'H: confidence must be >= 0.88');
  assert.strictEqual(resH.budget_impact, 600, 'H: budget_impact must be 600');
  assert.strictEqual(resH.conflict_detected, true, 'H: conflict_detected must be true');
  assert.strictEqual(resH.user_override, true, 'H: user_override must be true');
  // Check memory was NOT overwritten with dinner!
  const memAman = memoryEngine.getCounterparty('Aman');
  assert.strictEqual(memAman.typical_intent, 'LOAN', 'H: counterparty memory must remain LOAN');
  console.log('  [PASS] Scenario H passed\n');
  passed++;

  // ---------------------------------------------------------------------------
  // SCENARIO I: Budget unauthorized (Fail-Closed)
  // ---------------------------------------------------------------------------
  console.log('Test I: Budget unauthorized');
  resetState();
  const resI = budgetEngine.adaptBudget({
    actual_personal_spending: 600
  });
  assert.strictEqual(resI.status, 'REJECTED', 'I: status must be REJECTED');
  assert.strictEqual(resI.budget_mutated, false, 'I: budget_mutated must be false');
  assert.strictEqual(resI.budget_impact, 0, 'I: budget_impact must be 0');
  assert.strictEqual(budgetEngine.getState().current_daily_budget, 300, 'I: daily budget unchanged');
  console.log('  [PASS] Scenario I passed\n');
  passed++;

  // ---------------------------------------------------------------------------
  // SCENARIO J: Budget UNKNOWN
  // ---------------------------------------------------------------------------
  console.log('Test J: Budget UNKNOWN');
  resetState();
  const resJ = budgetEngine.adaptBudget({
    actual_personal_spending: 500,
    classification: 'UNKNOWN',
    confidence: 0.52
  });
  assert.strictEqual(resJ.status, 'REJECTED', 'J: status must be REJECTED');
  assert.strictEqual(resJ.budget_mutated, false, 'J: budget_mutated must be false');
  assert.strictEqual(resJ.budget_impact, 0, 'J: budget_impact must be 0');
  assert.strictEqual(budgetEngine.getState().current_daily_budget, 300, 'J: daily budget unchanged');
  console.log('  [PASS] Scenario J passed\n');
  passed++;

  // ---------------------------------------------------------------------------
  // SCENARIO K: Budget verified consumption
  // ---------------------------------------------------------------------------
  console.log('Test K: Budget verified consumption');
  resetState();
  const resK = budgetEngine.adaptBudget({
    actual_personal_spending: 600,
    classification: 'CONSUMPTION',
    confidence: 0.98
  });
  assert.strictEqual(resK.status, 'ADAPTED', 'K: status must be ADAPTED');
  assert.strictEqual(resK.budget_mutated, true, 'K: budget_mutated must be true');
  assert.strictEqual(resK.budget_impact, 600, 'K: budget_impact must be 600');
  assert.ok(resK.new_daily_budget < 300, 'K: daily budget adjusted down smoothly');
  console.log('  [PASS] Scenario K passed\n');
  passed++;

  // ---------------------------------------------------------------------------
  // SCENARIO L: Savings protection
  // ---------------------------------------------------------------------------
  console.log('Test L: Savings protection');
  resetState();
  const resL = budgetEngine.adaptBudget({
    actual_personal_spending: 10000,
    classification: 'CONSUMPTION',
    confidence: 0.98
  });
  assert.strictEqual(resL.status, 'SAVINGS_PROTECTION_ALERT', 'L: status must be SAVINGS_PROTECTION_ALERT');
  assert.strictEqual(resL.requires_user_tradeoff, true, 'L: requires_user_tradeoff must be true');
  assert.strictEqual(resL.budget_mutated, false, 'L: budget_mutated must be false before authorization');
  assert.strictEqual(resL.savings_goal_protected, true, 'L: savings_goal_protected must be true');
  assert.strictEqual(resL.savings_goal_amount, 15000, 'L: savings goal remains 15000');
  assert.strictEqual(budgetEngine.getState().monthly_savings_goal, 15000, 'L: monthly_savings_goal must be 15000');
  console.log('  [PASS] Scenario L passed\n');
  passed++;

  // ---------------------------------------------------------------------------
  // SCENARIO M: Temporary adjustment authorization & Buffer authorization
  // ---------------------------------------------------------------------------
  console.log('Test M: Tradeoff authorization');
  // Subtest M1: Invalid choice rejected
  const resM_invalid = budgetEngine.authorizeTradeoff({ tradeoff_type: 'INVALID_CHOICE' });
  assert.strictEqual(resM_invalid.status, 'REJECTED', 'M: invalid choice must be REJECTED');
  assert.strictEqual(resM_invalid.budget_mutated, false, 'M: budget_mutated must be false');
  assert.strictEqual(resM_invalid.savings_goal_protected, true, 'M: savings_goal_protected must be true');

  // Subtest M2: TEMPORARY_ADJUSTMENT authorization
  const resM_temp = budgetEngine.authorizeTradeoff({ tradeoff_type: 'TEMPORARY_ADJUSTMENT', minimum_daily_budget: 100 });
  assert.strictEqual(resM_temp.status, 'AUTHORIZED', 'M: status must be AUTHORIZED');
  assert.strictEqual(resM_temp.budget_mutated, true, 'M: budget_mutated must be true');
  assert.strictEqual(resM_temp.new_budget, 100, 'M: new_budget must be 100');
  assert.strictEqual(resM_temp.savings_goal, 15000, 'M: savings goal remains 15000');
  assert.strictEqual(resM_temp.savings_goal_protected, true, 'M: savings_goal_protected must be true');

  // Subtest M3: BUFFER authorization
  resetState();
  // Trigger alert first
  budgetEngine.adaptBudget({
    actual_personal_spending: 5000,
    classification: 'CONSUMPTION',
    confidence: 0.98
  });
  const resM_buf = budgetEngine.authorizeTradeoff({ tradeoff_type: 'BUFFER' });
  assert.strictEqual(resM_buf.status, 'AUTHORIZED', 'M: buffer status must be AUTHORIZED');
  assert.strictEqual(resM_buf.selected_tradeoff, 'BUFFER', 'M: selected_tradeoff must be BUFFER');
  assert.strictEqual(resM_buf.savings_goal_protected, true, 'M: savings_goal_protected must be true');
  assert.strictEqual(resM_buf.savings_goal, 15000, 'M: savings_goal must be 15000');
  console.log('  [PASS] Scenario M passed\n');
  passed++;

  // ---------------------------------------------------------------------------
  // SCENARIO N: Gnani parser
  // ---------------------------------------------------------------------------
  console.log('Test N: Gnani parser arbitrary names');
  const p1 = gnaniVoice.parseHinglishTranscript('Neha ko 800 diye the, udhaar tha');
  assert.strictEqual(p1.counterparty, 'Neha', 'N: parsed Neha');
  assert.strictEqual(p1.amount, 800, 'N: parsed 800');
  assert.strictEqual(p1.intent, 'LOAN', 'N: parsed LOAN');

  const p2 = gnaniVoice.parseHinglishTranscript('Aman ko pandrah sau diye');
  assert.strictEqual(p2.counterparty, 'Aman', 'N: parsed Aman');
  assert.strictEqual(p2.amount, 1500, 'N: parsed 1500');

  const p3 = gnaniVoice.parseHinglishTranscript('Priya se 500 wapas mile');
  assert.strictEqual(p3.counterparty, 'Priya', 'N: parsed Priya');
  assert.strictEqual(p3.amount, 500, 'N: parsed 500');
  assert.strictEqual(p3.intent, 'REPAYMENT', 'N: parsed REPAYMENT');

  const p4 = gnaniVoice.parseHinglishTranscript('₹1000 dinner ka tha, mera share 500');
  assert.strictEqual(p4.amount, 1000, 'N: parsed 1000');
  assert.strictEqual(p4.user_share, 500, 'N: parsed user_share 500');
  console.log('  [PASS] Scenario N passed\n');
  passed++;

  // ---------------------------------------------------------------------------
  // SCENARIO O: Gnani unavailable (Never fabricate Rahul transaction)
  // ---------------------------------------------------------------------------
  console.log('Test O: Gnani unavailable');
  const sttRes = await gnaniVoice.transcribeAudio(null);
  assert.strictEqual(sttRes.status, 'UNAVAILABLE', 'O: status must be UNAVAILABLE');
  assert.strictEqual(sttRes.transcript, null, 'O: transcript must be null (NEVER hardcoded Rahul!)');
  assert.strictEqual(sttRes.confidence, 0, 'O: confidence must be 0');

  const ttsRes = await gnaniVoice.synthesizeSpeech('Test speech response');
  assert.strictEqual(ttsRes.status, 'MOCK_SYNTHESIS', 'O: TTS status must be MOCK_SYNTHESIS');
  assert.strictEqual(ttsRes.audio_url, null, 'O: audio_url must be null (no fake endpoint)');
  console.log('  [PASS] Scenario O passed\n');
  passed++;

  // ---------------------------------------------------------------------------
  // SCENARIO P: Dashboard production state safety
  // ---------------------------------------------------------------------------
  console.log('Test P: Dashboard production state safety');
  const htmlContent = fs.readFileSync(path.join(__dirname, '../public/index.html'), 'utf8');
  assert.ok(!htmlContent.includes('await triggerBenchmark();'), 'P: DOMContentLoaded must NOT auto-run triggerBenchmark()');
  assert.ok(!htmlContent.includes('₹82,049'), 'P: hardcoded outflow ₹82,049 removed');
  assert.ok(!htmlContent.includes('₹32,749'), 'P: hardcoded consumption ₹32,749 removed');
  assert.ok(!htmlContent.includes('₹49,300'), 'P: hardcoded passed through ₹49,300 removed');
  console.log('  [PASS] Scenario P passed\n');
  passed++;

  console.log('=============================================================================');
  console.log(` ALL 16 HARDENING REGRESSION SCENARIOS PASSED: ${passed}/${total} (100%)`);
  console.log('=============================================================================\n');
  return { passed, total };
}

if (require.main === module) {
  runHardeningTests().catch(err => {
    console.error('Hardening test error:', err);
    process.exit(1);
  });
}

module.exports = { runHardeningTests };
