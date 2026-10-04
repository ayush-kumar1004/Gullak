/**
 * Gullak Autonomous Personal Financial Reconciliation Server
 * Custom capabilities platform for Pine Labs AgenticOrg (Agent Aashi)
 */

const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');

const memoryEngine = require('./src/memory');
const reconciliationEngine = require('./src/reconciliation');
const budgetEngine = require('./src/budget');
const gnaniVoice = require('./src/gnani');
const delhiveryRouter = require('./src/delhivery');
const { setupMcpRoutes, getSystemHealth } = require('./src/mcp_server');
const { benchmarkCases } = require('./src/dataset');
const { runBenchmark } = require('./test/run_20_evals');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors({ origin: '*' }));
app.use(express.json({ limit: '15mb' }));
app.use(express.urlencoded({ extended: true, limit: '15mb' }));
app.use(express.static(path.join(__dirname, 'public')));

// Mount Delhivery logistics mock rail
app.use(delhiveryRouter);

// Mount Model Context Protocol (MCP) server routes for AgenticOrg
setupMcpRoutes(app);

// Health check with accurate integration disclosure
app.get('/api/v1/health', (req, res) => {
  res.json(getSystemHealth(req));
});

// Dynamic OpenAPI Spec: Automatically resolves the public URL of the deployed server!
app.get('/openapi.json', (req, res) => {
  const specPath = path.join(__dirname, 'openapi.json');
  if (fs.existsSync(specPath)) {
    try {
      const rawSpec = fs.readFileSync(specPath, 'utf8');
      const spec = JSON.parse(rawSpec);

      // Determine public deployment URL dynamically
      const protocol = req.headers['x-forwarded-proto'] || req.protocol || 'http';
      const host = req.get('host');
      const publicUrl = process.env.PUBLIC_URL || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : `${protocol}://${host}`);

      spec.servers = [
        {
          url: publicUrl,
          description: publicUrl.includes('localhost') ? 'Local Development Server' : 'Production Deployed Server'
        }
      ];

      res.setHeader('Content-Type', 'application/json');
      return res.json(spec);
    } catch (err) {
      return res.status(500).json({ error: 'Failed to parse OpenAPI specification' });
    }
  }
  return res.status(404).json({ error: 'OpenAPI specification not found' });
});

// Capability 1: Counterparty Memory Routes
app.get('/api/v1/memory/counterparty', (req, res) => {
  const identifier = req.query.identifier || req.query.name || req.query.vpa;
  if (!identifier) {
    return res.status(400).json({ error: 'Missing required query parameter: identifier' });
  }
  const memory = memoryEngine.getCounterparty(identifier);
  if (memory) {
    return res.json({ found: true, counterparty: memory });
  }
  return res.json({ found: false, message: `No memory found for '${identifier}'.` });
});

app.post('/api/v1/memory/counterparty', (req, res) => {
  const { counterparty, vpa, classification, relationship, typical_intent, notes, confidence } = req.body;
  if (!counterparty && !vpa) {
    return res.status(400).json({ error: 'Counterparty name or VPA is required' });
  }
  const record = memoryEngine.recordCounterparty({
    counterparty,
    vpa,
    classification,
    relationship,
    typical_intent,
    notes,
    confidence: confidence || 0.95,
    user_confirmed: true
  });
  return res.json({ status: 'SUCCESS', message: 'Counterparty memory recorded', record });
});

app.get('/api/v1/memory/all', (req, res) => {
  return res.json({
    total_memories: memoryEngine.getAllMemories().length,
    memories: memoryEngine.getAllMemories()
  });
});

// Capability 2: Financial Reconciliation Routes
app.post('/api/v1/reconcile/transaction', (req, res) => {
  const {
    transaction_id,
    amount,
    direction,
    counterparty,
    channel,
    vpa,
    raw_narration,
    user_clarification,
    delhivery_status,
    simulate_timeout,
    simulate_malformed
  } = req.body;

  if (amount === undefined || !direction) {
    return res.status(400).json({ error: 'Missing required fields: amount, direction' });
  }

  const result = reconciliationEngine.reconcile({
    transaction_id,
    amount,
    direction,
    counterparty,
    channel,
    vpa,
    raw_narration,
    user_clarification,
    delhivery_status,
    simulate_timeout,
    simulate_malformed
  });

  return res.json(result);
});

