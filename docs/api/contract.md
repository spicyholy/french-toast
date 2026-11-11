# API 계약

문서 유형 · 공개 API 명세\
상태 · 제품 API 미정 / Example 수록\
갱신일 · 2026-11-11\
관련 요구사항과 문서 · EX-BMK-001 (Example), [PRD](../prd/product.md), [기술 결정](../adr/000_example.md)

제품 API가 생기면 현재 입력, 출력, 오류, 호환성과 필요한 Migration을 이 문서에 기록한다.

## Example · 문서의 북마크 저장과 조회

| 요청 | 입력 | 응답 |
| --- | --- | --- |
| `PUT /documents/{documentId}/bookmark` | 인증된 세션, 문서 ID. 본문 없음. | `200`과 `{"saved": true}`. 새 저장과 중복 저장에 같은 응답을 사용한다. |
| `GET /documents/{documentId}/bookmark` | 인증된 세션, 문서 ID | `200`과 `{"saved": true}` 또는 `{"saved": false}`. 현재 사용자의 상태를 반환한다. |

두 요청 모두 로그인 세션이 없으면 `401`, 문서가 없거나 열람할 수 없으면 `404`를 반환한다. 저장이 일시적으로 불가능하면 PUT은 `503`과 `{"code": "BOOKMARK_UNAVAILABLE"}`을 반환한다. 클라이언트는 같은 PUT으로 재시도할 수 있다.

이 예시는 신규 엔드포인트 추가를 가정한다. 기존 API의 응답 형식은 유지하고, 저장소에는 북마크 테이블과 사용자·문서 조합의 유일성 제약을 추가하는 Migration이 필요하다. 배포 시 Migration을 먼저 적용한다.
