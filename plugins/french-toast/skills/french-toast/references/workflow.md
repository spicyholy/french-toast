# AX development workflow

Document type · Portable stages, roles, and verification rules\
Status · Active\
Updated · 2026-11-13\
Related requirement · FT-DIST-001 · [French Toast skill](../SKILL.md)

## Start and handoff

1. Inspect the target project's instructions, existing changes, requirements, entry points, and tests. Record a task ID, scoped user intent, observable acceptance criteria, and regressions to check. For a bug, reproduce it through a normal entry point before editing when practical.
2. Trace the changed path from the caller's action through validation, module and data boundaries, observable output, and failure handling. Identify code paths and symbols. Check existing callers, earlier data, public errors, and retry behavior. Describe the planned entry point and caller usage for a new feature.
3. Invoke `designer` for new or changed screens or interactions. Write the technical design and implementation brief with scope, rationale, the expected revision, and verification criteria. Use the project's document locations and conventions when available. For a project without AX documents, carry the brief and evidence in the task and handoffs.
4. Ask `architecture_reviewer` to review the design and brief independently. Use the transitions below to progress through implementation, code review, testing, and test review.

Use the host's built-in delegation mechanism. In Claude Code, use the `Agent` tool with `general-purpose`. In Codex, use a built-in subagent suited to the work, such as `worker` for implementation or `default` for independent review. Give the agent its AX role, the matching instructions below, the task and requirement IDs, acceptance criteria, source locations, assigned file scope, and the current revision. Give independent reviewers the raw design, code, or test inputs needed to reach their own conclusions.

Record the base commit when available and identify the exact input files and their current content hashes, including relevant untracked files. Keep one writer per file at a time. Keep the `coder` available for implementation fixes and reuse an independent reviewer to confirm targeted corrections when the host supports continuing its context. For a follow-up, provide the current revision, what changed, and the relevant findings.

## AX role instructions

| Role | Assignment and result |
| --- | --- |
| `designer` | Inspect affected user flows. Produce the assigned design artifacts with relevant states, triggers, outcomes, recovery, and verifiable accessibility criteria. Return flow and artifact references, verification steps, and open issues. |
| `architecture_reviewer` | Read the requirements, design, brief, and relevant code paths. Keep the repository read-only. Derive caller behavior independently, then check boundaries, compatibility, failure and retry behavior, and feasibility of verification. Return `REVISION_REQUIRED` or `APPROVED`. |
| `coder` | Own the whole approved product change within the assigned scope. Follow normal entry points, preserve required caller behavior, and report scope or contract changes to the architect. Return changed files, revision, observed checks, and open issues. |
| `code_reviewer` | Inspect the actual change, including relevant untracked files, in a context separate from the coder. Keep the repository read-only. Trace public behavior and identify failure, boundary, or regression cases. Return `DESIGN_ISSUE`, `IMPLEMENTATION_ISSUE`, or `APPROVED`. Give design issues precedence when both issue types apply. |
| `tester` | After code approval, derive expectations from the requirements and public contract. Exercise normal, failure, boundary, and regression cases that apply. Change only assigned test files and write a fresh evidence record using the project's conventions. Preserve prior evidence and link it on a rerun. Return the executed product and test revisions, observations, skipped checks, and evidence locations. |
| `test_reviewer` | Review the criteria, test code, results, and executed revision independently. Keep the repository read-only. Check for false positives from skips, excessive mocks, missing assertions, incorrect expectations, or stale builds. Return `TEST_DEFECT` for weak tests or evidence, `PRODUCT_FAILURE` for a reproduced product defect, `UNVERIFIABLE` for a blocked required check, or `APPROVED` when all required checks passed on the current revision. If several causes apply, report them and choose the verdict that returns work to the earliest affected stage. |

Every review finding names the affected behavior or requirement, location, trigger, evidence, impact, and condition for approval. Separate optional suggestions. For each verification check, record the criterion, command or UI steps, environment and test data, expected and actual results, verdict, and evidence location. Confirm that a running app or build matches the intended revision. Distinguish checks that ran from skipped or unreachable checks. For bug fixes, use the same procedure to observe the pre-fix failure and post-fix success when practical. Record the limitations of any alternative.

## Verdicts and transitions

| Stage and verdict | Next action |
| --- | --- |
| Architecture review · `APPROVED` | Assign `coder`, then `code_reviewer`. |
| Architecture review · `REVISION_REQUIRED` | Revise the brief or return a reproducible rebuttal. Involve `designer` when the correction changes the UI or interaction, then return to architecture review. |
| Code review · `APPROVED` | Assign `tester`, then `test_reviewer`. |
| Code review · `DESIGN_ISSUE` | Reconsider scope or design, involve `designer` if needed, then return to architecture review. |
| Code review · `IMPLEMENTATION_ISSUE` | Return to `coder`, then code review. |
| Test review · `TEST_DEFECT` | Correct the verification plan and return to `tester` if earlier approvals still cover the inputs. |
| Test review · `PRODUCT_FAILURE` | Route a design issue back to design and architecture review. Route an implementation issue to `coder` and code review. |
| Test review · `UNVERIFIABLE` | Try a practical alternative environment or test route. Return to `tester` if required verification becomes possible. |
| Test review · `APPROVED` | Compare the current files with the reviewed and executed inputs before reporting `PASS`. |

Whenever a prerequisite approval is stale, resume at the earliest affected stage. Requirement, contract, or design changes return to architecture review, with design work as applicable. Product code changes return to implementation and code review. Test-only changes return to testing and test review.

## Retries and completion

Count one retry each time work returns to an earlier stage. Check the limit before dispatching. Use the user's limit or six retries by default. Stop if two consecutive corrections for the same issue leave the evidence and outcome unchanged, or if practical resolution paths are exhausted.

Report `PASS` when the independent test reviewer approved the required evidence for the current revision. Report `UNRESOLVED` for a confirmed defect or review disagreement that remains open. Report `BLOCKED` if a missing environment, permission, or tool prevents a required stage, including independent review. Check for practical alternatives before declaring a blocker and continue independent preparation where possible.

In the final report, state the status, changed scope and revision, actual results and reproduction steps, evidence locations, and open findings or blockers. Explain what the user needs to provide or run to resume any blocked stage.
