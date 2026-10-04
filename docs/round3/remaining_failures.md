# Part 2: Remaining Failures & Limitations

### 1. Live Banking AA Callback in Sandbox
- **What still fails:** Direct interactive Account Aggregator consent callback (`8126662263@finvu`) can experience sandbox callback timeouts or OTP delivery latency outside our control.
- **Why it happens:** Finvu / Banking AA testbeds depend on live third-party bank simulators and SMS gateways.
- **How we handle it:** In AgenticOrg, `banking_aa_fetch_bank_statement` and `banking_aa_get_transaction_list` can be queried with pre-seeded test session artifacts or direct transaction payload injection.

### 2. Live AgenticOrg Platform Runs (0/20 Samples)
- **What still fails / is pending:** While our local backend acceptance suite passes 20/20 (100%), the Pine Labs AgenticOrg platform counter currently shows **0/20 Shadow Samples**.
- **Why it happens:** The custom connector has not yet been imported into AgenticOrg over a public HTTPS URL.
- **Immediate Fix:** Expose the backend via Vercel or ngrok, import `/openapi.json` into AgenticOrg, and run the 20 benchmark test scenarios through the AgenticOrg test tab.

### 3. Multi-Item Split Nuances
- **What still fails:** Transactions where the user fronted an uneven bill (e.g. *"Rahul had 2 beers, I had pasta, Amit had water"*) requires conversational breakdown rather than a single percentage split.
- **What we would fix next:** Integrate an itemized receipt parser connector into Capability 2.
