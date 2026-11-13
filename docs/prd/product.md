# Product requirements

Document type · PRD\
Status · Active / Example included\
Updated · 2026-11-13\
Related requirements and documents · EX-BMK-001 (Example), [API contract](../api/contract.md), [implementation brief example](../implementation/000_example.md)

## Current scope

French Toast defines the AX development workflow and distributes it as an installable skill for local Claude Code and Codex sessions.

## FT-DIST-001 · Install and run French Toast

A developer installs French Toast from GitHub, opens a session in a project they want to change, and invokes the AX workflow with their task and acceptance criteria.

| Acceptance criterion | Observable behavior |
| --- | --- |
| AC1 | Both clients can add the GitHub marketplace and install the French Toast plugin. A fresh session in a separate repository discovers the installed skill and its bundled workflow instructions. |
| AC2 | Claude Code supports `/french-toast` where the short name is available and the qualified `/french-toast:french-toast` entry point. Codex supports the installed `$french-toast:french-toast` skill mention or skill-picker selection. |
| AC3 | With a scoped task, the installed skill directs the main session through independent AX design, code and test reviews, uses the current revision and observed evidence for decisions, and reports the final result. With no scoped task, it asks for the missing input before edits or delegation. |
| AC4 | The README shows GitHub installation, invocation, and how to confirm installation in each client. Existing project-local AX entry points remain available on `develop`. |
| AC5 | The current `main` tree contains only the public README, the two marketplace catalogs, and the installable package. Development materials stay on `develop`. The first release and its `v1.0.0` tag point to the verified distribution commit on `main`. |

Related documents · [Implementation brief](../implementation/001_french_toast_distribution.md)

## Example · EX-BMK-001 Save a document bookmark

A signed-in user saves a document as a bookmark from its detail page. Saving the same document again leaves one bookmark and confirms the save. If the request fails, the user can retry on the same page.

| Acceptance criterion | Observable behavior |
| --- | --- |
| AC1 | After saving, the detail page shows “Saved.” Reopening the page restores the saved state. |
| AC2 | Repeated or concurrent saves of the same document by the same user leave exactly one bookmark. |
| AC3 | A failed save shows an error and a retry button. A successful retry shows “Saved.” |

Example implementation and verification status · Pending implementation and execution\
Related documents · [Design](../design/000_example.md), [ADR](../adr/000_example.md), [API](../api/contract.md), [implementation](../implementation/000_example.md), [test](../test/000_example.md)
