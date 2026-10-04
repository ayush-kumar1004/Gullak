/**
 * AGENTICORG INTEGRATION DIAGNOSTIC
 * 
 * Outputs the 10 diagnostic items required to inspect MCP interoperability with Pine Labs AgenticOrg:
 * 1. tools/list result
 * 2. exact discovered reconcile_transaction schema
 * 3. exact tools/call request
 * 4. exact raw MCP response
 * 5. parsed tool result
 * 6. isError value
 * 7. classification
 * 8. confidence
 * 9. requires_clarification
 * 10. budget_impact
 * 
 * IMPORTANT: Does NOT calculate another confidence score; reports strictly Gullak domain confidence.
 */

const http = require('http');

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
        } catch (err) {
          resolve({ statusCode: res.statusCode, body: null, raw: data, error: err.message });
        }
      });
    });

    req.on('error', reject);
    req.write(payload);
    req.end();
  });
}

async function runDiagnostic() {
  console.log('=============================================================================');
  console.log(' AGENTICORG INTEGRATION DIAGNOSTIC (Pine Labs Interoperability)');
  console.log(` Target Server: http://${HOST}:${PORT}/mcp`);
  console.log('=============================================================================\n');

  // ITEM 1: tools/list result
  const listReq = {
    jsonrpc: '2.0',
    id: 'diag-list-1',
    method: 'tools/list',
    params: {}
  };
  const listRes = await postJsonRpc(listReq);
  const tools = (listRes.body && listRes.body.result && listRes.body.result.tools) || [];

  console.log('-----------------------------------------------------------------------------');
  console.log('1. TOOLS/LIST RESULT:');
  console.log('-----------------------------------------------------------------------------');
  console.log(`Discovered Tools Count: ${tools.length}`);
  tools.forEach((t, i) => console.log(`  [${i + 1}] ${t.name}: ${t.description.substring(0, 90)}...`));

  // ITEM 2: exact discovered reconcile_transaction schema
  const reconcileTool = tools.find(t => t.name === 'reconcile_transaction');
  console.log('\n-----------------------------------------------------------------------------');
  console.log('2. EXACT DISCOVERED reconcile_transaction SCHEMA:');
  console.log('-----------------------------------------------------------------------------');
  console.log(JSON.stringify(reconcileTool ? reconcileTool.inputSchema : 'TOOL_NOT_FOUND', null, 2));

  // Reset state before running tools/call diagnostic
  await postJsonRpc({
    jsonrpc: '2.0',
    id: 'diag-reset',
    method: 'tools/call',
    params: {
      name: 'get_system_health',
      arguments: { reset: true }
    }
  });

  // ITEM 3: exact tools/call request
  const callReq = {
    jsonrpc: '2.0',
    id: 'diag-call-2',
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

  console.log('\n-----------------------------------------------------------------------------');
  console.log('3. EXACT TOOLS/CALL REQUEST:');
  console.log('-----------------------------------------------------------------------------');
  console.log(JSON.stringify(callReq, null, 2));

  // ITEM 4: exact raw MCP response
  const callRes = await postJsonRpc(callReq);
  console.log('\n-----------------------------------------------------------------------------');
  console.log('4. EXACT RAW MCP RESPONSE:');
  console.log('-----------------------------------------------------------------------------');
  console.log(callRes.raw);

  // ITEM 5: parsed tool result
  let parsedToolResult = null;
  if (callRes.body && callRes.body.result && callRes.body.result.content && callRes.body.result.content[0]) {
    try {
      parsedToolResult = JSON.parse(callRes.body.result.content[0].text);
    } catch (e) {
      parsedToolResult = { parseError: e.message };
    }
  }

  console.log('\n-----------------------------------------------------------------------------');
  console.log('5. PARSED TOOL RESULT:');
  console.log('-----------------------------------------------------------------------------');
  console.log(JSON.stringify(parsedToolResult, null, 2));

  // ITEM 6: isError value
  const isError = callRes.body && callRes.body.result ? callRes.body.result.isError : null;
  console.log('\n-----------------------------------------------------------------------------');
  console.log(`6. ISERROR VALUE: ${isError}`);
  console.log('-----------------------------------------------------------------------------');

  // ITEM 7: classification
  const classification = parsedToolResult ? parsedToolResult.classification : null;
  console.log(`7. CLASSIFICATION: ${classification}`);

  // ITEM 8: confidence
  const confidence = parsedToolResult ? parsedToolResult.confidence : null;
  console.log(`8. CONFIDENCE: ${confidence} (Domain Engine Confidence; Floor is ${parsedToolResult ? parsedToolResult.confidence_floor : 0.88})`);

  // ITEM 9: requires_clarification
  const requiresClarification = parsedToolResult ? parsedToolResult.requires_clarification : null;
  console.log(`9. REQUIRES_CLARIFICATION: ${requiresClarification}`);

  // ITEM 10: budget_impact
  const budgetImpact = parsedToolResult ? parsedToolResult.budget_impact : null;
  console.log(`10. BUDGET_IMPACT: ₹${budgetImpact}`);

  console.log('\n=============================================================================');
  console.log(' DIAGNOSTIC SUMMARY:');
  console.log(` - Tool Call Success (isError=false): ${isError === false}`);
  console.log(` - Intent Suspended safely (budget_impact=0): ${budgetImpact === 0}`);
  console.log(` - Low Confidence Ambiguity (0.52 < 0.88): ${confidence === 0.52}`);
  console.log(` - Targeted Clarification Generated: ${Boolean(parsedToolResult && parsedToolResult.question)}`);
  console.log('=============================================================================');
}

runDiagnostic().catch(err => {
  console.error('[DIAGNOSTIC FAILED]:', err);
  process.exit(1);
});
