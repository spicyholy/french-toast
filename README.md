# french-toast · AX Architecture

문서 유형 · 저장소 안내\
상태 · AX 운영 지침\
갱신일 · 2026-11-11\
관련 요구사항과 문서 · [저장소 지침](AGENTS.md), [개발 워크플로](.agent/workflows/development.md), [PRD](docs/prd/product.md)

## 만들게 된 배경

나는 학교 과제 마감에 허덕이며 컴퓨터공학을 공부하는 평범한 공대생이다. 수업에서 여러 프로그램을 만들다 보니 내 시간과 역량만으로는 모든 과제를 원하는 수준까지 끝내기 어려웠다. 개발의 상당 부분을 AI에게 맡기면서도 작업이 어디로 가는지 이해하고 필요한 결정을 내릴 수 있는 방식이 필요했다. 그래서 AX Architecture를 만들었다.

가장 힘들었던 건 한 번의 수정이 어디까지 번질지 예측하기 어려웠다는 점이다. 기능 하나를 고쳤더니 같은 로직이 다른 곳에 생기거나, 코드가 읽기 어려워지거나, 기존 기능이 영향을 받는 일이 있었다. 이런 변경이 쌓이면 다음 수정에도 더 많은 시간이 든다. 나는 그 비용을 ‘AI 부채’라고 부른다. 테스트가 초록색이어도 정작 요구사항을 확인하지 않은 경우가 있었다. 매번 같은 주의를 프롬프트에 적고 단계마다 다음 명령을 내리다 보니 AI에게 일을 맡길수록 내가 챙길 일도 많아졌다.

한 에이전트에게 긴 작업을 맡기면 맥락은 이어지지만, 작업이 길어질수록 초반의 제약이나 작은 예외를 놓치는 경우가 있었다. 역할을 잘게 나누면 각 단계에 집중할 수 있는 대신 맥락을 넘기는 비용이 커졌다. 작은 팀을 꾸린다면 어떻게 일을 나누고 서로의 결과를 검토하게 할지 고민해 왔다. AI의 특성에 맞춰 그 조직을 소프트웨어 안에서 직접 설계해 볼 수 있다는 점이 즐거웠다.

## 핵심 원리

1. **제품 요구사항에서 검증까지 같은 ID로 추적한다.** `architect`가 제품 범위와 기술 설계를 함께 책임진다. PRD의 요구사항 ID를 설계, 구현 명세, 테스트 증거에 기록해 수용 기준마다 대응하는 구현과 실행 결과를 찾을 수 있게 한다.
2. **설계·구현·테스트를 독립적으로 검토한다.** 단계마다 작성자와 다른 스레드의 리뷰어가 결과를 확인한다. 테스트는 수용 기준에서 기대값을 정하고, 잘못된 동작이 실제로 실패로 잡히는지 검토한다.
3. **한 번의 요청으로 수정과 재검증을 이어간다.** 결함 유형에 따라 설계, 구현, 테스트 단계 중 필요한 곳으로 돌아간다. 테스트한 변경본과 검토한 변경본이 일치해야 승인을 기록한다. 막힌 경로와 재시도 한도도 보고한다.
4. **메인 세션이 맥락을 유지하고 역할을 나눈다.** `architect`가 결정과 진행 상황을 이어가며, `coder` 한 명이 프런트엔드와 백엔드를 포함한 구현 전체를 맡는다. 독립 검토와 전문 작업은 필요한 문서, 요구사항 ID, diff만 전달한다.

## 워크플로

![AX 개발 워크플로. 신규 또는 진행 중 요청이 디자인, 설계 검토, 구현, 코드 검토, 테스트와 독립 테스트 검토를 거쳐 최종 보고로 이어진다.](docs/assets/ax-workflow.png)

단계별 호출과 재시도는 [전환표](.agent/workflows/development.md)를 따른다. 개발 작업은 로컬 Codex와 프로젝트 지침으로 실행한다. 그림은 같은 흐름을 LangGraph `StateGraph`로 표현한 문서 산출물이다.

