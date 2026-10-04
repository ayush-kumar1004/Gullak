/**
 * Final Live Acceptance & Voice Test Script
 * 
 * Verifies live production server at https://gullak-gray.vercel.app:
 * 1. Health & Integration Status
 * 2. Voice Status (Live Gnani AI)
 * 3. Devanagari Hindi Voice Clarification ("राहुल को 500 डिनर के लिए दिए थे" -> CONSUMPTION, Budget ₹500)
 * 4. Hinglish Voice Clarification ("Aman ne 500 wapas kar diye" -> REPAYMENT, Budget ₹0)
 * 5. Loan Clarification ("Rahul ko pandrah sau diye the, loan tha" -> LOAN, Budget ₹0)
 * 6. Split Clarification ("1000 dinner split, mera share 500" -> SPLIT, Budget ₹500)
 * 7. Ambiguous Transcript Protection ("Pata nahi kisko bheje the" -> UNKNOWN, Budget ₹0)
 * 8. Missing Amount Handling ("डिनर के लिए था" -> Conversational prompt, Budget ₹0)
 * 9. Production Ledger and Budget State Verification
 */

const BASE_URL = process.env.LIVE_URL || 'https://gullak-gray.vercel.app';

async function testEndpoint(name, url, method = 'GET', body = null) {
  process.stdout.write(`Testing: ${name.padEnd(52)} ... `);
  const start = Date.now();
  try {
    const opts = {
      method,
      headers: { 'Content-Type': 'application/json' }
    };
    if (body) opts.body = JSON.stringify(body);

    const res = await fetch(url, opts);
    const duration = Date.now() - start;
    if (!res.ok) {
      console.log(`❌ FAIL (HTTP ${res.status}, ${duration}ms)`);
      return { success: false, status: res.status, duration };
    }
    const data = await res.json();
    console.log(`✅ PASS (${duration}ms)`);
    return { success: true, data, duration };
  } catch (err) {
    const duration = Date.now() - start;
    console.log(`❌ ERROR (${duration}ms): ${err.message}`);
    return { success: false, error: err.message, duration };
  }
}

