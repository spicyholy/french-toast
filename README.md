# French Toast · AX Architecture

French Toast is an installable development workflow for Claude Code and Codex. Give it a feature or bug fix to take through design, implementation, independent review, and verification.

## Install and use

Install once from the GitHub marketplace with a recent version of your client. Then start a new session in the repository you want to change.

### Claude Code

Run these commands in your shell.

```sh
claude plugin marketplace add spicyholy/french-toast
claude plugin install french-toast@french-toast
```

In a new Claude Code session, use `/french-toast` followed by your task. If the short name is unavailable or already taken, use `/french-toast:french-toast`. Run `claude plugin list` in your shell to confirm the plugin is installed.

Example

```text
/french-toast Fix duplicate bookmarks. Saving the same document twice should leave one bookmark.
```

### Codex

Run these commands in your shell.

```sh
codex plugin marketplace add spicyholy/french-toast
codex plugin add french-toast@french-toast
```

In a new Codex session, type `$` and select `french-toast` to attach the skill, then enter your task. You can also use `/skills` in the CLI or select the skill from the `/` menu in the desktop app. Run `codex plugin list` in your shell to confirm the plugin is installed.

Example

```text
$french-toast Fix duplicate bookmarks. Saving the same document twice should leave one bookmark.
```

French Toast uses built-in subagents in the target project. The project keeps its own instructions and tooling, and each client applies its usual permissions.

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

The main session plans and coordinates the work. It delegates design when the change affects an interaction, then runs independent design review, implementation, code review, testing, and independent test review. See the [bundled workflow](plugins/french-toast/skills/french-toast/references/workflow.md) for handoffs and retry rules.

## Practices adapted from pstack

- Trace the existing execution path and public contract from the caller's perspective before designing or implementing a change. [how](https://github.com/cursor/plugins/blob/main/pstack/skills/how/SKILL.md), [architect](https://github.com/cursor/plugins/blob/main/pstack/skills/architect/SKILL.md)
- Compare the change with user intent and support review findings with evidence and reproduction conditions. For a bug fix, use the same regression check to show the old failure and the new success when practical. [interrogate](https://github.com/cursor/plugins/blob/main/pstack/skills/interrogate/SKILL.md), [tdd](https://github.com/cursor/plugins/blob/main/pstack/skills/tdd/SKILL.md)
- Describe state transitions and recovery in terms of user actions. Record decisions and where to find their evidence. [statechart](https://github.com/cursor/plugins/blob/main/pstack/skills/statechart/SKILL.md), [show-me-your-work](https://github.com/cursor/plugins/blob/main/pstack/skills/show-me-your-work/SKILL.md)

## References

- [Claude Code plugin installation](https://code.claude.com/docs/en/discover-plugins)
- [Claude Code skill invocation](https://code.claude.com/docs/en/skills#how-a-skill-gets-its-command-name)
- [Codex plugin installation](https://learn.chatgpt.com/docs/cli/reference#codex-plugin)
- [Codex skill invocation](https://learn.chatgpt.com/docs/build-skills#how-chatgpt-and-codex-use-skills)