app.get('/api/v1/ledger', (req, res) => {
  res.json({
    summary: reconciliationEngine.getLedgerSummary(),
    entries_count: reconciliationEngine.ledger.length,
    ledger: reconciliationEngine.ledger
  });
});

// Capability 3: Adaptive Budget Routes
app.post('/api/v1/budget/adapt', (req, res) => {
  const { actual_personal_spending, planned_daily_budget, remaining_days, transaction_id, classification, confidence } = req.body;
  const result = budgetEngine.adaptBudget({
    actual_personal_spending,
    planned_daily_budget,
    remaining_days,
    transaction_id,
    classification,
    confidence
  });
  return res.json(result);
});

app.post('/api/v1/budget/tradeoff', (req, res) => {
  const { tradeoff_type, minimum_daily_budget, overspend_amount } = req.body;
  if (!tradeoff_type) {
    return res.status(400).json({ error: "Missing required parameter: 'tradeoff_type'" });
  }
  const result = budgetEngine.authorizeTradeoff({
    tradeoff_type,
    minimum_daily_budget,
    overspend_amount
  });
  return res.json(result);
});

app.get('/api/v1/budget/status', (req, res) => {
  res.json(budgetEngine.getState());
});

// Transaction Feed (20 Predefined Benchmark Transactions)
app.get('/api/v1/feed/transactions', (req, res) => {
  res.json({
    total: benchmarkCases.length,
    transactions: benchmarkCases.map(c => ({
      case_id: c.id,
      name: c.name,
      category: c.category,
      ...c.input,
      user_clarification: c.user_clarification || null,
      voice_transcript: c.voice_transcript || null
    }))
  });
});

// Gnani Voice Routes
app.get('/api/v1/voice/status', (req, res) => {
  return res.json(gnaniVoice.getIntegrationStatus());
});

app.post('/api/v1/voice/stt', async (req, res) => {
  const { audio_base64, mime_type, language, transcript } = req.body;

  // Direct transcript injection for testing or fallback
  if (transcript && typeof transcript === 'string' && transcript.trim()) {
    return res.json({
      status: 'SUCCESS',
      mode: 'TRANSCRIPT_DIRECT',
      transcript: transcript.trim(),
      confidence: 0.95,
      language: language || 'hi-IN'
    });
  }

  if (!audio_base64) {
    // If GNANI_API_KEY is not configured or no audio passed, return clean UNAVAILABLE
    const status = gnaniVoice.getIntegrationStatus();
    if (!status.is_live) {
      return res.json({
        status: 'UNAVAILABLE',
        mode: 'VOICE_SERVICE_UNAVAILABLE',
        error: 'GNANI_API_KEY_NOT_CONFIGURED',
        message: 'Gnani voice STT is currently unavailable (GNANI_API_KEY not configured).',
        transcript: null,
        confidence: 0,
        language: language || 'hi-IN'
      });
    }
    return res.status(400).json({ error: 'Missing required field: audio_base64 or transcript' });
  }

  // Check payload size safety (limit ~12MB)
  if (typeof audio_base64 === 'string' && audio_base64.length > 15 * 1024 * 1024) {
    return res.status(413).json({ error: 'Audio payload exceeds maximum size limit (10MB).' });
  }

  const result = await gnaniVoice.transcribeBase64Audio(
    audio_base64,
    mime_type || 'audio/webm',
    language || 'hi-IN'
  );

  return res.json({
    ...result,
    language: language || 'hi-IN'
  });
});

app.post('/api/v1/voice/parse_hinglish', (req, res) => {
  const { transcript } = req.body;
  if (!transcript) {
    return res.status(400).json({ error: 'Transcript is required' });
  }
  const parsed = gnaniVoice.parseHinglishTranscript(transcript);
  return res.json({ status: 'SUCCESS', parsed });
});

