# french-toast · AX Architecture

Document type · Repository guide\
Status · AX operating instructions\
Updated · 2026-11-11\
Related requirements and documents · [Repository instructions](AGENTS.md), [development workflow](.agent/workflows/development.md), [PRD](docs/prd/product.md)

## Why I built it

Using coding agents day after day gave me a feel for what AI could do and where it struggled. A short prompt could get me past a problem I'd been stuck on. On similar tasks, the quality of the result could vary with the model and the context I gave it. In long conversations, I'd sometimes have to restate a requirement we'd already agreed on or remind the agent about an edge case. A fast first answer could still lead to more tokens, more waiting, and more time spent reviewing and reworking the code. Those experiences led me to build French Toast, my own coding agent workflow.

When I make French toast, I soak the bread in a mixture of eggs and milk long enough for it to reach the center. Pull it out too soon and only the surface gets wet. Leave it in too long and the bread can tear or turn soggy. Cooking has its own timing. Too little time leaves the center undercooked, while too much can burn the bread or dry it out. I decide when to lift it out and how long to cook it based on the bread and how much it has absorbed.

Working with coding agents involves a similar judgment about when to stay in the same session and when to hand work off. Staying with one agent lets it build on earlier decisions and what it learned about the code. As the session grows, it takes more time and tokens to work through that context, and a missed constraint can mean doing work twice. That's the **cost of staying in the same session**. Switching agents gives a specialist or independent reviewer a fresh look at the work. The handoff takes time to explain requirements and decisions, and the next agent has to read enough of the code to get oriented. Details can get lost along the way. That's the **cost of switching agents**.

The question I wanted French Toast to answer was when a handoff is worth that cost. I measure efficiency by **the total cost of getting to a verified change**, including token use, waiting, handoffs, and rework.

## Core principles

1. **Keep context where it pays off and hand work off where a fresh perspective matters.** The `architect` carries decisions and progress forward, and one `coder` implements the feature across frontend and backend. UI design and independent review get their own assignments when the workflow calls for them. Each handoff includes the documents, requirement IDs, and changes the next agent needs.
2. **Trace each requirement through verification.** The `architect` owns both product scope and technical design. The PRD requirement ID appears in the design, implementation brief, and test evidence so each acceptance criterion can be traced to the implementation and an observed result.
3. **Review design, implementation, and tests independently.** Each review runs in a thread separate from the author's. Tests derive expectations from the acceptance criteria, and the reviewer checks whether incorrect behavior would fail.
4. **Continue through fixes and verification from one request.** The type of issue determines whether work returns to design, implementation, or testing. Approval applies to the revision that was reviewed and tested. The report records blockers and the retry limit.

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
