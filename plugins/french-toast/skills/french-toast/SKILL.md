---
name: french-toast
description: Run the French Toast AX workflow for a scoped feature or bug fix, from technical design through independent code review and verified test evidence. Use when the user asks for French Toast or the AX development workflow.
---

# French Toast

Document type · Portable development workflow skill\
Status · Active\
Updated · 2026-11-13\
Related requirement · FT-DIST-001 · [AX workflow and role instructions](references/workflow.md)

Use the requested change and acceptance criteria from the invocation or the current conversation. If the desired change is unclear, ask for the change and an observable result before making edits or delegating. When the intent is clear, derive missing criteria from the request and repository evidence. Ask about ambiguities that materially change scope, user behavior, contracts, or data.

Act as the `architect` in the main session. Work in the user's target project and follow its instructions, document conventions, and permission boundaries. Read [the AX workflow and role instructions](references/workflow.md) from this skill's installed directory before the first handoff.

Use the host's built-in subagents. Assign one AX role per handoff and include its role instructions from the bundled workflow. Keep reviewers in separate contexts from authors, and wait for the result of each prerequisite stage. Follow the workflow's verdicts and revision checks until you can report `PASS`, `UNRESOLVED`, or `BLOCKED` with evidence.
