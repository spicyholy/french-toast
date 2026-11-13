# French Toast distribution verification

Document type · Test execution record\
Status · Local checks passed, remote publication checks pending\
Updated · 2026-11-13\
Related requirements and documents · [FT-DIST-001](../prd/product.md#ft-dist-001--install-and-run-french-toast), [implementation brief](../implementation/001_french_toast_distribution.md), [AX test evidence](../../.agents/skills/ax-test-evidence/SKILL.md)

## Revisions and environment

- Base · `d0b9bb351a395680c9894527e12035146e707e9d`.
- Executed product · The seven-file distribution snapshot came from `83d31517bb1d83efc7ebd74d8db7caa8f31a1930`. Commit `613142aa413955c0bc73e02eedb8fba99fbbba4a` kept all six package and catalog files unchanged and corrected the README to the observed Codex name. README and existing-project checks used the corrected revision.
- Test method · Python 3.9 standard-library harnesses supplied inline. The temporary target Git repository contained only `fixture.txt` and Git metadata. Both client profiles were fresh temporary directories. Local Anthropic and Responses endpoints captured requests and returned canned replies.
- Clients · Claude Code `2.1.322`, Codex CLI `0.167.0-alpha.3.2`, Windows. An authenticated Claude session was unavailable.
- Candidate release · The architect built `25c30fbb743aedcad0bd5b29e76d99838fc4dcd7`, tree `139bd3d144cd4429351c9c3e90af7b4b93648ddd`, from the corrected develop commit's seven release files. Remote publication is separate from the local client run.

| File | Working-tree Git blob hash with filters disabled |
| --- | --- |
| `README.md`, corrected | `03f8ec8701c6dd0d17badb14076f1c96914bc763` |
| `.agents/plugins/marketplace.json` | `b3af1539a6182aa37f0af07b4e83342cf71c03a2` |
| `.claude-plugin/marketplace.json` | `ee1a6c5883ed302055dc97e3b63eacda1b4d8e35` |
| `plugins/french-toast/plugin.json` | `c81d11cedc8f870f23c5173e22bc96162ee25875` |
| `plugins/french-toast/.claude-plugin/plugin.json` | `8141e4c9b69b4ae7eccb7a0509af812ffb4bdee6` |
| `plugins/french-toast/skills/french-toast/SKILL.md` | `f08eca838201a57f1d736499a7e1c89d6bba1f72` |
| `plugins/french-toast/skills/french-toast/references/workflow.md` | `857f9096b8a0b430083e87aa55881bb04260e4bf` |
| `docs/prd/product.md` | `be097a1207df9fdf07fbe6f2210da66cf39274da` |
| `docs/implementation/001_french_toast_distribution.md` | `3a957c971e6dc2842acf5d3457d6a20add5c7f82` |

## Results

| Requirement ID | Command or UI steps | Preconditions and environment | Expected result | Actual result | Verdict | Evidence |
| --- | --- | --- | --- | --- | --- | --- |
| FT-DIST-001 AC1 | `claude plugin validate <dist>`, `claude plugin marketplace add <dist> --json`, `claude plugin install french-toast@french-toast --json`, then Claude stream JSON initialization | Local distribution snapshot, fresh profile, unrelated fixture | Validate and install, then discover the skill | Exit 0 for all steps. Installed the expected user-scoped plugin and advertised `french-toast:french-toast`. Validation reported optional metadata warnings. | Passed for local marketplace | `claude_validate.stdout`, `claude_install.stdout`, `claude_init.stdout` |
| FT-DIST-001 AC1 | `codex plugin marketplace add <dist> --json`, `codex plugin add french-toast@french-toast --json`, `codex plugin list --json`, App Server `skills/list` | Local distribution snapshot, fresh profile, unrelated fixture | Install version 1.0.0 and discover its skill and workflow from the installed cache | CLI exits 0 and lists version 1.0.0 enabled. App Server returned enabled skill `french-toast:french-toast`. The installed skill and reference matched the test snapshot byte for byte. | Passed for local marketplace | `codex_install.stdout`, `codex_list.stdout`, `codex_skill.json` |
| FT-DIST-001 AC2 | Send `/french-toast Fix unique test widget` and `/french-toast:french-toast Fix unique test widget` to separate Claude Code print sessions | Installed plugin, no alias collision, local Anthropic endpoint | Both expand the same installed skill and preserve the user task | Both exited 0 and sent identical captured messages containing the full skill, bundled reference link and fixture task. | Passed for client invocation | `claude_short.request.json`, `claude_qualified.request.json` |
| FT-DIST-001 AC2 | App Server `thread/start` then `turn/start` with `$french-toast:french-toast Fix unique test widget` and a `skill` input for the canonical name and installed path | Installed plugin, local Responses endpoint | Explicit attachment injects the full installed skill and preserves the task | Captured `/v1/responses` input contains full skill instructions, workflow link and fixture task. The first README draft used a short name and was corrected to the discovered name. | Passed for client invocation | `codex_skill.json`, `codex_invocation_request.json` |
| FT-DIST-001 AC3 | Invoke `/french-toast` without arguments. Compare installed skill and workflow to the approved AX design and review stages. | No earlier user task, installed plugin, local model fixture | The blank prompt directs clarification before edits or delegation. Scoped prompts define independent reviews, revision and evidence checks, and completion status. | Blank invocation injected the scope instruction and left the fixture unchanged with a canned response. Static inspection confirmed separate review contexts, prerequisite ordering, revision checks, verdict transitions, and completion rules. | Prompt and static checks passed. Live model behavior was unexecuted. | `claude_blank.request.json`, bundled `references/workflow.md` |
| FT-DIST-001 AC4 | Inspect corrected README and run `git diff --exit-code <base> HEAD -- AGENTS.md CLAUDE.md .agent .agents/skills .codex .claude docs/test/000_example.md` | Corrected develop revision | Both clients have install, invoke, and confirmation steps. Existing native AX files and prior evidence are preserved. | README lists both verified invocation routes and plugin confirmation commands. Git comparison exited 0 with no diff. | Passed | README, Git comparison |
| FT-DIST-001 AC1, AC5 | Verify exact default-branch GitHub install and compare remote main, tag and release | Release not yet published during this run | The README install commands work and the tag and GitHub Release identify the distribution-only main commit | Local checks are complete. Architect will verify publication and repeat GitHub installs. | Pending remote publication checks | Candidate commit above |

## Local captures

Capture directory · `%TEMP%/french-toast-acceptance-sid4y4pr`. The first harness attempt stopped because `CODEX_HOME` did not exist. Creating the empty profile directory resolved setup. The rerun initially filtered for the unqualified name. Inspecting the raw list identified the namespace, which the explicit invocation test then exercised.

| Capture | SHA-256 |
| --- | --- |
| `claude_short.request.json` | `0ad0d04d32d91f4f5e1ff2a101dc9b5aa2a451e1af6eed02876d042b8860c427` |
| `claude_qualified.request.json` | `0ad0d04d32d91f4f5e1ff2a101dc9b5aa2a451e1af6eed02876d042b8860c427` |
| `claude_blank.request.json` | `78428b965533e9420147bdad90ceff1762dcc695eff847a1db54f268d7a18d36` |
| `codex_skill.json` | `9b9171009c6bd298dcdccbb17c4e17a765a2738517814b4785c14d1ccf97158d` |
| `codex_invocation_request.json` | `a7bde3d042678a2623af64fd7f12a380f175e32bc0285602863a751cfc6f428d` |
