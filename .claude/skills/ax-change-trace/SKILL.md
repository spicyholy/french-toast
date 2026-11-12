---
name: ax-change-trace
description: Trace from user entry points to module and data boundaries when designing, implementing, or reviewing changed call paths or new public contracts in AX.
---

# AX change tracing

Document type · Repository change analysis skill\
Status · Active\
Updated · 2026-11-11\
Related requirements and documents · [PRD](../../../docs/prd/product.md), [implementation brief example](../../../docs/implementation/000_example.md), [shared standards](../../../.agent/standards.md)

1. For each requirement ID, write one sentence describing the user's action and observable result. Identify contracts that existing callers and data depend on.
2. Follow the real entry point through input validation, module and storage boundaries, output, and failure paths. Record file paths and symbols, and distinguish facts from design assumptions. For a new feature, describe the expected entry point and show how a caller would use it. Start with the entry points and callers affected by the change. Expand the trace when a shared boundary or fallback could change another path's behavior.
3. Check the effect on existing callers, older data, public errors, and retries. For material decisions, compare caller usage, constraints, compatibility, and verification cost across alternatives.
4. During review, identify a condition that could violate the contract independently of the author's explanation. Record what you observe when reproducible. For static evidence, explain which calls and state lead to the conclusion.
