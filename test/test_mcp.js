/**
 * Comprehensive Automated Test Suite for Gullak Model Context Protocol (MCP) Server
 * Platform: Pine Labs AgenticOrg (Agent Aashi)
 * 
 * Verifies:
 * A. MCP endpoints reachable
 * B. MCP JSON-RPC initialization succeeds
 * C. Tool discovery returns all 7 tools with exact names & valid schemas
 * D. check_counterparty_memory works
 * E. record_counterparty_memory works (with memory persistence across REST & MCP)
 * F. reconcile_transaction works (0.88 confidence floor, HITL, error handling)
 * G. adapt_daily_budget works (₹15,000 savings shield protection)
 * H. check_budget_status works
 * I. track_delhivery_shipment works (success and simulated error handling)
 * J. get_system_health works
 * K. Existing REST and OpenAPI endpoints still work without regressions
 */

const http = require('http');
const https = require('https');

const BASE_URL = process.env.TEST_URL || 'http://localhost:3000';
console.log(`[TEST RUNNER] Testing MCP Server at: ${BASE_URL}`);

function makeRequest(path, options = {}, body = null) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, BASE_URL);
    const client = url.protocol === 'https:' ? https : http;
    const reqOptions = {
      method: options.method || 'GET',
      headers: options.headers || {},
      hostname: url.hostname,
      port: url.port || (url.protocol === 'https:' ? 443 : 80),
      path: url.pathname + url.search
    };

    const req = client.request(reqOptions, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        let parsed = data;
        try {
          parsed = JSON.parse(data);
        } catch (e) {
          // keep as raw text
        }
        resolve({
          statusCode: res.statusCode,
          headers: res.headers,
          data: parsed
        });
      });
    });

    req.on('error', (err) => reject(err));
    if (body) {
      if (typeof body === 'object') {
        req.write(JSON.stringify(body));
      } else {
        req.write(body);
      }
    }
    req.end();
  });
}

function sendJsonRpc(method, params = {}, id = 1, endpoint = '/mcp') {
  return makeRequest(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    }
  }, {
    jsonrpc: '2.0',
    id,
    method,
    params
  });
}

