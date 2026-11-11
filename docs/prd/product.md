# Product requirements

Document type · PRD\
Status · Product scope pending / Example included\
Updated · 2026-11-11\
Related requirements and documents · EX-BMK-001 (Example), [API contract](../api/contract.md), [implementation brief example](../implementation/000_example.md)

## Current scope

This repository currently documents the AX development workflow. Once the product and user scenarios are defined, record the product scope, requirement IDs, acceptance criteria, and actual implementation and verification status here.

## Example · EX-BMK-001 Save a document bookmark

A signed-in user saves a document as a bookmark from its detail page. Saving the same document again leaves one bookmark and confirms the save. If the request fails, the user can retry on the same page.

| Acceptance criterion | Observable behavior |
| --- | --- |
| AC1 | After saving, the detail page shows “Saved.” Reopening the page restores the saved state. |
| AC2 | Repeated or concurrent saves of the same document by the same user leave exactly one bookmark. |
| AC3 | A failed save shows an error and a retry button. A successful retry shows “Saved.” |

Example implementation and verification status · Pending implementation and execution\
Related documents · [Design](../design/000_example.md), [ADR](../adr/000_example.md), [API](../api/contract.md), [implementation](../implementation/000_example.md), [test](../test/000_example.md)