app.post('/api/v1/voice/tts', async (req, res) => {
  const { text, language } = req.body;
  if (!text) {
    return res.status(400).json({ error: 'Text is required' });
  }
  const synthesized = await gnaniVoice.synthesizeSpeech(text, language);
  return res.json({ status: 'SUCCESS', ...synthesized });
});

/**
 * Unified Voice Pipeline:
 * AUDIO / TRANSCRIPT -> STT -> HINGLISH PARSER -> RECONCILIATION ENGINE -> LEDGER/BUDGET -> RESPONSE TEXT -> TTS
 */
app.post('/api/v1/voice/reconcile_voice_pipeline', async (req, res) => {
  const { audio_base64, mime_type, language, transcript: directTranscript } = req.body;

  let transcript = null;
  let sttMeta = { status: 'SKIPPED', confidence: 0 };

  // Step 1: Speech-to-Text (or direct transcript)
  if (directTranscript && typeof directTranscript === 'string' && directTranscript.trim()) {
    transcript = directTranscript.trim();
    sttMeta = { status: 'SUCCESS', mode: 'TRANSCRIPT_PASSED', confidence: 0.95 };
  } else if (audio_base64) {
    const sttRes = await gnaniVoice.transcribeBase64Audio(
      audio_base64,
      mime_type || 'audio/webm',
      language || 'hi-IN'
    );
    sttMeta = sttRes;
    transcript = sttRes.transcript || null;
  }

  // If STT returned UNAVAILABLE or failed
  if (!transcript) {
    return res.json({
      status: sttMeta.status || 'UNAVAILABLE',
      error: sttMeta.error || 'STT_TRANSCRIPTION_UNAVAILABLE',
      message: sttMeta.message || 'Speech-to-text unavailable. Please submit text clarification.',
      transcript: null,
      parsed: { intent: 'UNKNOWN', amount: null, counterparty: null, user_share: null },
      reconciliation: null,
      response_text: 'Aapki aawaz record nahi ho saki ya voice service uplabdh nahi hai. Kripya likh kar batayein.',
      tts: { status: 'UNAVAILABLE', audio_url: null, audio_base64: null }
    });
  }

  // Step 2: Parse Hinglish Transcript
  const parsed = gnaniVoice.parseHinglishTranscript(transcript);

  // Step 3: Call Authoritative Reconciliation Engine
  const txnId = `VOICE_${Date.now()}`;
  const amount = parsed.amount || 0;

  // Determine direction: Repayment to user is CREDIT, unless user says they repaid
  let direction = 'DEBIT';
  if (parsed.intent === 'REPAYMENT') {
    direction = 'CREDIT';
  }

  const reconciliation = reconciliationEngine.reconcile({
    transaction_id: txnId,
    amount: amount || 0,
    direction,
    counterparty: parsed.counterparty || 'Voice Contact',
    user_clarification: transcript,
    channel: 'UPI'
  });

  // Step 4: Adapt Daily Budget if verified consumption
  if (reconciliation.classification === 'CONSUMPTION' && reconciliation.confidence >= 0.88 && reconciliation.consumption > 0) {
    budgetEngine.adaptBudget({
      actual_personal_spending: reconciliation.consumption,
      classification: reconciliation.classification,
      confidence: reconciliation.confidence,
      transaction_id: txnId
    });
  }

  // Step 5: Generate Natural Response Text (Hindi/Hinglish friendly)
  let responseText = '';
  const cpName = parsed.counterparty || reconciliation.counterparty || 'contact';
  const fmtAmt = (amount || 0).toLocaleString('en-IN');

  if (reconciliation.classification === 'LOAN') {
    responseText = `₹${fmtAmt} ko ${cpName} ke loan ke roop mein record kar diya hai. Personal budget par ₹0 impact hai.`;
  } else if (reconciliation.classification === 'REPAYMENT') {
    responseText = `₹${fmtAmt} ${cpName} se loan repayment ke roop mein receive ho gaya hai. Loan balance update ho gaya hai.`;
  } else if (reconciliation.classification === 'CONSUMPTION') {
    responseText = `₹${fmtAmt} ${cpName} ke saath personal spending verify ho gaya hai. Daily budget update ho gaya hai.`;
  } else if (reconciliation.classification === 'SPLIT') {
    const userShareAmt = (reconciliation.consumption || (amount / 2)).toLocaleString('en-IN');
    const splitRecAmt = (reconciliation.shared_amount || (amount / 2)).toLocaleString('en-IN');
    responseText = `₹${fmtAmt} ka split note kar liya hai. Aapka share ₹${userShareAmt} personal consumption hai aur ₹${splitRecAmt} receivable hai.`;
  } else {
    // UNKNOWN / Clarification required
    responseText = `Transaction ko ₹0 budget impact ke saath hold kiya hai. Kripya clarify karein ki yeh kharcha kis cheez ke liye tha.`;
  }

  // Step 6: Text-to-Speech (TTS)
  const ttsResult = await gnaniVoice.synthesizeSpeech(responseText, language || 'hi-IN');

  return res.json({
    status: 'SUCCESS',
    transcript,
    stt_meta: sttMeta,
    parsed,
    reconciliation,
    response_text: responseText,
    tts: ttsResult
  });
});

