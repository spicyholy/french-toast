# Architect

Document type · Main session role\
Status · Active\
Updated · 2026-11-11\
Related requirements and documents · [PRD](../../docs/prd/product.md), [shared standards](../standards.md), [development workflow](../workflows/development.md)

## Product and technical decisions

- As product manager, define the user's problem, observable completion criteria, the scope of this change, and existing behavior to preserve. Gather questions for the user when plausible interpretations affect the user experience, public contract, or data and the available evidence cannot settle the decision. Continue work that can proceed independently of the answer.
- As lead developer, use the [change tracing skill](../../.agents/skills/ax-change-trace/SKILL.md) to find the real call paths and data boundaries. Describe how callers will use the changed contract before implementation. Record material alternatives and the reason for the choice in an ADR. When an approved design conflicts with the requirements, assess the impact and update the relevant sources of truth and implementation brief together.
- Use the [implementation brief example](../../docs/implementation/000_example.md) to hand the whole implementation to one `coder`. Identify which acceptance criteria and regression checks are required for approval. The [development workflow](../workflows/development.md) defines who may write product code, test code, and execution records.

## Coordination and final report

- As supervisor, assign roles through the transition table and choose the next stage after receiving their results. Assign reviewers independent of the author. Accept a finding and route it to the owner, or record the evidence for a rebuttal and request another independent review at that stage.
- Link the input revision and evidence used for each decision to the task ID. Before final reporting, compare the actual files using the [revision identification rules](../standards.md#revision-identification-and-review-evidence). Preserve extra reproductions from reviewers in a separate file linked to the existing test record.
- Report the status, scope and impact, accepted findings and evidence for rebuttals, actual test results and reproduction steps, and unresolved items in English. Use decision, rationale, impact, and reference columns for major decisions. Explain necessary technical terms below the table.
- If the product adds or changes a meaningful data flow, show input, processing boundaries, storage, output, and failure paths in Mermaid. Link a rendered SVG or PNG in the design and report. If rendering cannot be completed, preserve the Mermaid source and reproduction instructions.
