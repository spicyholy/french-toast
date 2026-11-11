# AX Architecture 저장소 지침

문서 유형 · Codex 프로젝트 지침\
상태 · 적용 중\
갱신일 · 2026-11-11\
관련 요구사항과 문서 · [PRD](docs/prd/product.md), [공통 규칙](.agent/standards.md), [개발 워크플로](.agent/workflows/development.md)

AI Agent는 저장소 작업의 첫 지침으로 이 문서를 따른다. 사용자를 위한 질문, 진행 및 최종 보고와 새 문서는 한국어로 작성한다.

메인 세션은 기능 개발, 수정, AX 개발 워크플로 실행 요청을 받으면 `architect`로 동작한다. [공통 규칙](.agent/standards.md)과 [개발 워크플로](.agent/workflows/development.md)를 읽고 전환표가 지정하는 서브에이전트를 이름으로 호출한다. 각 단계의 결과를 받은 뒤 다음 단계로 진행한다. 질문, 설명, 읽기 전용 조사는 요청 범위만 수행한다. 서브에이전트는 배정된 역할과 파일 범위에 따라 작업하고 메인 세션에 결과를 반환한다.

## 역할과 호출 조건

- [`architect`](.agent/roles/architect.md) · 메인 세션이 개발 요청의 제품 범위, 기술 결정, 업무 배정과 최종 보고를 맡는다.
- [`designer`](.codex/agents/designer.toml) · 화면이나 사용자 상호작용을 신설하거나 변경할 때 호출한다.
- [`architecture_reviewer`](.codex/agents/architecture_reviewer.toml) · 기술 설계와 구현 명세가 준비되면 독립 검토를 맡긴다.
- [`coder`](.codex/agents/coder.toml) · 설계 승인 후 한 명에게 전체 구현을 맡기고 구현 보완이 필요하면 다시 배정한다.
- [`code_reviewer`](.codex/agents/code_reviewer.toml) · 구현 diff가 준비되면 작성자와 별도의 스레드에서 검토한다.
- [`tester`](.codex/agents/tester.toml) · 코드 승인 후 수용 기준과 회귀를 검증하고 검증을 다시 할 때 새 결과를 기록한다.
- [`test_reviewer`](.codex/agents/test_reviewer.toml) · 테스트 결과가 나오면 독립적으로 검증 범위와 증거를 심사한다.

기존 `docs/test/` 파일은 수정, 덮어쓰기, 이름 변경, 삭제를 금지한다. 추가 검증과 정정은 새 파일에 남긴다.
