# Example · Document bookmark verification record

Document type · Test evidence template\
Status · Example / Unexecuted\
Updated · 2026-11-11\
Related requirements and documents · EX-BMK-001 AC1–AC3, [PRD](../prd/product.md), [API contract](../api/contract.md), [implementation brief](../implementation/000_example.md), [test evidence skill](../../.agents/skills/ax-test-evidence/SKILL.md)

Task ID · EX-BMK\
Base commit and verified scope · Record the SHA, diff identifier, and any untracked files covered by the run.\
Previous result · Link the earlier record when rerunning or correcting a result.

| Requirement ID | Command or UI steps | Preconditions and environment | Expected result | Actual result | Verdict | Evidence |
| --- | --- | --- | --- | --- | --- | --- |
| EX-BMK-001 AC1 | Open the detail page → select Bookmark → reopen the page | Test account, accessible document with no bookmark | “Saved” appears after saving and after reopening | Unexecuted | Unverified | Example before implementation |
| EX-BMK-001 AC2 | Send two concurrent PUTs for the same account and document → GET → count records in the test database | Empty test database and valid session | Both PUTs return 200, GET returns `saved: true`, and exactly one record exists | Unexecuted | Unverified | Example before implementation |
| EX-BMK-001 AC3 | Trigger a 503 on one save → select Retry on the detail page | Isolated environment that fails only the first PUT | Error and retry action appear, then “Saved” appears after a successful second PUT | Unexecuted | Unverified | Example before implementation |
| EX-BMK-001 Regression | Open the existing detail page as an unauthorized user → PUT a bookmark for that document | Test account without permission to read the document | Existing detail access remains restricted, PUT returns 404, and no record is created | Unexecuted | Unverified | Example before implementation |
