# Schedule app implementation brief

Document type · Implementation handoff\
Status · Active / Revision 3 after architecture re-review (retry 2)\
Updated · 2026-11-14\
Related requirements and documents · SCH-001–SCH-007, [PRD](../prd/product.md), [design](../design/001_schedule_app.md), [shared standards](../../../.agent/standards.md)

Task ID · CL01-SCHED\
Owner · One `coder`\
Base commit · `0a432183dc5c6c866dedccf1ddd53e499b5c49b1` on `test/claude_01`

## Technical design

The app is a static site with no build step and no dependencies. It must work when `schedule-app/index.html` is opened directly from disk (`file://`) and when it is served over HTTP. Chrome blocks ES module imports over `file://`, so the app uses classic `<script>` tags in dependency order. Each logic file sets its own key on a shared namespace (`globalThis.ScheduleApp = globalThis.ScheduleApp || {}`, then `ScheduleApp.model` or `ScheduleApp.storage`) and never replaces the namespace. When `module` exists, the file also exports through `module.exports`, so Node tests can `require()` it without a DOM. In that case `storage.js` gets the model with `require('./model.js')`. In the browser it reads `ScheduleApp.model`.

| File | Responsibility | DOM access |
| --- | --- | --- |
| `schedule-app/index.html` | Static markup from design §3, `<noscript>`, and script tags in the order `model.js`, `storage.js`, `app.js` | — |
| `schedule-app/styles.css` | Visual spec from design §4 and §7, with responsive rules from §2.3 | — |
| `schedule-app/src/model.js` | Categories, `validateEvent(input) → {ok, errors{field: message}, value}`, `compareEvents`, `matchesQuery(event, query, category)`, `buildMonthGrid(year, monthIndex)` (Sunday start, 5 or 6 weeks), date helpers on local `YYYY-MM-DD` strings without `Date` time zone shifts, and the record shape check `isValidRecord` | None |
| `schedule-app/src/storage.js` | `createStore(getStorage, key)` with the methods `load()`, `save(events)`, `readRaw()` and `reset(expectedRaw)` | None. The caller injects a getter function, `() => window.localStorage` in the app and `() => fake` in tests. Each method calls the getter inside its own `try`, because reading `window.localStorage` itself throws a `SecurityError` when site data is blocked (F3). |
| `schedule-app/src/app.js` | State, rendering, event handlers, dialogs, focus and live regions | Yes |

### Storage contract

- Key · `schedule-app.events.v1`. Value · a JSON array of records.
- Record · `{ id: string (non-empty), title: string (1–100 code points after trim), date: "YYYY-MM-DD" (a real calendar date), allDay: boolean, start: "HH:MM" | null, end: "HH:MM" | null, category: "work" | "personal" | "health" | "other", notes: string (0–1000 code points), createdAt: ISO string, updatedAt: ISO string }`. If `allDay` is true, `start` and `end` are `null`. Otherwise both are valid times and `end > start`. Ids come from `crypto.randomUUID()` when it is available. Otherwise they use a time-plus-random fallback.
- Record validity on load:
  - `title` is already trimmed, non-empty, and at most 100 code points.
  - `date` is a real calendar date.
  - `start` and `end` follow the `allDay` rule above.
  - `category` is one of the four ids.
  - `notes` is a string of at most 1000 code points.
  - `createdAt` and `updatedAt` are non-empty strings that `Date.parse` accepts.
  - Unknown extra fields are allowed and preserved: an edit spreads the stored record before applying the form values, so no data is silently dropped.
- `load()` returns:
  - `{status: "ok", events, raw}` when the key is missing (`raw` is `null`, empty list), or when the value is a valid array of valid records with unique ids.
  - `{status: "unreadable", reason, raw}` for a JSON parse error, a non-array value, any invalid record (including an unknown category, design open issue 3), duplicate ids, or a thrown storage access error (design open issue 2, `raw` is `undefined`).
  - `load()` never writes.
- `save(events)` serializes and calls `setItem`. It returns `{ok: true}`, or `{ok: false, error}` if the getter or `setItem` throws. It never throws.
- `reset(expectedRaw)` reads the current raw value. It writes `[]` only if that value is still `=== expectedRaw` and still unreadable. It returns `{ok: true}`, `{ok: false, reason: "changed"}` without writing, or `{ok: false, error}`. It runs only after the user confirms the reset in the dialog.

### State and failure handling

- Every mutation re-reads and then writes (F2, option (a)). Create, edit and delete first call `load()`.
  - If storage is unreadable, it writes nothing and goes to design S20: the dialog stays open with its alert, the S15 banner shows, and `새 일정` is disabled.
  - If an edit targets an id that is not in the fresh list, it writes nothing and goes to S21a. The dialog stays open with the input kept, switches to add mode, and the next 저장 follows the normal create path. A delete with a missing id goes to S21b.
  - Otherwise it applies the change to a copy of the fresh list and calls `save`. An edit spreads the fresh stored record, not the in-memory copy, before applying the form values, so fields another tab added are preserved. In-memory state and the UI change only after `{ok: true}`, and then they come from the fresh list, so events added in another tab appear.
  - Accepted limitation (N1) · the whole stored list cannot be lost, because writes always start from a fresh read. If two tabs edit the same event while both dialogs are open, the later save replaces the earlier save's form values for that event. The app does not detect this same-event conflict. That is acceptable for a single-user app.
