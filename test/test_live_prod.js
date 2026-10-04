const https = require('https');

function callMcp(tool, args) {
  return new Promise((resolve, reject) => {
    const payload = JSON.stringify({
      jsonrpc: '2.0',
      id: 'prod-test-' + Date.now(),
      method: 'tools/call',
      params: { name: tool, arguments: args }
    });

    const req = https.request('https://gullak-gray.vercel.app/mcp', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(payload)
      }
    }, res => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          const toolRes = JSON.parse(json.result.content[0].text);
          resolve(toolRes);
        } catch (e) {
          reject(new Error(data));
        }
      });
    });
    req.on('error', reject);
    req.write(payload);
    req.end();
  });
}

async function testProd() {
  console.log('Testing live production at https://gullak-gray.vercel.app/mcp...\n');

  // Case 1: Unknown purpose
  console.log('--- Live Production Case 1: Purpose Unknown ---');
  const res1 = await callMcp('reconcile_transaction', {
    amount: 500,
    direction: 'DEBIT',
    counterparty: 'Rahul Sharma',
    user_clarification: "I sent ₹500 to Rahul Sharma via UPI, but I don't remember what it was for. Determine whether you can classify it confidently; if not, ask me for clarification and do not assign it to my spending budget."
  });
  console.log('Classification:', res1.classification);
  console.log('Confidence:', res1.confidence);
  console.log('Requires Clarification:', res1.requires_clarification);
  console.log('Budget Impact:', res1.budget_impact);
  console.log('Question:', res1.question);
  console.log('Reasoning:', res1.reasoning);

  // Case 2: Memory with rent repayment
  console.log('\n--- Live Production Case 2: Memory explicitly says rent repayment ---');
  await callMcp('record_counterparty_memory', {
    counterparty: 'Rahul Sharma',
    classification: 'RENT_REPAYMENT',
    typical_intent: 'RENT_REPAYMENT',
    notes: 'monthly rent repayment',
    confidence: 0.95
  });
  const res2 = await callMcp('reconcile_transaction', {
    amount: 500,
    direction: 'DEBIT',
    counterparty: 'Rahul Sharma'
  });
  console.log('Classification:', res2.classification);
  console.log('Confidence:', res2.confidence);
  console.log('Requires Clarification:', res2.requires_clarification);
  console.log('Budget Impact:', res2.budget_impact);
  console.log('Reasoning:', res2.reasoning);

  // Case 3 and 4: User says dinner payment
  console.log('\n--- Live Production Case 3 and 4: User says dinner payment ---');
  const res34 = await callMcp('reconcile_transaction', {
    amount: 500,
    direction: 'DEBIT',
    counterparty: 'Rahul Sharma',
    user_clarification: 'this was my dinner payment.'
  });
  console.log('Classification:', res34.classification);
  console.log('Confidence:', res34.confidence);
  console.log('Conflict Detected:', res34.conflict_detected);
  console.log('Budget Impact:', res34.budget_impact);
  console.log('Reasoning:', res34.reasoning);
}

testProd().catch(console.error);
