# French Toast public release verification

Document type · Test execution record\
Status · Published release verified\
Updated · 2026-11-13\
Related requirements and documents · [FT-DIST-001](../prd/product.md#ft-dist-001--install-and-run-french-toast), [implementation brief](../implementation/001_french_toast_distribution.md), [pre-publication verification](001_french_toast_distribution.md)

## Revisions and environment

- Reviewed development revision · `613142aa413955c0bc73e02eedb8fba99fbbba4a`.
- Published distribution revision · `25c30fbb743aedcad0bd5b29e76d99838fc4dcd7` with tree `139bd3d144cd4429351c9c3e90af7b4b93648ddd`.
- Release tag object · `f66da9bc220247f4752973ec10cbc2b98a8676d6`. The peeled tag and remote `main` both resolve to the published distribution revision.
- Install run · Windows, Claude Code `2.1.322` and Codex CLI `0.167.0-alpha.3.2`, separate temporary Git repository and new per-client profiles, with Git credential helpers disabled and terminal prompts disabled. The architect executed the install and discovery checks. The tester independently checked the release, remote refs, Git tree and blob identities.
- Prior record · `docs/test/001_french_toast_distribution.md`, no-filter blob `273c79ce1b037b817128354c4320b9316cddf045`.

## Results

| Requirement ID | Command or UI steps | Preconditions and environment | Expected result | Actual result | Verdict | Evidence |
| --- | --- | --- | --- | --- | --- | --- |
| FT-DIST-001 AC1, AC4 | `claude plugin marketplace add spicyholy/french-toast`, `claude plugin install french-toast@french-toast`, then fresh Claude initialization | Published default branch, fresh isolated profile, unrelated Git repo | README commands add and install the public plugin. A fresh session discovers the installed command. | Both commands exited 0. Install JSON reported `outcome: ok`, `french-toast@french-toast`, and user scope. Fresh initialization showed the qualified command and short alias. | Passed | Architect install run at `%TEMP%/french-toast-public-post-xkl2wyvl` |
| FT-DIST-001 AC1, AC4 | `codex plugin marketplace add spicyholy/french-toast`, `codex plugin add french-toast@french-toast`, then App Server `skills/list` | Published default branch, fresh isolated profile, unrelated Git repo | README commands install version 1.0.0 and discover the enabled skill from its cache. | Both commands exited 0. The CLI installed `french-toast@french-toast` version 1.0.0. App Server listed enabled `french-toast:french-toast` at the installed cache path. The installed skill blob was `f08eca838201a57f1d736499a7e1c89d6bba1f72` and the bundled workflow reference was present. | Passed | Architect install run at `%TEMP%/french-toast-public-post-xkl2wyvl` |
| FT-DIST-001 AC5 | `git ls-remote origin refs/heads/main refs/heads/develop`, `git ls-tree -r --name-only <main>`, `git diff --exit-code <develop> <main> -- <seven release paths>` | Published branches | Main tree includes only the distribution allowlist, byte-identical to develop's corresponding paths. | Main contains exactly the README, two marketplace catalogs, two plugin manifests, skill, and workflow reference. Path-limited diff exited 0. Remote develop pointed to the reviewed development revision at the time of the check. | Passed | Git tree `139bd3d144cd4429351c9c3e90af7b4b93648ddd`. Skill blob `f08eca838201a57f1d736499a7e1c89d6bba1f72`, workflow blob `857f9096b8a0b430083e87aa55881bb04260e4bf`. |
| FT-DIST-001 AC5 | `git ls-remote origin refs/tags/v1.0.0 'refs/tags/v1.0.0^{}'` and public GitHub Releases API lookup by tag | Annotated tag pushed and release created | Tag resolves to the public main commit and the GitHub Release is published for that tag. | Peeled tag equals `25c30fbb743aedcad0bd5b29e76d99838fc4dcd7`. Public API returned `v1.0.0`, draft false, prerelease false, and publication timestamp `2026-11-13T13:44:27Z`. | Passed | [French Toast v1.0.0](https://github.com/spicyholy/french-toast/releases/tag/v1.0.0) |

The post-publication checks exercised GitHub transport and client discovery. The earlier record covers explicit prompt injection with local simulated endpoints. A live model did not execute a complete AX workflow during either run.

