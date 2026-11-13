# French Toast · AX Architecture

## 실모델 테스트 보고서 · Codex 01

**결과 · 로컬 앱 PASS, Chrome 77/77.** GitHub `main`의 French Toast `v1.0.0`을 새 Codex 프로필에 설치해 `GPT‑6.1 Sol` (`gpt-6.1-sol`, `medium`)로 실행했다. 기준 커밋은 `25c30fbb743aedcad0bd5b29e76d99838fc4dcd7`이고 결과 브랜치는 `test/codex_01`이다. 실행일은 2026-11-13 KST다.

```text
$french-toast:french-toast 일정 관리하는 웹앱 만들어줘.
```

모델이 개인용과 팀 공유 중 범위를 물었다. 재개 요청에 따라 같은 세션에서 개인용을 선택하고, 로그인 없이 브라우저에 저장하는 방향으로 진행하라고 답했다. 결과물 **온유 일정**은 월간 달력, 일정 추가·수정·삭제, 검색·분류 필터, 브라우저 저장 및 오류 복구를 제공한다.

### 관찰한 AX 실행

| 단계 | 관찰 결과 |
| --- | --- |
| 화면 설계 | 독립 디자이너가 달력, 일정 목록, 편집 창, 모바일 화면 및 저장 오류 상태를 설계했다. |
| 기술 설계 검토 | 첫 검토는 `REVISION_REQUIRED`였다. 기존 저장 데이터를 읽지 못했을 때 덮어쓸 수 있다는 지적을 반영하고 재검토에서 승인받았다. |
| 구현과 코드 검토 | 별도 구현자가 C1을 작성했다. 세션은 기존 설계 리뷰어에게 코드 검토를 맡겼다. 이 리뷰어는 구현자와 별개였으며, 새 코드 리뷰 세션의 독립성은 이번 실행에서 검증하지 않았다. |
| 테스트와 독립 검토 | 첫 검사 73개는 통과했다. 독립 리뷰어가 달력 날짜를 직접 선택하는 검사가 빠졌다고 `TEST_DEFECT`를 판정했다. 테스터가 검사 4개를 추가했고, 최종 77개가 통과해 독립 리뷰어가 C1/T2를 승인했다. |

첫 두 시도는 각각 읽기 전용 권한과 Windows 실행 환경 오류로 중단됐다. 작업 공간 쓰기를 허용하는 Windows MXC 샌드박스에서 원본 요청을 다시 실행했다. 세 번째 시도 중 사용량 제한이 발생했고, 같은 세션에 위 범위 답변을 보내 재개한 뒤 완료했다. 실모델 앱 실행이 완료됐으며, 같은 코드와 테스트를 별도 복사본에서 다시 실행해 77개 통과를 재현했다. 온라인 호스팅은 실행 환경의 Git 접속 오류로 완료되지 않았다.

### 실행과 증거

Chrome에서 `schedule-app/dist/index.html`을 열거나 [앱 실행 안내](schedule-app/README.md)의 로컬 서버 명령을 사용한다. 테스트는 Windows에서 Node `22.19.0`과 Chrome `156.0.8078.81`로 재현할 수 있다.

```sh
node schedule-app/tests/verify.cjs
```

[설계와 리뷰 기록](schedule-app/docs/reviews.md) · [최종 테스트 증거](schedule-app/docs/test-evidence-C1-T2.md) · [77개 검사 결과](schedule-app/tests/results-C1-T2.json) · [데스크톱 화면](schedule-app/tests/T2/desktop-demo.png) · [모바일 화면](schedule-app/tests/T2/mobile-demo.png)

---

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

In a new Codex session, type `$` and select `french-toast:french-toast` to attach the skill, then enter your task. You can also find the skill through `/skills` in the CLI or the `/` menu in the desktop app. Run `codex plugin list` in your shell to confirm the plugin is installed.

Example

```text
$french-toast:french-toast Fix duplicate bookmarks. Saving the same document twice should leave one bookmark.
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
