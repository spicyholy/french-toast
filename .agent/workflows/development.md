# AX development workflow

Document type · Stages and transitions\
Status · Active\
Updated · 2026-11-11\
Related requirements and documents · [PRD](../../docs/prd/product.md), [role definition](../roles/architect.md), [shared standards](../standards.md), [control flow diagram](../../docs/assets/ax-workflow.png)

## Start and handoff

1. For a new project, the `architect` drafts the product requirements. For an existing project, inspect the PRD, API, ADRs, and code for entry points, dependencies, user flows, and data impact. For a bug fix, reproduce the issue through a normal entry point before making changes where practical and record the command and observation.
2. Invoke `designer` when creating or changing screens or interactions. The `architect` uses the design result in the technical design and implementation brief. Include the rationale and verification criteria for small changes with no UI impact.
3. Assign `architecture_reviewer` to independently review the design and implementation brief. Then follow the transitions below.

For a new thread, provide the task ID, user intent and scope, relevant requirement IDs and sources, assigned files, [revision information](../standards.md#revision-identification-and-review-evidence), and findings and evidence needed for the decision. When continuing an existing thread, send the latest revision, what changed, and the findings it needs to address. Give independent reviewers enough material to reach their own conclusions.

The `architect` updates the design, one `coder` owns product code, `tester` writes test code and execution records, and `designer` owns screen design artifacts. Keep the `coder` thread available through review and testing. Return implementation fixes to that thread when it is available and its context still applies. Wait for one writer's result before assigning edits to the same files.

Reviewers work in separate threads from the author and treat the repository as read-only. Report findings using the [review evidence rules](../standards.md#revision-identification-and-review-evidence). Record reproducible evidence for a rebuttal and ask the reviewer to check it. Reuse the reviewer thread to confirm a targeted fix. Start a fresh review thread if changed assumptions or a prior disagreement call for an independent reassessment. Close threads once their results are recorded and their involvement is complete.

## Verdicts and transitions

| Decision point | Condition | Next stage |
| --- | --- | --- |
| `architecture_reviewer` | `APPROVED` · design approved | `coder` → `code_reviewer` |
| `architecture_reviewer` | `REVISION_REQUIRED` · design needs revision | The `architect` revises or records a rebuttal. Route through `designer` if the UI needs changes, then return to `architecture_reviewer`. |
| `code_reviewer` | `APPROVED` · code approved | `tester` → `test_reviewer` |
| `code_reviewer` | `DESIGN_ISSUE` · design or requirements issue | The `architect` reconsiders the design. Route through `designer` if the UI is affected, then resume at `architecture_reviewer`. |
| `code_reviewer` | `IMPLEMENTATION_ISSUE` · implementation or rules issue | `coder` makes the fix and `code_reviewer` reviews it again. |
| `test_reviewer` | `TEST_DEFECT` · test design, code, or evidence defect | The `architect` reconsiders the test method and criteria. Resume at `tester` if earlier approvals still cover the current inputs. If an approval is stale, return to the earliest affected stage. |
| `test_reviewer` | `PRODUCT_FAILURE` · reproducible product defect | The `architect` identifies the cause. For a design issue, involve `designer` if the fix changes screens or interactions. The `architecture_reviewer` reviews the revised design. For an implementation issue, resume at `coder`. |
| `test_reviewer` | `UNVERIFIABLE` · required verification cannot run | The `architect` tries an alternative environment or route. Resume at `tester` if possible. Report `BLOCKED` if required verification cannot be completed. |
| `test_reviewer` | `APPROVED` · evidence shows that required acceptance and regression checks passed on the current revision | The `architect` compares the reviewed revision, current revision, and documents. Report `PASS` when they match. |

Before dispatching a stage and during the final comparison, confirm that prior approvals cover the current inputs. If they differ, return to the earliest affected stage.

- When requirements, API, or design change, the `architect` revises the design and implementation brief. Involve `designer` before `architecture_reviewer` if screens or interactions need to change. For changes with no UI impact, send the revised design directly for review.
- For product code changes, resume at `coder` and then `code_reviewer`. If only test code changed, resume at `tester` and then `test_reviewer`.

Handle a design issue first when design and implementation issues occur together. The `architect` checks that code review and testing covered the same product files and that test review approved results for the same product and test revision.

## Retries and completion

- The `architect` counts one retry each time work returns to a previous stage. This includes rebuttals, reruns in another environment, and returns due to a revision mismatch. Count the return once, then continue through the normal downstream stages. Check the limit before dispatching a retry. Allow six total retries by default, or use the user's limit. Stop when two consecutive corrections for the same issue leave the evidence and outcome unchanged, or when practical resolution paths are exhausted.
- Use `PASS` when required checks passed with evidence and `test_reviewer` approved the current revision. Use `UNRESOLVED` for a confirmed defect or review disagreement that remains open. Use `BLOCKED` for a missing environment, permission, or required tool. At the retry limit, choose the status based on the remaining cause.
- If a subagent tool or named role cannot load at any stage, check for an alternative in the app or CLI and continue any preparation that can proceed. Report `BLOCKED` if a required role or independent review is unavailable and the stage cannot proceed.
- If the user needs to install something or sign in, provide its name, the official link, the reason, the verification affected, and how to resume. Continue independent work. If work is interrupted, record the latest brief, relevant evidence, next stage, and total retry count in a handoff note. Use that note and the current revision to resume.
