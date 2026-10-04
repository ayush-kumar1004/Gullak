# Part 2: System Prompt Evolution & Versions

```text
v0 — Initial Baseline
- Simple instruction to track expenses and ask user about transfers.
- Failed on: treated splits as 100% expenses; asked clarification on every single merchant transaction; no savings shield.

v1 — Taxonomy & Mathematical Budget Adaptation
- Introduced explicit 10-category taxonomy (CONSUMPTION, LOAN, SPLIT, REPAYMENT, etc.).
- Added mathematical overspend smoothing across remaining cycle days.
- Failed on: no contradiction detection (blindly assumed all future transfers to Rahul were loans); arbitrary confidence scoring.

v2 — Production Standard with Contradiction Handling & Safety Boundaries
- Added explainable evidence-based confidence scoring.
- Added contradiction detection: if new evidence (e.g. "dinner split") conflicts with stored memory (LOAN), lowers confidence and re-asks.
- Added duplicate transaction detection and unconfirmed user refusal safety handling.
- Enforced strict 88% confidence floor matching Pine Labs AgenticOrg configuration.
- Explicitly locked monthly savings target (₹15,000) as inviolable.

v3 — Authoritative Tool Routing & Negative Constraints
- Established mcp_gullak_mcp_ayush__reconcile_transaction as exclusive primary authority for all transaction reconciliation and budget decisions.
- Enforced strict negative constraint forbidding knowledge_base_search from classifying, categorizing, or determining intent of financial transactions.
- Enforced zero-budget-impact guardrail for all ambiguous/unknown transactions (classification: UNKNOWN, confidence < 0.88, budget_impact: ₹0).
- Explicit multi-step execution protocol: reconcile first -> trigger HITL if confidence < 0.88 -> obtain user clarification -> reconcile with user_clarification -> adapt budget only on verified consumption.

v4 — Multi-turn State Isolation & High-Confidence Routing
- Established strict distinction: "Separate transaction, not a duplicate" resolves ONLY duplicate ambiguity; does NOT provide financial purpose.
- Absolute intent carryover prohibition: A previous loan/dinner classification to the same counterparty MUST NOT carry over to a confirmed separate transaction.
- When duplicate is confirmed without new purpose, status remains UNKNOWN, confidence < 0.88, budget_impact = 0, and agent asks "What was this second ₹[Amount] sent to [Counterparty] for?".
- High-confidence completion flow: when confidence >= 0.88 and requires_clarification is false, agent concludes definitively without triggering false 85% HITL guardrail.
```
