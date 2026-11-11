---
name: ax-test-evidence
description: Derive expected outcomes from acceptance criteria, identify executed revisions, record observed results, and detect false positives when designing or independently reviewing AX product tests.
---

# AX test evidence

Document type · Repository testing skill\
Status · Active\
Updated · 2026-11-11\
Related requirements and documents · [PRD](../../../docs/prd/product.md), [API contract](../../../docs/api/contract.md), [development workflow](../../../.agent/workflows/development.md), [result example](../../../docs/test/000_example.md)

1. Derive expected outcomes from the PRD and public API first. Link each required criterion to an executable check and choose applicable normal, failure, boundary, and regression cases.
2. Use the smallest check that exercises real public behavior. Record the command or UI steps, data setup, environment and versions, exit code and observations, and location of logs or screenshots. Follow the [shared standards](../../../.agent/standards.md) to identify the base commit and the product and test revisions actually executed.
3. For a bug fix, where practical, check that the same procedure fails because of the defect on an isolated pre-fix version and passes after the fix. Exclude failures unrelated to the defect, such as setup errors. When running the earlier version is impractical, record a controlled incorrect input or an alternate check and its limitations. Never deliberately break product code in the shared worktree.
4. In independent review, check skips, broken test discovery, excessive mocks, empty assertions, and expectations copied from observed values. Ask whether the test would accept an outcome that violates the expected behavior. Do not weaken expectations or delete tests to hide a failure.
5. Use the columns below. For unexecuted checks, record the reason and affected criteria. Link the earlier result from a new file for a rerun or correction. Do not edit, overwrite, rename, or delete existing files in `docs/test/`.

| Requirement ID | Command or UI steps | Preconditions and environment | Expected result | Actual result | Verdict | Evidence |
| --- | --- | --- | --- | --- | --- | --- |
