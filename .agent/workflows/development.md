# AX development workflow

Document type · Stages and transitions\
Status · Active\
Updated · 2026-11-11\
Related requirements and documents · [PRD](../../docs/prd/product.md), [role definition](../roles/architect.md), [shared standards](../standards.md), [control flow diagram](../../docs/assets/ax-workflow.png)

## Start and handoff

1. For a new project, the `architect` drafts the product requirements. For an existing project, inspect the PRD, API, ADRs, and code for entry points, dependencies, user flows, and data impact. For a bug fix, reproduce the issue through a normal entry point before making changes where practical and record the command and observation.
2. Invoke `designer` when creating or changing screens or interactions. The `architect` uses the design result in the technical design and implementation brief. Include the rationale and verification criteria for small changes with no UI impact.
3. Assign `architecture_reviewer` to independently review the design and implementation brief. Then follow the transitions below.

Each invocation includes the task ID, user intent and scope, requirement IDs and source documents, assigned files, [revision information](../standards.md#revision-identification-and-review-evidence), and findings and evidence for the next stage. Give reviewers the necessary materials and ask them to reach their own conclusions. The `architect` updates the design, one `coder` owns product code, and `tester` writes test code and execution records. The `designer` owns screen design artifacts. Wait for one writer's result before assigning edits to the same files.

Reviewers work in separate threads from the author and treat the repository as read-only. Report findings using the [review evidence rules](../standards.md#revision-identification-and-review-evidence). Record reproducible evidence for a rebuttal and ask the reviewer to check it. Use a fresh thread when a re-review needs an independent assessment. Close threads after receiving their results when they are no longer needed.

## Verdicts and transitions

| Decision point | Condition | Next stage |
| --- | --- | --- |
| `architecture_reviewer` | `APPROVED` · design approved | `coder` → `code_reviewer` |
| `architecture_reviewer` | `REVISION_REQUIRED` · design needs revision | The `architect` revises or records a rebuttal. Route through `designer` if the UI needs changes, then return to `architecture_reviewer`. |
| `code_reviewer` | `APPROVED` · code approved | `tester` → `test_reviewer` |
| `code_reviewer` | `DESIGN_ISSUE` · design or requirements issue | The `architect` reconsiders the design. Route through `designer` if the UI is affected, then resume at `architecture_reviewer`. |
| `code_reviewer` | `IMPLEMENTATION_ISSUE` · implementation or rules issue | `coder` makes the fix and `code_reviewer` reviews it again. |
| `test_reviewer` | `TEST_DEFECT` · test design or code defect | The `architect` reconsiders the test method and criteria. Resume at `tester` if requirements, contract, and design stay the same. Resume at design review if any changes. |
| `test_reviewer` | `PRODUCT_FAILURE` · reproducible product defect | The `architect` identifies the cause. Resume at design review for a design issue or at `coder` for an implementation issue. |
| `test_reviewer` | `UNVERIFIABLE` · required verification cannot run | The `architect` tries an alternative environment or route. Resume at `tester` if possible. Report `BLOCKED` if required verification cannot be completed. |
| `test_reviewer` | `APPROVED` · required acceptance and regression checks approved | The `architect` compares the reviewed revision, current revision, and documents. Report `PASS` when they match. |

Handle a design issue first when design and implementation issues occur together. If requirements, API, or design change, resume from design review. For product code changes, resume from implementation and code review. For test changes, resume from testing. Use the earliest affected stage. Refresh each approval when its input files change. The `architect` checks that code review and testing covered the same product files and that test review approved the results for the same product and test revision. Apply the same transitions if the final comparison finds a difference.

## Retries and completion

- The `architect` counts each return to a previous stage after a correction once. Allow six total retries across the transition table by default, or use the user's limit. Stop when two consecutive corrections for the same issue leave the evidence and outcome unchanged, or when practical resolution paths are exhausted.
- Use `PASS` when required verification is complete and `test_reviewer` has approved the current revision. Use `UNRESOLVED` for a confirmed defect or review disagreement that remains open. Use `BLOCKED` for a missing environment, permission, or required tool. At the retry limit, choose the status based on the remaining cause.
- If a subagent tool or named role cannot load, diagnose available options in the app or CLI and continue preparation. Mark the stage `BLOCKED` when a required independent review cannot be performed.
- If the user needs to install something or sign in, provide its name, the official link, the reason, the verification affected, and how to resume. Continue independent work. On resumption, use the latest brief, test records, review findings, and total retry count to identify the resume point.
