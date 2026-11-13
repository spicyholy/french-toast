# French Toast GitHub distribution

Document type · Implementation brief\
Status · Ready for review\
Updated · 2026-11-13\
Related requirements and documents · [FT-DIST-001](../prd/product.md#ft-dist-001--install-and-run-french-toast), [AX workflow](../../.agent/workflows/development.md), [Claude Code marketplace](https://code.claude.com/docs/en/plugin-marketplaces), [Codex plugin packaging](https://developers.openai.com/plugins/build/plugins)

## Scope and design

Base commit `d0b9bb351a395680c9894527e12035146e707e9d` on `develop`, with the same tree as the initially reviewed `38d2a1501b4170cf2f7c76d728686931b7473d1c`. The existing root instructions, AX standards, project skills and subagent definitions are the behavior inputs.

Use two host-native marketplace catalogs, `.claude-plugin/marketplace.json` and `.agents/plugins/marketplace.json`, pointing to the same `plugins/french-toast/` package. Give the package a Claude manifest and a portable `plugin.json` for Codex. Its `skills/french-toast/SKILL.md` and a bundled workflow reference are the only skill content. Keep the package self-contained so it works from the installed copy and in an unrelated working directory. Maintain the repository's existing AX entry points and files.

The skill uses the conversation's scoped task or asks for missing scope before modifying files or delegating. The main session acts as architect. Give each built-in subagent an explicit AX role and pass the role instructions, relevant criteria, revision, evidence and write scope in its handoff. Codex plugins distribute skills, and project custom agents belong to the project loading them. Delegating with built-in agents keeps the published workflow usable across both clients without copying configuration into the target repository or depending on this repository's custom agents. The workflow reference must preserve independent stages, write boundaries, the verdict and retry transitions, reproducible verification, and honest completion statuses. Follow the target repository's instructions and existing document and test conventions. Put the prompt guidance in the portable skill and its reference, with no install scripts, hooks, credentials or automatic repository setup.

The user interacts with existing CLI or desktop skill UI. In Claude Code, show the short alias and the qualified form for collisions or older clients. In Codex, document the installed `$french-toast:french-toast` mention and the appropriate skill picker. Document the default GitHub branch as the install source. No new custom screen is needed.

Keep development materials on `develop`. Publish a fast-forward commit on `main` containing only `README.md`, `.claude-plugin/marketplace.json`, `.agents/plugins/marketplace.json`, and `plugins/french-toast/` from the approved development revision. Verify the exact tree and target paths. Tag that distribution commit with `v1.0.0` and publish a GitHub Release from the tag. Preserve Git history. The release layout controls the current `main` tree, and repository branches and history continue to use GitHub's repository visibility.

## Implementation and verification

- Coder scope is the two catalogs, `plugins/french-toast/`, and `README.md`. Make the install and example commands copyable in a shell or chat as appropriate. The architect owns this brief and the PRD.
- Verify both clients install the same package from a clean temporary Git marketplace or the published source, then start each client in an unrelated fixture repository and check skill registration and references from the installed copy. Check that host-native invocation expands the correct skill when a local model stub or authenticated model can be used. Record what the test actually exercised.
- Verify a blank invocation's guidance and the required AX steps, handoffs and statuses against the source workflow. Exercise a real model end to end if available, and state which behavior was observed or inspected.
- Check the README commands against the tested configuration, confirm no setup overwrote user files and no repository-native AX files were displaced, and record product and test revisions before execution. Add a fresh evidence record under `docs/test/`.
- Before publishing, verify the distribution tree against the same package file hashes. Once published, check the GitHub branch and tag targets and repeat installation against the public default-branch URL using fresh temporary profiles.
