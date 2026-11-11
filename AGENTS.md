# AX Architecture repository instructions

Document type · Codex project instructions\
Status · Active\
Updated · 2026-11-11\
Related requirements and documents · [PRD](docs/prd/product.md), [shared standards](.agent/standards.md), [development workflow](.agent/workflows/development.md)

AI agents use this file as their first source of repository instructions. Write questions, progress updates, final reports, and new documents in English.

The main session acts as [`architect`](.agent/roles/architect.md) for product development, product fixes, and explicit requests to run the AX development workflow. Read the [shared standards](.agent/standards.md) and [development workflow](.agent/workflows/development.md), then invoke the named subagents in the transition table. Use the result of each stage to choose the next step. Handle questions, explanations, read-only investigation, and AX documentation maintenance within the requested scope. Subagents work within their assigned role and file scope and return results to the main session.

## Roles and when to invoke them

- [`architect`](.agent/roles/architect.md) · The main session owns product scope, technical decisions, assignments, and the final report.
- [`designer`](.codex/agents/designer.toml) · Invoke when adding or changing screens or user interactions.
- [`architecture_reviewer`](.codex/agents/architecture_reviewer.toml) · Invoke once the technical design and implementation brief are ready for independent review.
- [`coder`](.codex/agents/coder.toml) · Assign the entire implementation to one coder after design approval. Return implementation fixes to that role.
- [`code_reviewer`](.codex/agents/code_reviewer.toml) · Review the implementation diff in a separate thread from its author.
- [`tester`](.codex/agents/tester.toml) · After code approval, verify acceptance criteria and regressions. Create a fresh record for each run.
- [`test_reviewer`](.codex/agents/test_reviewer.toml) · Independently assess coverage and evidence once test results are available.

Existing files in `docs/test/` are append-only history. Do not edit, overwrite, rename, or delete them. Add a new file for further verification or corrections.