async function runFinalLiveTests() {
  console.log('\n=============================================================================');
  console.log(` GULLAK FINAL PRODUCTION VERIFICATION SUITE`);
  console.log(` Target Server: ${BASE_URL}`);
  console.log('=============================================================================\n');

  let passed = 0;
  let total = 0;

  // 1. Health Check
  total++;
  const t1 = await testEndpoint('1. System Health & Platform Configuration', `${BASE_URL}/api/v1/health`);
  if (t1.success && t1.data.status === 'ONLINE' && t1.data.rails) passed++;

  // 2. Voice Status
  total++;
  const t2 = await testEndpoint('2. Voice Status (Gnani Indic Rail)', `${BASE_URL}/api/v1/voice/status`);
  if (t2.success && t2.data.provider === 'Gnani.ai') {
    passed++;
    console.log(`   [Info] Voice Mode: ${t2.data.mode} | Live: ${t2.data.is_live}`);
  }

  // 3. Devanagari Hindi Consumption Voice Test
  total++;
  const t3 = await testEndpoint('3. Devanagari Voice: राहुल को 500 डिनर के लिए दिए', `${BASE_URL}/api/v1/voice/reconcile_voice_pipeline`, 'POST', {
    transcript: 'राहुल को 500 डिनर के लिए दिए थे',
    language: 'hi-IN'
  });
  if (t3.success && t3.data.reconciliation) {
    const rec = t3.data.reconciliation;
    const isOk = rec.classification === 'CONSUMPTION' && rec.budget_impact === 500 && rec.confidence >= 0.88;
    if (isOk) {
      passed++;
      console.log(`   [Result] Classification: ${rec.classification} | Budget Impact: ₹${rec.budget_impact} | Response: "${t3.data.response_text}"`);
    } else {
      console.log(`   [Unexpected] Classification: ${rec.classification} | Budget Impact: ₹${rec.budget_impact}`);
    }
  }

  // 4. Repayment Voice Test
  total++;
  const t4 = await testEndpoint('4. Repayment Voice: Aman ne 500 wapas kar diye', `${BASE_URL}/api/v1/voice/reconcile_voice_pipeline`, 'POST', {
    transcript: 'Aman ne 500 wapas kar diye jo usne mujhse udhaar liye the.',
    language: 'hi-IN'
  });
  if (t4.success && t4.data.reconciliation) {
    const rec = t4.data.reconciliation;
    const isOk = rec.classification === 'REPAYMENT' && rec.budget_impact === 0 && rec.loan_recovered === 500;
    if (isOk) {
      passed++;
      console.log(`   [Result] Classification: ${rec.classification} | Loan Recovered: ₹${rec.loan_recovered} | Budget Impact: ₹${rec.budget_impact}`);
    }
  }

  // 5. Loan Voice Test
  total++;
  const t5 = await testEndpoint('5. Loan Voice: Rahul ko pandrah sau diye the, loan tha', `${BASE_URL}/api/v1/voice/reconcile_voice_pipeline`, 'POST', {
    transcript: 'Rahul ko pandrah sau diye the, loan tha.',
    language: 'hi-IN'
  });
  if (t5.success && t5.data.reconciliation) {
    const rec = t5.data.reconciliation;
    const isOk = rec.classification === 'LOAN' && rec.budget_impact === 0 && rec.loan_amount === 1500;
    if (isOk) {
      passed++;
      console.log(`   [Result] Classification: ${rec.classification} | Loan Amount: ₹${rec.loan_amount} | Budget Impact: ₹${rec.budget_impact}`);
    }
  }

  // 6. Split Voice Test
  total++;
  const t6 = await testEndpoint('6. Split Voice: 1000 dinner split, mera share 500', `${BASE_URL}/api/v1/voice/reconcile_voice_pipeline`, 'POST', {
    transcript: 'Maine 1000 dinner ka diya, mera share 500 tha.',
    language: 'hi-IN'
  });
  if (t6.success && t6.data.reconciliation) {
    const rec = t6.data.reconciliation;
    const isOk = rec.classification === 'SPLIT' && rec.consumption === 500 && rec.budget_impact === 500;
    if (isOk) {
      passed++;
      console.log(`   [Result] Classification: ${rec.classification} | Consumption: ₹${rec.consumption} | Budget: ₹${rec.budget_impact}`);
    }
  }

  // 7. Ambiguous Voice Protection (HITL)
  total++;
  const t7 = await testEndpoint('7. Ambiguous Voice: Pata nahi kisko bheje the (HITL)', `${BASE_URL}/api/v1/voice/reconcile_voice_pipeline`, 'POST', {
    transcript: 'Pata nahi kisko bheje the 800 rupaye.',
    language: 'hi-IN'
  });
  if (t7.success && t7.data.reconciliation) {
    const rec = t7.data.reconciliation;
    const isOk = rec.classification === 'UNKNOWN' && rec.budget_impact === 0 && rec.requires_clarification === true;
    if (isOk) {
      passed++;
      console.log(`   [Result] Classification: ${rec.classification} | Clarification Required: ${rec.requires_clarification} | Budget: ₹${rec.budget_impact}`);
    }
  }

  // 8. Zero Amount / Narration Only Handling
  total++;
  const t8 = await testEndpoint('8. Narration Handling: डिनर के लिए था (₹0 Budget Impact)', `${BASE_URL}/api/v1/voice/reconcile_voice_pipeline`, 'POST', {
    transcript: 'डिनर के लिए था',
    language: 'hi-IN'
  });
  if (t8.success && t8.data.reconciliation) {
    const rec = t8.data.reconciliation;
    const isOk = rec.budget_impact === 0 && rec.classification === 'CONSUMPTION';
    if (isOk) {
      passed++;
      console.log(`   [Result] Handled gracefully: Classification: ${rec.classification} | Budget Impact: ₹${rec.budget_impact} | Response: "${t8.data.response_text}"`);
    }
  }

  // 9. Budget Status
  total++;
  const t9 = await testEndpoint('9. Inviolable Savings Target & Budget Status', `${BASE_URL}/api/v1/budget/status`);
  const savingsGoal = t9.data?.monthly_savings_goal || t9.data?.savings_target;
  const shieldActive = t9.data?.savings_shield_active || t9.data?.savings_goal_protected;
  if (t9.success && savingsGoal === 15000 && shieldActive === true) {
    passed++;
    console.log(`   [Result] Monthly Savings Goal: ₹${savingsGoal.toLocaleString()} (Shield Active: ${shieldActive}) | Daily Budget: ₹${t9.data.current_daily_budget}`);
  }

  console.log('\n=============================================================================');
  console.log(` FINAL VERIFICATION RESULT: ${passed}/${total} TESTS PASSED (${Math.round((passed / total) * 100)}%)`);
  console.log('=============================================================================\n');

  if (passed === total) {
    console.log('🎉 ALL PRODUCTION CHECKS VERIFIED SUCCESSFULLY!');
  } else {
    process.exit(1);
  }
}

if (require.main === module) {
  runFinalLiveTests().catch(err => {
    console.error('Test execution failed:', err);
    process.exit(1);
  });
}

module.exports = { runFinalLiveTests };
