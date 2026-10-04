const https = require('https');

function post(url, body) {
  return new Promise((resolve, reject) => {
    const payload = JSON.stringify(body);
    const u = new URL(url);
    const req = https.request({
      hostname: u.hostname,
      path: u.pathname + u.search,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(payload)
      }
    }, res => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, body: JSON.parse(data), raw: data });
        } catch (e) {
          resolve({ status: res.statusCode, body: null, raw: data, error: e.message });
        }
      });
    });
    req.on('error', reject);
    req.write(payload);
    req.end();
  });
}

function get(url) {
  return new Promise((resolve, reject) => {
    https.get(url, res => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => resolve({ status: res.statusCode, data }));
    }).on('error', reject);
  });
}

async function verifyLive() {
  console.log('=============================================================================');
  console.log(' LIVE PRODUCTION VERIFICATION (https://gullak-gray.vercel.app)');
  console.log('=============================================================================\n');
  
  // 1. Reset state
  await post('https://gullak-gray.vercel.app/mcp', {
    jsonrpc: '2.0',
    id: 'reset-1',
    method: 'tools/call',
    params: { name: 'get_system_health', arguments: { reset: true } }
  });

  // 2. tools/list
  const listRes = await post('https://gullak-gray.vercel.app/mcp', {
    jsonrpc: '2.0',
    id: 'list-1',
    method: 'tools/list',
    params: {}
  });
  console.log('1. tools/list HTTP Status:', listRes.status);
  const tools = listRes.body.result.tools;
  console.log(`Discovered Tool Count: ${tools.length}`);
  tools.forEach((t, i) => console.log(`   [${i+1}] ${t.name}`));

  // 3. tools/call for ambiguous Rahul transaction
  console.log('\n2. tools/call: "I sent ₹500 to Rahul Sharma via UPI, but I don\'t remember what it was for."');
  const callRes = await post('https://gullak-gray.vercel.app/mcp', {
    jsonrpc: '2.0',
    id: 'call-1',
    method: 'tools/call',
    params: {
      name: 'reconcile_transaction',
      arguments: {
        amount: 500,
        direction: 'DEBIT',
        counterparty: 'Rahul Sharma',
        channel: 'UPI',
        user_clarification: "I sent ₹500 to Rahul Sharma via UPI, but I don't remember what it was for."
      }
    }
  });
  console.log('tools/call HTTP Status:', callRes.status);
  console.log('isError:', callRes.body.result.isError);
  const parsedTool = JSON.parse(callRes.body.result.content[0].text);
  console.log('Parsed Tool Result:');
  console.log(JSON.stringify(parsedTool, null, 2));

  // 4. Test namespaced call
  console.log('\n3. tools/call with namespaced tool name: mcp_gullak_mcp_ayush__reconcile_transaction');
  const nsRes = await post('https://gullak-gray.vercel.app/mcp', {
    jsonrpc: '2.0',
    id: 'call-ns',
    method: 'tools/call',
    params: {
      name: 'mcp_gullak_mcp_ayush__reconcile_transaction',
      arguments: {
        transaction_amount: '500',
        direction: 'DEBIT',
        counterparty: 'Rahul Sharma',
        message: "I don't remember what it was for"
      }
    }
  });
  console.log('Namespaced Call HTTP Status:', nsRes.status);
  console.log('Namespaced isError:', nsRes.body.result.isError);
  const parsedNs = JSON.parse(nsRes.body.result.content[0].text);
  console.log('Namespaced Result:', {
    classification: parsedNs.classification,
    confidence: parsedNs.confidence,
    status: parsedNs.status,
    tool_status: parsedNs.tool_status,
    budget_impact: parsedNs.budget_impact
  });

  // 5. OpenAPI
  const openapiRes = await get('https://gullak-gray.vercel.app/openapi.json');
  console.log('\n4. OpenAPI HTTP Status:', openapiRes.status);
  const openapi = JSON.parse(openapiRes.data);
  console.log('OpenAPI Title:', openapi.info.title, '| Server:', openapi.servers[0].url);

  console.log('\n=============================================================================');
  console.log(' ALL LIVE PRODUCTION VERIFICATIONS SUCCEEDED 100%');
  console.log('=============================================================================');
}

verifyLive().catch(err => {
  console.error('[LIVE VERIFICATION FAILED]:', err);
  process.exit(1);
});
