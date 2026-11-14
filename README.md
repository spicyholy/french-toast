# French Toast · AX Architecture

## 실모델 테스트 보고서 · Claude 01

**결과 · PASS, 독립 테스트 리뷰 승인, Chrome 238/238 (file:// 및 HTTP) · 단위 36/36 · 회귀 4/4.** 로컬에 설치된 French Toast `v1.0.0` 플러그인을 Claude Code에서 `Claude Opus 5.5` (`claude-opus-5-5`)로 실행했다. 기준 커밋은 `0a432183dc5c6c866dedccf1ddd53e499b5c49b1`이고 결과 브랜치는 `test/claude_01`이다. 실행일은 2026-11-14다.

```text
/french-toast:french-toast test/claude_01 브랜치에서 일정관리 웹앱 만들어줘. 이건 내가 만든 에이전트 워크플로우가 제대로 돌아가는지 확인하기 위한 테스트야. test/codex_01과 같은 양식의 보고서를 README.md에 작성해.
```

먼저 인자 없이 스킬을 호출했을 때 모델은 편집이나 위임 없이 변경 내용과 관찰 가능한 결과를 물었다. 위 요청을 받은 뒤에는 범위를 다시 묻지 않고 아키텍트가 개인용, 로그인 없음, 브라우저 `localStorage` 저장으로 정했다. Codex 01과 비교하기 위한 선택이며 [PRD](schedule-app/docs/prd/product.md)에 기록했다. 결과물 **일정 관리**는 월간 달력, 일정 추가·수정·삭제, 검색·분류 필터, 키보드 조작과 반응형 화면, 저장 데이터 손상·쓰기 실패·다른 탭 변경에 대한 복구를 제공한다. 빌드 없이 `file://`로 열린다.

### 관찰한 AX 실행

| 단계 | 관찰 결과 |
| --- | --- |
| 화면 설계 | 독립 디자이너가 ASCII 와이어프레임, 상태 S1–S19, 정확한 한국어 문구, 색 대비, 키보드·ARIA 규칙을 작성했다. Figma는 사용하지 않았다. |
| 기술 설계 검토 | 첫 검토는 `REVISION_REQUIRED`였다. 쓰기 실패 상태 번호 오류, 두 탭에서 저장 시 데이터 덮어쓰기, `localStorage` 접근 자체가 예외를 던질 때의 공백, 추적되지 않은 파일을 놓치는 회귀 검사를 지적했다. 쓰기 전 재읽기, 초기화 가드, 상태 S20–S22를 추가했다. 재검토도 `REVISION_REQUIRED`였다. CRLF 때문에 README 회귀 검사가 변경 없는 파일에서도 실패한다는 점을 재현했고, 다른 곳에서 삭제된 일정을 수정하면 입력이 버려진다고 지적했다. 두 가지를 고친 뒤 세 번째 검토에서 승인받았다. |
| 구현과 코드 검토 | 구현자 한 명이 C1을 작성했다. 설계 리뷰어와 별개인 새 코드 리뷰어가 `IMPLEMENTATION_ISSUE`를 판정했다. `Date.UTC`가 0–99년을 1900년대로 바꾸기 때문에 연도에 `26`을 입력하면 1926년 달력이 그려지고 일정이 사라졌다. 같은 구현자가 C2에서 고쳤고 같은 리뷰어가 재승인했다. |
| 테스트와 독립 검토 | T1은 456개 검사를 모두 통과했다. 독립 리뷰어가 변이 실행으로 `PRODUCT_FAILURE`와 `TEST_DEFECT`를 판정했다. 모바일 대화상자가 Chrome 기본 `max-width` 때문에 설계보다 좁은데 테스터가 기대값을 제품에 맞춰 완화했고, S22b 문구 검사는 항상 통과했으며, 손상 데이터 동일 바이트 재기록을 잡지 못했다. 구현자가 C3에서 CSS 한 줄을 고치고 코드 리뷰 재승인을 받았다. 테스터가 검사를 설계 기준으로 되돌린 T2는 516개를 통과했다. 리뷰어가 변이 4종이 실패하는 것을 직접 확인하고 C3/T2를 승인했다. |

재시도는 기본 한도 6회 중 4회를 사용했다. 실행 도중 사용자가 디자인 결과물을 웹에서 볼 수 있는지 물었다. 메인 세션은 설계 문서가 명세이고 `schedule-app/index.html`을 브라우저에서 직접 연다고 답했다. 사용자 승인 전 커밋하지 않았으며 온라인 호스팅은 시도하지 않았다. README 보고서를 Codex 01과 같이 제목 바로 아래에 넣었기 때문에, 기존 README가 끝부분에 그대로 남는지만 보는 회귀 검사 R3는 형식상 실패한다. 아키텍트가 삽입 블록을 제거하면 기준 커밋의 README와 바이트 단위로 같다는 것을 대신 확인했다.

### 실행과 증거

Chrome에서 `schedule-app/index.html`을 직접 열거나 [앱 실행 안내](schedule-app/README.md)를 따른다. 테스트는 Windows에서 Node `22.19.0`과 Chrome `156.0.8078.81`로 재현할 수 있다.

```sh
node --test schedule-app/tests/unit/
node schedule-app/tests/e2e/run.js --mode=file --out=<출력 폴더>
```

[PRD](schedule-app/docs/prd/product.md) · [화면 설계](schedule-app/docs/design/001_schedule_app.md) · [구현 브리프](schedule-app/docs/implementation/001_schedule_app.md) · [T1 증거](schedule-app/docs/test/001_schedule_app_verification.md) · [최종 T2 증거](schedule-app/docs/test/002_schedule_app_verification_rerun.md) · [238개 검사 결과](schedule-app/tests/T2/e2e-results-file.json) · [데스크톱 화면](schedule-app/tests/T2/screenshots-file/S2-populated-1280.png) · [모바일 화면](schedule-app/tests/T2/screenshots-file/S2-populated-375.png)

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