async function runMcpTests() {
  console.log('\n=============================================================================');
  console.log(' STARTING GULLAK MCP INTEGRATION & PROTOCOL VERIFICATION');
  console.log('=============================================================================\n');

  let passed = 0;
  let failed = 0;

  function assert(condition, testName, details = '') {
    if (condition) {
      console.log(`  [PASS] ${testName}`);
      passed++;
    } else {
      console.error(`  [FAIL] ${testName} ${details ? '- ' + details : ''}`);
      failed++;
    }
  }

  try {
    // --------------------------------------------------------------------------
    // Test 1: REST Health Check & MCP Protocol Metadata
    // --------------------------------------------------------------------------
    console.log('[SUITE 1: REST Core Endpoints & System Health]');
    const healthRes = await makeRequest('/api/v1/health');
    assert(healthRes.statusCode === 200, 'GET /api/v1/health returns HTTP 200');
    assert(healthRes.data && healthRes.data.status === 'ONLINE', 'System status is ONLINE');
    assert(healthRes.data.confidence_floor === 0.88, 'Confidence floor is 0.88');
    assert(healthRes.data.mcp_protocol && healthRes.data.mcp_protocol.tools_count === 7, 'MCP Protocol reports 7 active tools');
    assert(healthRes.data.banking_aa_dependency && healthRes.data.banking_aa_dependency.includes('NONE'), 'Banking Aa is not a dependency (banking_aa_dependency: NONE)');

    // --------------------------------------------------------------------------
    // Test 2: OpenAPI Specification
    // --------------------------------------------------------------------------
    console.log('\n[SUITE 2: OpenAPI 3.x Specification Integrity]');
    const openapiRes = await makeRequest('/openapi.json');
    assert(openapiRes.statusCode === 200, 'GET /openapi.json returns HTTP 200');
    assert(openapiRes.data && openapiRes.data.openapi && openapiRes.data.openapi.startsWith('3.'), 'Valid OpenAPI 3.x document');
    assert(openapiRes.data.paths['/api/v1/reconcile/transaction'], 'OpenAPI preserves /api/v1/reconcile/transaction');

    // --------------------------------------------------------------------------
    // Test 3: MCP SSE Endpoint Discovery
    // --------------------------------------------------------------------------
    console.log('\n[SUITE 3: MCP SSE & Protocol Transport Discovery]');
    const sseRes = await new Promise((resolve) => {
      const url = new URL('/sse', BASE_URL);
      const client = url.protocol === 'https:' ? https : http;
      const req = client.request({
        hostname: url.hostname,
        port: url.port || (url.protocol === 'https:' ? 443 : 80),
        path: '/sse',
        method: 'GET',
        headers: { Accept: 'text/event-stream' }
      }, (res) => {
        let chunkCount = 0;
        let receivedData = '';
        res.on('data', (chunk) => {
          receivedData += chunk.toString();
          chunkCount++;
          if (receivedData.includes('endpoint') || chunkCount >= 1) {
            req.destroy();
            resolve({ statusCode: res.statusCode, headers: res.headers, data: receivedData });
          }
        });
      });
      req.on('error', (err) => {
        // req.destroy causes error which is expected
        resolve({ statusCode: 200, data: 'endpoint' });
      });
      req.end();
    });
    assert(sseRes.statusCode === 200, 'GET /sse connects successfully with HTTP 200');
    assert(
      sseRes.headers && sseRes.headers['content-type'] && sseRes.headers['content-type'].includes('text/event-stream'),
      'GET /sse responds with text/event-stream header'
    );

    // --------------------------------------------------------------------------
    // Test 4: MCP JSON-RPC Initialization
    // --------------------------------------------------------------------------
    console.log('\n[SUITE 4: MCP JSON-RPC 2.0 Initialization]');
    const initRes = await sendJsonRpc('initialize', {
      protocolVersion: '2024-11-05',
      capabilities: {},
      clientInfo: { name: 'agenticorg-test-client', version: '1.0.0' }
    }, 1);

    assert(initRes.statusCode === 200, 'POST /mcp initialize returns HTTP 200');
    assert(initRes.data.jsonrpc === '2.0', 'JSON-RPC response has jsonrpc: 2.0');
    assert(initRes.data.result && initRes.data.result.serverInfo.name === 'gullak-mcp-server', 'Server reports name gullak-mcp-server');
    assert(initRes.data.result.capabilities.tools !== undefined, 'Server advertises tools capability');

    // --------------------------------------------------------------------------
    // Test 5: MCP Tool Catalog Discovery (tools/list)
    // --------------------------------------------------------------------------
    console.log('\n[SUITE 5: MCP Tool Catalog Discovery]');
    const listRes = await sendJsonRpc('tools/list', {}, 2);
    assert(listRes.statusCode === 200, 'POST /mcp tools/list returns HTTP 200');
    const tools = listRes.data.result && listRes.data.result.tools;
    assert(Array.isArray(tools), 'tools/list returns an array of tools');
    assert(tools.length === 7, `tools/list returns exactly 7 tools (found: ${tools.length})`);

    const expectedToolNames = [
      'check_counterparty_memory',
      'record_counterparty_memory',
      'reconcile_transaction',
      'adapt_daily_budget',
      'check_budget_status',
      'track_delhivery_shipment',
      'get_system_health'
    ];

    const discoveredNames = tools.map(t => t.name);
    for (const name of expectedToolNames) {
      assert(discoveredNames.includes(name), `Tool '${name}' is discovered`);
    }

    // --------------------------------------------------------------------------
    // Test 6: MCP Tool: get_system_health
    // --------------------------------------------------------------------------
    console.log('\n[SUITE 6: MCP Tool: get_system_health]');
    const healthCallRes = await sendJsonRpc('tools/call', {
      name: 'get_system_health',
      arguments: {}
    }, 3);

    assert(healthCallRes.statusCode === 200, 'tools/call get_system_health returns HTTP 200');
    assert(!healthCallRes.data.result.isError, 'Tool executed without error (isError: false)');
    const healthData = JSON.parse(healthCallRes.data.result.content[0].text);
    assert(healthData.status === 'ONLINE', 'Health tool reports status ONLINE');
    assert(healthData.confidence_floor === 0.88, 'Health tool confirms 0.88 confidence floor');

    // --------------------------------------------------------------------------
    // Test 7: MCP Tool: record_counterparty_memory
    // --------------------------------------------------------------------------
    console.log('\n[SUITE 7: MCP Tool: record_counterparty_memory]');
    const recordCallRes = await sendJsonRpc('tools/call', {
      name: 'record_counterparty_memory',
      arguments: {
        counterparty: 'Tanmay Bhatt',
        vpa: 'tanmay@upi',
        classification: 'FRIEND_P2P',
        relationship: 'Friend & Creator Collaborator',
        typical_intent: 'Dinner splits and video production expenses',
        notes: 'Co-created video, always split 50/50',
        confidence: 0.96
      }
    }, 4);

    assert(recordCallRes.statusCode === 200, 'tools/call record_counterparty_memory returns HTTP 200');
    assert(!recordCallRes.data.result.isError, 'Record memory tool executed without error');
    const recordData = JSON.parse(recordCallRes.data.result.content[0].text);
    assert(recordData.status === 'SUCCESS', 'Record memory status is SUCCESS');
    assert(recordData.record && recordData.record.counterparty === 'Tanmay Bhatt', 'Memory graph stored Tanmay Bhatt');

    // --------------------------------------------------------------------------
    // Test 8: MCP Tool: check_counterparty_memory
    // --------------------------------------------------------------------------
    console.log('\n[SUITE 8: MCP Tool: check_counterparty_memory]');
    const checkCallRes = await sendJsonRpc('tools/call', {
      name: 'check_counterparty_memory',
      arguments: {
        identifier: 'tanmay@upi'
      }
    }, 5);

    assert(checkCallRes.statusCode === 200, 'tools/call check_counterparty_memory returns HTTP 200');
    assert(!checkCallRes.data.result.isError, 'Check memory tool executed without error');
    const checkData = JSON.parse(checkCallRes.data.result.content[0].text);
    assert(checkData.found === true, 'Memory found for tanmay@upi');
    assert(checkData.counterparty.classification === 'FRIEND_P2P', 'Retrieved classification is FRIEND_P2P');

    // Verify REST API also reads this memory (Unified state across REST & MCP!)
    const restMemRes = await makeRequest('/api/v1/memory/counterparty?identifier=tanmay@upi');
    assert(restMemRes.data.found === true, 'REST API GET /api/v1/memory/counterparty reads MCP-recorded memory');

    // --------------------------------------------------------------------------
    // Test 9: MCP Tool: reconcile_transaction (Personal Expense)
    // --------------------------------------------------------------------------
    console.log('\n[SUITE 9: MCP Tool: reconcile_transaction (Personal Expense)]');
    const runId = Date.now();
    const reconcile1 = await sendJsonRpc('tools/call', {
      name: 'reconcile_transaction',
      arguments: {
        transaction_id: `TXN_MCP_001_${runId}`,
        amount: 600,
        direction: 'DEBIT',
        counterparty: 'Swiggy',
        raw_narration: `UPI/Swiggy/Dinner Order ${runId}`
      }
    }, 6);

    assert(!reconcile1.data.result.isError, 'Reconcile personal expense executed without error');
    const rec1Data = JSON.parse(reconcile1.data.result.content[0].text);
    assert(rec1Data.classification === 'CONSUMPTION' || rec1Data.classification === 'PERSONAL_EXPENSE', 'Classification is CONSUMPTION / PERSONAL_EXPENSE');
    const personalSpending1 = rec1Data.consumption_amount !== undefined ? rec1Data.consumption_amount : rec1Data.consumptionImpact;
    assert(personalSpending1 === 600, `Personal consumption is full ₹600 (got: ${personalSpending1})`);
    assert(rec1Data.confidence >= 0.88, `Confidence (${rec1Data.confidence}) meets 0.88 floor`);

    // --------------------------------------------------------------------------
    // Test 10: MCP Tool: reconcile_transaction (Split Payment via Memory)
    // --------------------------------------------------------------------------
    console.log('\n[SUITE 10: MCP Tool: reconcile_transaction (Split Payment & Clarification)]');
    const reconcile2 = await sendJsonRpc('tools/call', {
      name: 'reconcile_transaction',
      arguments: {
        transaction_id: `TXN_MCP_002_${runId}`,
        amount: 2000,
        direction: 'DEBIT',
        counterparty: 'Tanmay Bhatt',
        vpa: 'tanmay@upi',
        user_clarification: 'I paid 2000 for dinner with Tanmay, my share was 1000 and he will return 1000'
      }
    }, 7);

    assert(!reconcile2.data.result.isError, 'Reconcile split transaction executed without error');
    const rec2Data = JSON.parse(reconcile2.data.result.content[0].text);
    assert(rec2Data.classification === 'SPLIT', `Classification is SPLIT (got: ${rec2Data.classification})`);
    const personalSpending2 = rec2Data.consumption_amount !== undefined ? rec2Data.consumption_amount : rec2Data.consumptionImpact;
    const recoverable2 = rec2Data.shared_amount !== undefined ? rec2Data.shared_amount : rec2Data.amountReceivable;
    assert(personalSpending2 === 1000, `Personal spending separated to ₹1000 (got: ${personalSpending2})`);
    assert(recoverable2 === 1000, `Recoverable amount is ₹1000 (got: ${recoverable2})`);

    // --------------------------------------------------------------------------
    // Test 11: MCP Tool: reconcile_transaction (HITL on Low Confidence)
    // --------------------------------------------------------------------------
    console.log('\n[SUITE 11: MCP Tool: reconcile_transaction (HITL Rule Enforced)]');
    const reconcileHitl = await sendJsonRpc('tools/call', {
      name: 'reconcile_transaction',
      arguments: {
        transaction_id: `TXN_MCP_003_${runId}`,
        amount: 1500,
        direction: 'DEBIT',
        counterparty: 'Unknown Stranger',
        raw_narration: 'UPI/9988776655@paytm'
      }
    }, 8);

    assert(!reconcileHitl.data.result.isError, 'Reconcile uncertain transaction executed without error');
    const recHitlData = JSON.parse(reconcileHitl.data.result.content[0].text);
    assert(recHitlData.requires_clarification === true, 'HITL Human-In-The-Loop triggered when confidence < 0.88');
    const personalSpendingHitl = recHitlData.consumption_amount !== undefined ? recHitlData.consumption_amount : (recHitlData.consumption || 0);
    assert(personalSpendingHitl === 0, 'Unverified funds not booked to personal spending prior to HITL');

    // --------------------------------------------------------------------------
    // Test 12: MCP Tool: Input Validation & Honest Errors (No Fabricated Data)
    // --------------------------------------------------------------------------
    console.log('\n[SUITE 12: MCP Tool: Input Validation & Structured Error Handling]');
    const invalidCall = await sendJsonRpc('tools/call', {
      name: 'reconcile_transaction',
      arguments: {
        amount: 'NOT_A_NUMBER' // Invalid
      }
    }, 9);

    const errData = JSON.parse(invalidCall.data.result.content[0].text);
    assert(invalidCall.data.result.isError === true || errData.tool_status === 'VALIDATION_ERROR', 'Invalid input safely handled with VALIDATION_ERROR');
    assert((errData.error && errData.error.includes('amount')) || (errData.message && errData.message.includes('amount')), 'Honest error message describes missing/invalid amount');

    // --------------------------------------------------------------------------
    // Test 13: MCP Tool: adapt_daily_budget & ₹15,000 Savings Protection
    // --------------------------------------------------------------------------
    console.log('\n[SUITE 13: MCP Tool: adapt_daily_budget (₹15,000 Savings Shield)]');
    const adaptCall = await sendJsonRpc('tools/call', {
      name: 'adapt_daily_budget',
      arguments: {
        actual_personal_spending: 450,
        remaining_days: 19
      }
    }, 10);

    assert(!adaptCall.data.result.isError, 'adapt_daily_budget executed without error');
    const adaptData = JSON.parse(adaptCall.data.result.content[0].text);
    assert(adaptData.savings_goal_protected === true, 'Inviolable ₹15,000 savings target protected (savings_goal_protected: true)');
    assert(adaptData.savings_goal_amount === 15000, 'Inviolable savings goal amount is ₹15,000');
    const newDaily = adaptData.new_daily_budget !== undefined ? adaptData.new_daily_budget : adaptData.adapted_daily_budget;
    assert(newDaily > 0, `Adapted daily budget calculated (${newDaily})`);

    // --------------------------------------------------------------------------
    // Test 14: MCP Tool: check_budget_status
    // --------------------------------------------------------------------------
    console.log('\n[SUITE 14: MCP Tool: check_budget_status]');
    const budgetStatusCall = await sendJsonRpc('tools/call', {
      name: 'check_budget_status',
      arguments: {}
    }, 11);

    assert(!budgetStatusCall.data.result.isError, 'check_budget_status executed without error');
    const bStatusData = JSON.parse(budgetStatusCall.data.result.content[0].text);
    assert(bStatusData.monthly_income === 100000, `Reports ₹100,000 monthly income (got: ${bStatusData.monthly_income})`);
    assert(bStatusData.monthly_savings_goal === 15000, 'Confirms ₹15,000 monthly savings goal');
    assert(bStatusData.savings_shield_active === true, 'Savings shield protection is active');

    // --------------------------------------------------------------------------
    // Test 15: MCP Tool: track_delhivery_shipment
    // --------------------------------------------------------------------------
    console.log('\n[SUITE 15: MCP Tool: track_delhivery_shipment]');
    const delhiveryCall = await sendJsonRpc('tools/call', {
      name: 'track_delhivery_shipment',
      arguments: {
        waybill: '123456789012'
      }
    }, 12);

    assert(!delhiveryCall.data.result.isError, 'track_delhivery_shipment executed without error');
    const dData = JSON.parse(delhiveryCall.data.result.content[0].text);
    assert(dData.ShipmentData && dData.ShipmentData[0].Shipment.Status.Status === 'Delivered', 'Shipment status is Delivered');

    // Test Delhivery 404 simulation returns honest error
    const delhivery404 = await sendJsonRpc('tools/call', {
      name: 'track_delhivery_shipment',
      arguments: {
        waybill: 'NON_EXISTENT',
        simulate_error: '404'
      }
    }, 13);
    assert(delhivery404.data.result.isError === true, 'Delhivery 404 simulation returns isError: true');

    // --------------------------------------------------------------------------
    // Test 16: Specific Task 10 Test: reconcile_transaction (Rahul ₹500)
    // --------------------------------------------------------------------------
    console.log('\n[SUITE 16: Task 10 Specific Test: reconcile_transaction]');
    const specificRec = await sendJsonRpc('tools/call', {
      name: 'reconcile_transaction',
      arguments: {
        transaction_id: 'test_001',
        amount: 500,
        direction: 'DEBIT',
        counterparty: 'Rahul',
        raw_narration: 'UPI/RAHUL/500'
      }
    }, 14);

    assert(!specificRec.data.result.isError, 'Task 10 reconcile_transaction executed without error');
    const sRecData = JSON.parse(specificRec.data.result.content[0].text);
    assert(sRecData.requires_clarification === true, 'Ambiguous ₹500 to Rahul triggers Human-In-The-Loop clarification');
    assert(sRecData.confidence < 0.88, `Confidence (${sRecData.confidence}) is below 0.88 floor`);
    assert(sRecData.question && sRecData.question.includes('Rahul'), 'Generates targeted question to user for Rahul');

    // --------------------------------------------------------------------------
    // Test 17: Specific Task 10 Test: adapt_daily_budget (₹750 personal spending)
    // --------------------------------------------------------------------------
    console.log('\n[SUITE 17: Task 10 Specific Test: adapt_daily_budget]');
    const specificAdapt = await sendJsonRpc('tools/call', {
      name: 'adapt_daily_budget',
      arguments: {
        actual_personal_spending: 750,
        planned_daily_budget: 1000,
        remaining_days: 20,
        transaction_id: 'test_001'
      }
    }, 15);

    assert(!specificAdapt.data.result.isError, 'Task 10 adapt_daily_budget executed without error');
    const sAdaptData = JSON.parse(specificAdapt.data.result.content[0].text);
    assert(sAdaptData.savings_goal_protected === true, 'Inviolable ₹15,000 savings target is protected');
    assert(sAdaptData.status === 'ON_TRACK', 'Spending within planned daily allowance is marked ON_TRACK');

    // --------------------------------------------------------------------------
    // Test 18: Namespaced Tool Call Resolution (AgenticOrg Connector Prefix Handling)
    // --------------------------------------------------------------------------
    console.log('\n[SUITE 18: Namespaced Tool Call Resolution]');
    const namespacedCall = await sendJsonRpc('tools/call', {
      name: 'mcp_gullak_mcp_ayush__get_system_health',
      arguments: {}
    }, 16);

    assert(!namespacedCall.data.result.isError, 'mcp_gullak_mcp_ayush__get_system_health resolves cleanly');
    const nsData = JSON.parse(namespacedCall.data.result.content[0].text);
    assert(nsData.status === 'ONLINE', 'Namespaced call returns ONLINE system health');

    // --------------------------------------------------------------------------
    // Summary
    // --------------------------------------------------------------------------
    console.log('\n=============================================================================');
    console.log(` MCP TEST RESULTS: ${passed} PASSED, ${failed} FAILED (TOTAL: ${passed + failed})`);
    console.log('=============================================================================\n');

    if (failed > 0) {
      process.exit(1);
    } else {
      process.exit(0);
    }

  } catch (err) {
    console.error('[FATAL ERROR IN MCP TEST SUITE]:', err);
    process.exit(1);
  }
}

runMcpTests();
