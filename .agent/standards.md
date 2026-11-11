# Shared writing and verification standards

Document type · Repository operating standards\
Status · Active\
Updated · 2026-11-11\
Related requirements and documents · [PRD](../docs/prd/product.md), [development workflow](workflows/development.md)

## Work and records

- Before work, inspect the repository root, existing diff, `README.md`, applicable `AGENTS.md` and `AGENTS.override.md`, `.agent/`, `.codex/`, `docs/`, and test paths. Preserve user changes and existing configuration. Use repository-relative paths in handoffs and reports.
- Write user communications and new documents in English. Put the title, document type, status, creation or update date, related requirement IDs, and document links at the top of new Markdown files. Put any header required by a tool first. Mark examples as `Example`.
- Record the problem, rationale, constraints, and impact for material decisions. Update the PRD when requirements or acceptance criteria change. Track implementation and verification status separately. Link to the existing PRD and API sources of truth when they exist.
- Exercise the changed path and affected existing behavior. Explain any checks that could not run. Commit and push when requested by the user.

## Revision identification and review evidence

- Record the base commit SHA and file list used at each stage. Record hashes of the current contents of files that may change. For example, identify a worktree file with `git hash-object --no-filters -- <path>` and mark deleted files as deleted. Include untracked files and binaries when they are part of that stage's input.
- Identify the requirement and design inputs for architecture review, the product changes for code review, and the product and test code actually executed for testing and independent test review. Link to evidence records written after execution by path. Writing a record leaves the revision under test unchanged.
- A finding names the affected requirement or existing behavior, file and location, triggering conditions, observed or reasoned evidence, and the condition for resolution. Findings that affect required acceptance criteria, correctness, contracts, or required verification block the next stage. Record suggestions separately with their rationale.

## Sources of truth and document types

| Path | Contents |
| --- | --- |
| [`docs/prd/`](../docs/prd/product.md) | Product scope, user scenarios, stable requirement IDs, and acceptance criteria |
| [`docs/api/`](../docs/api/contract.md) | Public API input, output, errors, compatibility, and required migrations |
| [`docs/adr/`](../docs/adr/000_example.md) | Context, decision, alternatives, rationale, and impact. When replacing a decision, reference the previous ADR from the next numbered file. |
| [`docs/design/`](../docs/design/000_example.md) | Screen flows, states, interactions, accessibility, design artifacts, and reference links |
| [`docs/implementation/`](../docs/implementation/000_example.md) | Work order, PRD, ADR, API, and design references, acceptance criteria, expected scope, affected call paths, and regression checks. Add a follow-up file that references the previous number if a handed-off brief changes substantially. |
| [`docs/test/`](../docs/test/000_example.md) | Results for each verification run. Put executable tests in existing test paths. If this is the first test, specify a path that follows the stack's conventions in the brief. |

## Numbering and test history

- The `000_example.md` files in `adr`, `design`, `implementation`, and `test` are examples. Add actual records as `<number>_<english_description>.md`, beginning with `001` in each directory. When adopting AX in another repository, retain any numbering conventions and examples already in use and document the convention in the brief.
- Immediately before creation, check the directory and previous records for used numbers. Assign authors sequentially and create files exclusively, for example with Python's `open(path, "x", encoding="utf-8")`. On a collision, check the numbers again and use the next one.
- Existing `docs/test/` files must never be edited, overwritten, renamed, or deleted. Add a file per `tester` run. Reference the earlier result in a rerun or correction. Use the table in the [test evidence skill](../.agents/skills/ax-test-evidence/SKILL.md). Example results are outside the actual verification history.
