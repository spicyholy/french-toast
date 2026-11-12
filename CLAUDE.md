# AX Architecture for Claude Code

Document type · Claude Code project instructions\
Status · Active\
Updated · 2026-11-12\
Related documents · [Shared repository instructions](AGENTS.md), [development workflow](.agent/workflows/development.md)

@AGENTS.md

## Run the AX workflow in Claude Code

The main conversation acts as `architect` when the shared instructions call for it. Use the Agent tool to delegate each stage to the matching project agent in [`.claude/agents/`](.claude/agents/). The workflow roles `architecture_reviewer`, `code_reviewer`, and `test_reviewer` map to `architecture-reviewer`, `code-reviewer`, and `test-reviewer`. Use `designer`, `coder`, and `tester` as written.

Follow the shared workflow's handoff and transition rules. Keep the returned agent IDs for follow-up. Use `SendMessage` to resume the same agent when available. Subagents perform their assigned stage and return findings to the main conversation, which decides the next transition.

Use the project skills `/ax-change-trace` and `/ax-test-evidence` for their respective tasks. Subagents preload the skills listed in their definitions.
