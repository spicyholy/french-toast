# API contract

Document type · Public API specification\
Status · Product API pending / Example included\
Updated · 2026-11-11\
Related requirements and documents · EX-BMK-001 (Example), [PRD](../prd/product.md), [technical decision](../adr/000_example.md)

When the product has an API, record its current inputs, outputs, errors, compatibility, and required migrations here.

## Example · Save and read a document bookmark

| Request | Input | Response |
| --- | --- | --- |
| `PUT /documents/{documentId}/bookmark` | Authenticated session and document ID. No request body. | `200` with `{"saved": true}` for both new and repeated saves. |
| `GET /documents/{documentId}/bookmark` | Authenticated session and document ID | `200` with `{"saved": true}` or `{"saved": false}` for the current user. |

Both requests return `401` without a signed-in session and `404` when the document is missing or the user cannot access it. When storage is temporarily unavailable, PUT returns `503` with `{"code": "BOOKMARK_UNAVAILABLE"}`. The client can retry the same PUT.

This example adds endpoints while preserving existing API response formats. A migration adds a bookmark table and a uniqueness constraint on the user and document pair. Apply the migration before deploying the endpoints.