- Write failures leave in-memory state, storage and the DOM unchanged, and show no success status. Focus stays where design §5 puts it.
  - S8 save failure · `#event-dialog` stays open with every input kept. `#form-alert` shows the S8 text. Focus stays on `저장`.
  - S11 delete failure · `#confirm-dialog` stays open over the event dialog. `#confirm-alert` shows the S11 text. Focus stays on the confirm `삭제` button.
  - S18 reset failure · `#confirm-dialog` stays open. `#confirm-alert` shows the S18 text, and the banner stays. Focus stays on `초기화`.
- A reset whose stored raw value changed after the banner was shown goes to S22 and writes nothing.
- While storage is `unreadable`, the app shows the banner (S15). It inserts the banner text after startup, so `role="alert"` announces it. It renders an empty calendar, disables `새 일정`, and makes no `setItem` call until a confirmed reset succeeds. The stored raw string must remain byte-identical.
- Validation (SCH-004) runs in `validateEvent`, in the field order from design §8.3. A blocked save makes no `save` call.

### Decisions on design open issues

| # | Decision | Rationale |
| --- | --- | --- |
| 1 | Use the key and record shape above. Reset writes `[]`, guarded by `expectedRaw`. | One versioned key leaves room for a later migration. The guard keeps a confirmed reset from deleting data that changed in the meantime. |
| 2 | An inaccessible `localStorage` shows S15. A reset attempt that fails shows S18. | It reuses the existing recovery path, and no data is touched. |
| 3 | An unknown category id is a shape failure (S15). | Silently remapping would hide corruption. Keeping the data unchanged preserves it. |
| 4 | Mobile 6 px bars, with titles visually hidden but in the DOM, plus a visible `+N`, meet SCH-001 AC3. | Readable titles stay in the day list. AC3 is about the count shown per cell. |
| 5 | The search count covers the visible month. | It matches what the grid shows. |
| 6 | No `maxlength` attribute. | It keeps SCH-004 AC2 observable and testable. |

Other decisions:

- Ordering · all-day events first, then by start time, then by title with `localeCompare('ko')`, then by `createdAt`, then by `id`.
- Outside-month cells show their own chips and `+N`. The `이번 달 검색 결과 N개` count includes only dates in the visible month.

## Work order

| Order | Expected change | Affected call path | Acceptance criterion and verification |
| --- | --- | --- | --- |
| 1 | `src/model.js` | Form values → `validateEvent` → record. Events → `compareEvents` and `matchesQuery` → render. | SCH-001 AC3, SCH-004, SCH-006. Node unit tests on validation boundaries (100 and 101 code points, 1000 and 1001, end equal to start, whitespace title, invalid date such as `2026-02-30`), ordering and matching. |
| 2 | `src/storage.js` | Startup → `load()` → state. Mutation → `save()` → commit or failure alert. | SCH-005. The fake storage cases are listed below the table. | |
| 3 | `index.html`, `styles.css`, `src/app.js` | Browser load → render month → user actions → dialogs → save → re-render. | SCH-001 to SCH-007 in headless Chrome, including S8, S11, S18, S20, S21a, S21b and S22. Simulate a second tab by changing `localStorage` directly between opening the dialog and saving. Simulate blocked storage with a `window.localStorage` getter that throws, which must show S15 and lead to S18 on reset. The tester owns the harness. |

Fake storage cases for order 2:

- missing key, valid data, bad JSON, wrong shape, unknown category, duplicate ids, and preserved extra fields
- a throwing getter, a throwing `getItem` and a throwing `setItem`
- the raw value unchanged after an unreadable load
- `reset` writes only when the raw value matches, and returns `changed` otherwise

## Verification plan

The tester writes the tests under `schedule-app/tests/` with Node `22.19.0`, no npm installs, and Chrome at `C:/Program Files/Google/Chrome/Application/chrome.exe`.

- `node --test schedule-app/tests/unit/` covers the model and storage.
- A Node script drives headless Chrome through the DevTools Protocol, using Node's built-in `WebSocket` and `fetch`. It loads `index.html` over `file://`, or through a small `node:http` static server. It runs the end-to-end flows for SCH-001 to SCH-007 at 1280 px and 375 px. It saves screenshots and a JSON result file next to the evidence.
- Harness notes:
  - Launch Chrome with a temporary `--user-data-dir` and a pinned `chrome.exe`, and record the version.
  - Fix the clock (override `Date` via `Page.addScriptToEvaluateOnNewDocument`), or compute expected dates from the clock, so date-dependent checks are deterministic.
- Required for approval:
  - every acceptance criterion in SCH-001 to SCH-007, and the storage and concurrency cases above
  - the regression checks below, run from the repository root:
    1. `git diff --name-only 0a432183dc5c6c866dedccf1ddd53e499b5c49b1 -- . ':!schedule-app'` lists at most `README.md`.
    2. `git status --porcelain --untracked-files=all -- . ':!schedule-app'` lists at most `README.md`.
    3. Normalize CRLF to LF in both the base `README.md` (`git show 0a432183dc5c6c866dedccf1ddd53e499b5c49b1:README.md`) and the worktree `README.md`. This is needed because the repository uses `core.autocrlf=true` and the worktree copy is CRLF (R1). The normalized base content must be an exact suffix of the normalized current content. The inserted report block must end with a newline, so the base's first line `# French Toast · AX Architecture` starts a line, and the report must not contain its own top-level `# ` heading. If the README report is not written yet when the tester runs, the architect repeats this check before the final report.
- Evidence · `schedule-app/docs/test/NNN_<description>.md`. Number from `001`, create exclusively, and treat the records as append-only.

The coder may add a small smoke check while working, but must not write files under `schedule-app/tests/`.
