# french-toast · AX Architecture

Document type · Repository guide\
Status · AX operating instructions\
Updated · 2026-11-11\
Related requirements and documents · [Repository instructions](AGENTS.md), [development workflow](.agent/workflows/development.md), [PRD](docs/prd/product.md)

## Why I built it

I'm a computer science student who spends a lot of time racing assignment deadlines. After writing programs for several courses, I realized I had limited time and experience to finish every project to the standard I wanted. I needed a way to hand much of the development work to AI while still seeing where it was going and making the decisions that mattered. That's why I built AX Architecture.

The hardest part was predicting how far a change would spread. I'd fix one feature and find the same logic duplicated elsewhere, code I struggled to read, or an existing feature that now behaved differently. As those changes pile up, each new fix takes longer. I call that cost “AI debt.” I've also seen green tests that never checked the requirement. Repeating the same cautions in every prompt and issuing a new command at every stage gave me more work to manage.

One agent can carry context through a long task, but it may miss a constraint from the start or a small exception along the way. More specialized roles can focus on their stages, with a cost to passing context between them. I'd been thinking about how I would divide work and set up reviews on a small team. I enjoyed designing that organization in software around how AI agents actually work.

## Core principles

1. **Trace each requirement through verification.** The `architect` owns both product scope and technical design. The PRD requirement ID appears in the design, implementation brief, and test evidence so each acceptance criterion can be traced to the implementation and an observed result.
2. **Review design, implementation, and tests independently.** Each review runs in a thread separate from the author's. Tests derive expectations from the acceptance criteria, and the reviewer checks whether incorrect behavior would fail.
3. **Continue through fixes and verification from one request.** The type of issue determines whether work returns to design, implementation, or testing. Approval applies to the revision that was reviewed and tested. The report records blockers and the retry limit.
4. **Keep decision context in the main session.** The `architect` carries decisions and progress forward. One `coder` implements the feature across frontend and backend. Specialists and reviewers get the documents, requirement IDs, and diff they need.

## Workflow

![AX development workflow showing planning, optional UI design, design review, implementation, code review, testing, independent test review, and final reporting.](docs/assets/ax-workflow.png)

The [transition table](.agent/workflows/development.md) specifies agent calls and retry paths. Local Codex runs the workflow using the repository instructions. The diagram expresses the same flow in a LangGraph `StateGraph`.

## Repository layout

| Path | Contents |
| --- | --- |
| [`AGENTS.md`](AGENTS.md) | Root instructions and role entry conditions for local Codex |
| [`.agent/`](.agent/) | Main role, shared standards, transitions, and diagram renderer |
| [`.codex/agents/`](.codex/agents/) | Six subagent TOML files and early role drafts. See `AGENTS.md` for the active roles. |
| [`.agents/skills/`](.agents/skills/) | Skills for tracing execution paths and producing test evidence |
| [`docs/`](docs/) | PRD, API contract, ADRs, designs, implementation briefs, test records, and the diagram. The examples share requirement EX-BMK-001. |

## Run with local Codex

Open the repository root in the Codex app or start the CLI there. In a session where you trust the repository, use a request such as this.

> Run the AX development workflow. [Feature to change and acceptance criteria]. Invoke the configured subagents and continue through verification and the final report.

## Regenerate the diagram

Use Python 3.11 or later and Mermaid CLI. Prepare a Python virtual environment and Mermaid CLI for rendering. Mermaid CLI needs Chrome or Chromium. If it does not have a browser installed, use `--puppeteer-config <file>` with a JSON file that sets `executablePath`.

```powershell
$axTools = Join-Path $env:TEMP 'french-toast-ax'
python -m venv (Join-Path $axTools 'venv')
$axPython = Join-Path $axTools 'venv/Scripts/python.exe'
& $axPython -m pip install langgraph==1.2.20
npm install --prefix $axTools @mermaid-js/mermaid-cli@11.12.0
$axMermaid = Join-Path $axTools 'node_modules/.bin/mmdc.cmd'
& $axPython .agent/tools/render_workflow.py --mermaid-cli $axMermaid
```

The script updates the [PNG](docs/assets/ax-workflow.png) embedded in this README. Add `--output ax-workflow.mmd` for Mermaid source or `--output ax-workflow.svg` for an SVG.

## Practices adapted from pstack

- Trace the existing execution path and public contract from the caller's perspective before designing or implementing a change. [how](https://github.com/cursor/plugins/blob/main/pstack/skills/how/SKILL.md), [architect](https://github.com/cursor/plugins/blob/main/pstack/skills/architect/SKILL.md)
- Compare the change with user intent and support review findings with evidence and reproduction conditions. For a bug fix, use the same regression check to show the old failure and the new success when practical. [interrogate](https://github.com/cursor/plugins/blob/main/pstack/skills/interrogate/SKILL.md), [tdd](https://github.com/cursor/plugins/blob/main/pstack/skills/tdd/SKILL.md)
- Describe state transitions and recovery in terms of user actions. Record decisions and where to find their evidence. [statechart](https://github.com/cursor/plugins/blob/main/pstack/skills/statechart/SKILL.md), [show-me-your-work](https://github.com/cursor/plugins/blob/main/pstack/skills/show-me-your-work/SKILL.md)

## References

- [Codex project instructions](https://developers.openai.com/codex/guides/agents-md)
- [Codex subagents](https://developers.openai.com/codex/subagents)
- [Codex skills](https://developers.openai.com/codex/skills)
- [LangGraph Graph API](https://docs.langchain.com/oss/python/langgraph/graph-api)
