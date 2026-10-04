/**
 * ACTUAL MCP PROTOCOL CONTRACT TEST
 * 
 * Verifies that the HTTP MCP endpoint strictly adheres to the Model Context Protocol (MCP)
 * and JSON-RPC 2.0 specification as expected by Pine Labs AgenticOrg.
 * 
 * Exercises actual HTTP POST requests against the MCP server endpoint (/mcp).
 * Tests both canonical tool names and connector-namespaced tool names.
 */

const http = require('http');
const assert = require('assert');

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
          const parsed = JSON.parse(data);
          resolve({ statusCode: res.statusCode, body: parsed, rawText: data });
        } catch (err) {
          resolve({ statusCode: res.statusCode, body: null, rawText: data, parseError: err.message });
        }
      });
    });

    req.on('error', reject);
    req.write(payload);
    req.end();
  });
}

async function runMcpContractTests() {
  console.log('=============================================================================');
  console.log(' ACTUAL MCP PROTOCOL CONTRACT TEST (HTTP /mcp JSON-RPC 2.0)');
  console.log(` Target Server: http://${HOST}:${PORT}/mcp`);
  console.log('=============================================================================\n');

  // --------------------------------------------------------------------------
  // TEST 1: Exact tools/call request for reconcile_transaction
  // --------------------------------------------------------------------------
  console.log('--- TEST 1: MCP tools/call Contract for reconcile_transaction ---');
  const req1 = {
    jsonrpc: '2.0',
    id: 1,
    method: 'tools/call',
    params: {
      name: 'reconcile_transaction',
      arguments: {
        amount: 500,
        direction: 'DEBIT',
        counterparty: 'Rahul Sharma',
        channel: 'UPI'
      }
    }
  };

  const res1 = await postJsonRpc(req1);
  console.log(`HTTP Status: ${res1.statusCode}`);
  console.log(`Raw Response: ${res1.rawText.substring(0, 150)}...`);

  // 1. HTTP success
  assert.strictEqual(res1.statusCode, 200, 'HTTP status must be 200 OK');

  // 2. JSON-RPC success
  assert.strictEqual(res1.body.jsonrpc, '2.0', 'JSON-RPC version must be "2.0"');
  assert.strictEqual(res1.body.id, 1, 'JSON-RPC id must match request id (1)');
  assert.strictEqual(res1.body.error, undefined, 'JSON-RPC error must not be present');
  assert.ok(res1.body.result, 'result object must exist');

  // 3. result.content exists and format
  assert.ok(Array.isArray(res1.body.result.content), 'result.content must be an Array');
  assert.strictEqual(res1.body.result.content.length, 1, 'result.content must have 1 element');
  assert.strictEqual(res1.body.result.content[0].type, 'text', 'result.content[0].type must be "text"');

  // 4. result.content[0].text contains valid JSON
  let innerJson;
  assert.doesNotThrow(() => {
    innerJson = JSON.parse(res1.body.result.content[0].text);
  }, 'result.content[0].text must parse as valid JSON');

  // 5. result.isError === false
  assert.strictEqual(res1.body.result.isError, false, 'result.isError must be false');

  // 6. Parsed JSON fields
  console.log('Parsed Tool Result:');
  console.log({
    classification: innerJson.classification,
    confidence: innerJson.confidence,
    requires_clarification: innerJson.requires_clarification,
    consumption: innerJson.consumption_amount ?? innerJson.consumption,
    budget_impact: innerJson.budget_impact,
    question: innerJson.question
  });

  assert.strictEqual(innerJson.classification, 'UNKNOWN', 'classification must be UNKNOWN');
  assert.ok(innerJson.confidence < 0.88, `confidence (${innerJson.confidence}) must be < 0.88 floor`);
  assert.strictEqual(innerJson.confidence, 0.52, 'ambiguous transaction confidence must be exactly 0.52');
  assert.strictEqual(innerJson.requires_clarification, true, 'requires_clarification must be true');
  assert.strictEqual(innerJson.consumption, 0, 'consumption must be 0');
  assert.strictEqual(innerJson.budget_impact, 0, 'budget_impact must be 0');
  assert.ok(typeof innerJson.question === 'string' && innerJson.question.length > 0, 'clarification question must exist');
  assert.ok(innerJson.question.includes('Rahul Sharma'), 'question must reference Rahul Sharma');

  console.log('[PASS] TEST 1 PASSED: Strict MCP contract validated successfully.\n');

  // --------------------------------------------------------------------------
  // TEST 2: Namespaced tool name resolution
  // --------------------------------------------------------------------------
  console.log('--- TEST 2: Namespaced Tool Name (mcp_gullak_mcp_ayush__reconcile_transaction) ---');
  const req2 = {
    jsonrpc: '2.0',
    id: 2,
    method: 'tools/call',
    params: {
      name: 'mcp_gullak_mcp_ayush__reconcile_transaction',
      arguments: {
        amount: 500,
        direction: 'DEBIT',
        counterparty: 'Rahul Sharma',
        channel: 'UPI'
      }
    }
  };

  const res2 = await postJsonRpc(req2);
  assert.strictEqual(res2.statusCode, 200, 'HTTP status must be 200 OK for namespaced tool');
  assert.strictEqual(res2.body.result.isError, false, 'namespaced tool must not error');

  const innerJson2 = JSON.parse(res2.body.result.content[0].text);
  assert.strictEqual(innerJson2.classification, 'UNKNOWN', 'namespaced tool must yield UNKNOWN');
  assert.strictEqual(innerJson2.requires_clarification, true, 'requires_clarification must be true');
  assert.strictEqual(innerJson2.budget_impact, 0, 'budget_impact must be 0');

  console.log('[PASS] TEST 2 PASSED: Namespaced tool resolved to same underlying logic.\n');

  // --------------------------------------------------------------------------
  // TEST 3 (TASK 10 - CASE 2): Dinner Payment Clarification
  // --------------------------------------------------------------------------
  console.log('--- TEST 3: CASE 2 - Confirmed Dinner Payment (Consumption) ---');
  const reqCase2 = {
    jsonrpc: '2.0',
    id: 3,
    method: 'tools/call',
    params: {
      name: 'reconcile_transaction',
      arguments: {
        amount: 500,
        direction: 'DEBIT',
        counterparty: 'Rahul Sharma',
        channel: 'UPI',
        user_clarification: 'This was my dinner payment.'
      }
    }
  };

  const resCase2 = await postJsonRpc(reqCase2);
  const data2 = JSON.parse(resCase2.body.result.content[0].text);
  console.log('Case 2 Result:', {
    classification: data2.classification,
    confidence: data2.confidence,
    consumption: data2.consumption_amount ?? data2.consumption,
    budget_impact: data2.budget_impact
  });

  assert.strictEqual(data2.classification, 'CONSUMPTION', 'Case 2 classification must be CONSUMPTION');
  assert.ok(data2.confidence >= 0.88, 'Case 2 confidence must be >= 0.88');
  assert.strictEqual(data2.consumption, 500, 'Case 2 consumption must be 500');
  assert.strictEqual(data2.budget_impact, 500, 'Case 2 budget_impact must be 500');
  assert.strictEqual(data2.requires_clarification, false, 'Case 2 requires_clarification must be false');
  console.log('[PASS] CASE 2 PASSED: Verified CONSUMPTION (confidence >= 0.88, impact ₹500).\n');

  // --------------------------------------------------------------------------
  // TEST 4 (TASK 10 - CASE 3): Loan Clarification
  // --------------------------------------------------------------------------
  console.log('--- TEST 4: CASE 3 - Loan Given ---');
  const reqCase3 = {
    jsonrpc: '2.0',
    id: 4,
    method: 'tools/call',
    params: {
      name: 'reconcile_transaction',
      arguments: {
        amount: 500,
        direction: 'DEBIT',
        counterparty: 'Rahul Sharma',
        channel: 'UPI',
        user_clarification: 'It was a loan I gave him.'
      }
    }
  };

  const resCase3 = await postJsonRpc(reqCase3);
  const data3 = JSON.parse(resCase3.body.result.content[0].text);
  console.log('Case 3 Result:', {
    classification: data3.classification,
    confidence: data3.confidence,
    consumption: data3.consumption_amount ?? data3.consumption,
    budget_impact: data3.budget_impact,
    loan_amount: data3.loan_amount
  });

  assert.strictEqual(data3.classification, 'LOAN', 'Case 3 classification must be LOAN');
  assert.ok(data3.confidence >= 0.88, 'Case 3 confidence must be >= 0.88');
  assert.strictEqual(data3.consumption, 0, 'Case 3 consumption must be 0');
  assert.strictEqual(data3.budget_impact, 0, 'Case 3 budget_impact must be 0');
  assert.strictEqual(data3.loan_amount, 500, 'Case 3 loan_amount must be 500');
  console.log('[PASS] CASE 3 PASSED: Verified LOAN (confidence >= 0.88, consumption ₹0, loan ₹500).\n');

  // --------------------------------------------------------------------------
  // TEST 5 (TASK 10 - CASE 4): Stored Memory Override (Rent -> Dinner)
  // --------------------------------------------------------------------------
  console.log('--- TEST 5: CASE 4 - Stored Memory Override (Rent -> Dinner) ---');
  // Step 1: Record counterparty memory via MCP
  const reqMem = {
    jsonrpc: '2.0',
    id: 5,
    method: 'tools/call',
    params: {
      name: 'record_counterparty_memory',
      arguments: {
        counterparty: 'Rahul Sharma',
        classification: 'RENT_REPAYMENT',
        typical_intent: 'RENT_REPAYMENT',
        notes: 'monthly rent repayment',
        confidence: 0.95
      }
    }
  };
  await postJsonRpc(reqMem);

  // Step 2: Reconcile with explicit dinner override
  const reqCase4 = {
    jsonrpc: '2.0',
    id: 6,
    method: 'tools/call',
    params: {
      name: 'reconcile_transaction',
      arguments: {
        amount: 500,
        direction: 'DEBIT',
        counterparty: 'Rahul Sharma',
        channel: 'UPI',
        user_clarification: 'This particular ₹500 payment was for dinner.'
      }
    }
  };

  const resCase4 = await postJsonRpc(reqCase4);
  const data4 = JSON.parse(resCase4.body.result.content[0].text);
  console.log('Case 4 Result:', {
    classification: data4.classification,
    confidence: data4.confidence,
    conflict_detected: data4.conflict_detected,
    user_override: data4.user_override,
    budget_impact: data4.budget_impact
  });

  assert.strictEqual(data4.classification, 'CONSUMPTION', 'Case 4 classification must be CONSUMPTION');
  assert.ok(data4.confidence >= 0.88, 'Case 4 confidence must be >= 0.88');
  assert.strictEqual(data4.conflict_detected, true, 'Case 4 conflict_detected must be true');
  assert.strictEqual(data4.user_override, true, 'Case 4 user_override must be true');
  assert.strictEqual(data4.budget_impact, 500, 'Case 4 budget_impact must be 500');
  console.log('[PASS] CASE 4 PASSED: Verified Override (conflict_detected=true, user_override=true, impact ₹500).\n');

  console.log('=============================================================================');
  console.log(' ALL MCP PROTOCOL CONTRACT TESTS PASSED WITH 100% SUCCESS');
  console.log('=============================================================================');
}

if (require.main === module) {
  runMcpContractTests().catch(err => {
    console.error('[FAIL] MCP Contract Test Failed:', err);
    process.exit(1);
  });
}

module.exports = { runMcpContractTests };