## 디렉토리

| 경로 | 내용 |
| --- | --- |
| [`AGENTS.md`](AGENTS.md) | 로컬 Codex가 읽는 루트 지침과 역할 호출 조건 |
| [`.agent/`](.agent/) | 메인 역할, 공통 규칙, 전환표와 그림 생성 도구 |
| [`.codex/agents/`](.codex/agents/) | 여섯 서브에이전트 TOML과 기존 역할 초안. 활성 역할의 링크는 `AGENTS.md`에 있다. |
| [`.agents/skills/`](.agents/skills/) | 실제 실행 경로를 추적하는 스킬과 테스트 증거를 만드는 스킬 |
| [`docs/`](docs/) | PRD, API 계약, ADR, 디자인, 구현 명세, 실행 기록과 그림. `Example` 문서는 EX-BMK-001을 사용한 작성 예시다. |

## 로컬 Codex에서 사용

저장소 루트를 Codex 앱에서 열거나 루트에서 Codex CLI를 시작한다. 저장소를 신뢰하는 세션에서 다음처럼 요청한다.

> AX 개발 워크플로를 실행해. [바꿀 기능과 수용 기준]. 정의된 서브에이전트를 호출해서 검증과 최종 보고까지 진행해.

## 그림 재생성

Python 3.11 이상과 Mermaid CLI를 사용한다. Python 가상 환경과 Mermaid CLI를 그림 생성용으로 준비한다. Mermaid CLI는 사용할 Chrome 또는 Chromium이 필요하다. CLI에 브라우저가 설치되어 있지 않으면 `--puppeteer-config <파일>`로 `executablePath`가 담긴 JSON을 전달할 수 있다.

```powershell
$axTools = Join-Path $env:TEMP 'french-toast-ax'
python -m venv (Join-Path $axTools 'venv')
$axPython = Join-Path $axTools 'venv/Scripts/python.exe'
& $axPython -m pip install langgraph==1.2.20
npm install --prefix $axTools @mermaid-js/mermaid-cli@11.12.0
$axMermaid = Join-Path $axTools 'node_modules/.bin/mmdc.cmd'
& $axPython .agent/tools/render_workflow.py --mermaid-cli $axMermaid
```

스크립트는 README에 표시되는 [PNG](docs/assets/ax-workflow.png)를 갱신한다. Mermaid 원본이나 SVG가 필요하면 `--output ax-workflow.mmd` 또는 `--output ax-workflow.svg`를 추가한다.

## pstack에서 참고한 작업 방식

- 설계와 구현에 앞서 호출자 관점에서 기존 실행 경로와 공개 계약을 확인한다. [how](https://github.com/cursor/plugins/blob/main/pstack/skills/how/SKILL.md), [architect](https://github.com/cursor/plugins/blob/main/pstack/skills/architect/SKILL.md)
- 리뷰 지적은 사용자 의도와 실제 변경을 대조하고, 재현 조건과 근거로 판단한다. 결함 수정의 회귀 검증은 가능하면 수정 전 실패와 수정 후 성공을 같은 절차로 확인한다. [interrogate](https://github.com/cursor/plugins/blob/main/pstack/skills/interrogate/SKILL.md), [tdd](https://github.com/cursor/plugins/blob/main/pstack/skills/tdd/SKILL.md)
- 상태 전환과 실패 뒤의 복구 경로를 사용자 조작으로 표현하고, 중요한 결정과 증거의 위치를 기록한다. [statechart](https://github.com/cursor/plugins/blob/main/pstack/skills/statechart/SKILL.md), [show-me-your-work](https://github.com/cursor/plugins/blob/main/pstack/skills/show-me-your-work/SKILL.md)

## 참고 문서

- [Codex 프로젝트 지침](https://developers.openai.com/codex/guides/agents-md)
- [Codex 서브에이전트](https://developers.openai.com/codex/subagents)
- [Codex 스킬](https://developers.openai.com/codex/skills)
- [LangGraph Graph API](https://docs.langchain.com/oss/python/langgraph/graph-api)
