/**
 * Master Self-Contained Test Runner for Gullak
 * 
 * Automatically starts a temporary local server if port 3000 is not already running,
 * executes all core test suites deterministically, shuts down the test server,
 * and outputs a final PASS/FAIL summary.
 * 
 * Suites executed:
 * 1. 20 Domain Acceptance Evals (run_20_evals.js)
 * 2. Hardening Scenarios A - P (test_hardening_scenarios.js)
 * 3. MCP Protocol Contract Tests (test_mcp_contract.js)
 * 4. AgenticOrg Robustness Tests (test_agenticorg_robustness.js)
 * 5. Repayment Regression Tests (test_repayment_regression.js)
 * 6. Duplicate Isolation Tests (test_duplicate_isolation.js)
 * 7. Contradiction Override Tests (test_contradiction_override.js)
 */

const http = require('http');
const app = require('../server');

async function isPortResponding(port) {
  return new Promise((resolve) => {
    const req = http.get(`http://localhost:${port}/api/v1/health`, (res) => {
      resolve(res.statusCode === 200);
    });
    req.on('error', () => resolve(false));
    req.setTimeout(500, () => {
      req.destroy();
      resolve(false);
    });
  });
}

async function runAll() {
  console.log('=============================================================================');
  console.log(' GULLAK MASTER SELF-CONTAINED TEST RUNNER');
  console.log('=============================================================================\n');

  let server = null;
  let testPort = 3000;

  // Check if server is already responding on port 3000
  const is3000Running = await isPortResponding(3000);

  if (is3000Running) {
    console.log('Detected active Gullak server on port 3000. Reusing active server.');
    process.env.PORT = '3000';
    testPort = 3000;
  } else {
    // Start temporary local server
    await new Promise((resolve, reject) => {
      server = app.listen(3000, () => {
        testPort = 3000;
        process.env.PORT = '3000';
        console.log(`Started temporary test server on port ${testPort}`);
        resolve();
      });
      server.on('error', (err) => {
        if (err.code === 'EADDRINUSE') {
          // Fallback to random free port
          server = app.listen(0, () => {
            testPort = server.address().port;
            process.env.PORT = String(testPort);
            console.log(`Port 3000 busy. Started temporary test server on free port ${testPort}`);
            resolve();
          });
        } else {
          reject(err);
        }
      });
    });
  }

  const results = [];

  async function executeSuite(name, fn) {
    console.log(`\n>>> RUNNING: ${name} ...`);
    const start = Date.now();
    try {
      await fn();
      const duration = Date.now() - start;
      console.log(`>>> [PASS] ${name} (${duration}ms)`);
      results.push({ name, status: 'PASS', duration });
    } catch (err) {
      const duration = Date.now() - start;
      console.error(`>>> [FAIL] ${name} (${duration}ms):`, err.message);
      results.push({ name, status: 'FAIL', duration, error: err.message });
    }
  }

  try {
    // 1. 20 Domain Acceptance Evals
    await executeSuite('20 Domain Acceptance Evals', async () => {
      const { runBenchmark } = require('./run_20_evals');
      const rep = await runBenchmark();
      if (rep.passedCount !== rep.total) {
        throw new Error(`Only ${rep.passedCount}/${rep.total} passed`);
      }
    });

    // 2. Comprehensive Hardening Scenarios A - P
    await executeSuite('Hardening Scenarios A - P (16 Tests)', async () => {
      const { runHardeningTests } = require('./test_hardening_scenarios');
      const rep = await runHardeningTests();
      if (rep.passed !== rep.total) {
        throw new Error(`Only ${rep.passed}/${rep.total} passed`);
      }
    });

    // 3. MCP Protocol Contract Tests
    await executeSuite('MCP Protocol Contract Tests', async () => {
      const { runMcpContractTests } = require('./test_mcp_contract');
      await runMcpContractTests();
    });

    // 4. AgenticOrg Robustness Tests
    await executeSuite('AgenticOrg Robustness Tests', async () => {
      const { runRobustnessTests } = require('./test_agenticorg_robustness');
      await runRobustnessTests();
    });

    // 5. Repayment Regression Tests
    await executeSuite('Repayment Regression Tests', async () => {
      const { runRepaymentRegressionSuite } = require('./test_repayment_regression');
      await runRepaymentRegressionSuite();
    });

    // 6. Duplicate Isolation Tests
    await executeSuite('Duplicate Isolation Tests', async () => {
      const { runRegressionTest } = require('./test_duplicate_isolation');
      await runRegressionTest();
    });

    // 7. Contradiction Override Tests
    await executeSuite('Contradiction Override Tests', async () => {
      delete require.cache[require.resolve('./test_contradiction_override')];
      require('./test_contradiction_override');
    });

    // 8. Gnani Voice Pipeline Tests
    await executeSuite('Gnani Voice Pipeline Tests', async () => {
      const { runVoicePipelineTests } = require('./test_voice_pipeline');
      const rep = await runVoicePipelineTests();
      if (rep.passed !== rep.total) {
        throw new Error(`Only ${rep.passed}/${rep.total} passed`);
      }
    });

  } finally {
    if (server) {
      console.log(`\nShutting down temporary test server on port ${testPort}...`);
      await new Promise(r => server.close(r));
      console.log('Temporary test server shut down cleanly.');
    }
  }

  // Final Summary Report
  console.log('\n=============================================================================');
  console.log(' MASTER TEST SUITE EXECUTION SUMMARY');
  console.log('=============================================================================');
  let allPassed = true;
  for (const r of results) {
    const icon = r.status === 'PASS' ? '✓ PASS' : '✗ FAIL';
    console.log(` ${icon} | ${r.name.padEnd(45)} | ${r.duration}ms ${r.error ? `(${r.error})` : ''}`);
    if (r.status !== 'PASS') allPassed = false;
  }
  console.log('=============================================================================');
  console.log(` FINAL RESULT: ${allPassed ? 'ALL TEST SUITES PASSED (100%)' : 'SOME TESTS FAILED'}`);
  console.log('=============================================================================\n');

  if (!allPassed) {
    process.exit(1);
  }
}

if (require.main === module) {
  runAll().catch(err => {
    console.error('Fatal test runner error:', err);
    process.exit(1);
  });
}

module.exports = { runAll };