// Run Local Acceptance Benchmark via API (Isolated from production state)
app.post('/api/v1/benchmark/run', async (req, res) => {
  // Snapshot production state
  const snapshotLedger = [...reconciliationEngine.ledger];
  const snapshotSeen = new Map(reconciliationEngine.seenTransactions);
  const snapshotNextId = reconciliationEngine.nextId;
  const snapshotMemories = new Map(memoryEngine.memory);
  const snapshotUserState = { ...budgetEngine.userState };
  const snapshotTradeoff = budgetEngine.pendingTradeoff ? { ...budgetEngine.pendingTradeoff } : null;

  try {
    const report = await runBenchmark();
    return res.json({
      suite_name: 'Gullak Local Backend Acceptance Benchmark',
      disclaimer: 'This benchmark tests domain logic locally in isolation. Production state is preserved.',
      ...report
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  } finally {
    // Restore production state so benchmark execution NEVER pollutes production ledger, memory, or budget
    reconciliationEngine.ledger = snapshotLedger;
    reconciliationEngine.seenTransactions = snapshotSeen;
    reconciliationEngine.nextId = snapshotNextId;
    memoryEngine.memory = snapshotMemories;
    budgetEngine.userState = snapshotUserState;
    budgetEngine.pendingTradeoff = snapshotTradeoff;
  }
});

// Generic 404 handler for API routes
app.use('/api', (req, res) => {
  res.status(404).json({ error: `Endpoint '${req.originalUrl}' not found on Gullak backend.` });
});

// Global error handler
app.use((err, req, res, next) => {
  console.error('[Server Error]:', err);
  res.status(500).json({ error: 'Internal Server Error', message: err.message });
});

// Start Server locally if executed directly
if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`\n=============================================================================`);
    console.log(` GULLAK RECONCILIATION SERVER RUNNING ON PORT ${PORT}`);
    console.log(` Platform: Pine Labs AgenticOrg (Agent Aashi) | Confidence Floor: 0.88`);
    console.log(` OpenAPI Spec: http://localhost:${PORT}/openapi.json`);
    console.log(` Health Check: http://localhost:${PORT}/api/v1/health`);
    console.log(` MCP SSE Endpoint: http://localhost:${PORT}/sse`);
    console.log(` MCP Streamable/JSON-RPC: http://localhost:${PORT}/mcp`);
    console.log(` Interactive Dashboard: http://localhost:${PORT}`);
    console.log(` Discovered MCP Tools: 7 Tools Active`);
    console.log(`=============================================================================\n`);
  });
}

module.exports = app;
