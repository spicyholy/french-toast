# FT-SCHEDULE-001 — 온유 일정

Revision D2/I2 (architecture retry 1). Base: 25c30fbb743aedcad0bd5b29e76d99838fc4dcd7. User confirmed personal, no login, browser-local persistence. No existing app or applicable AGENTS.md. Isolate all changes in schedule-app/.

## Contract and acceptance

- R1: Current local month/today on load; month navigation including year rollover/leap years; date selection and chronological daily agenda.
- R2: Create/edit/delete single-day events with title, date, start/end, category and notes. Trim title; reject invalid date/time and end <= start; stable edit IDs; cancelable deletion confirmation.
- R3: Versioned localStorage persistence across refresh. Empty first run (no fake personal events). Recover from unavailable/quota storage without crashing, retain session state, persistent warning and retry. Corrupt/unsupported data preserved until explicit confirmed reset; do not silently overwrite.
- R4: Case-insensitive title/notes search AND category filters, consistent in month and agenda, meaningful empty states and filter reset.
- R5: Korean interface, semantic labelled buttons/fields, visible focus, native accessible dialogs, Escape and focus restoration, date/count labels, category text in addition to color, no page overflow at 360px.

## Designer D1

Cream/sage/charcoal visual system. Slim sidebar for identity, add button, category checkboxes and storage status. Main month header with navigation/today/search; roomy seven-column calendar. Selected-day agenda beside calendar on wide displays and below on mobile. Distinct today/selected states. Restrained rounded cards and borders; system Korean fonts. Empty agenda invites adding an event. Dialog with explicitly labelled fields and retained validation errors. Delete uses a separate labelled native dialog with cancel default. No external assets or requests needed.

## Implementation brief I2

Initial-read failure is distinct from post-load write failure. If the initial storage read throws, disable event mutations and show a persistent explanation with retry and explicit confirmed reset/replacement. Retry performs a read, never a write; only a successful validated read unlocks mutations. Confirmed reset may initialize empty state and attempt to persist it, with ordinary write-failure warning if unavailable. Corrupt/unsupported initial data follows the same locked mutation behavior until confirmed reset. Thus no unread existing records can be overwritten by a retry. After a successful initial load, failed writes retain editable session state and retry writes that state.

Buildless static HTML/CSS/classic deferred JS in schedule-app/dist/; serve with Python HTTP server or open index.html. No runtime dependency, backend, account, analytics or external calendar integration. Source structure: index.html semantic shell, styles.css responsive design, model.js validation/date/storage helpers (browser global and CommonJS test export), app.js state/render/handlers. User input rendered with textContent. One events state, derived filtered views, local date strings avoid UTC drift. Event schema {id,title,date,start,end,category,notes}; storage envelope {version:1,events:[]}. Reject invalid envelopes/records and duplicate IDs. Persistence blocked after corrupt load until reset; retry storage failures. Calendar uses local Date constructors for arithmetic, strings for stored dates. Native dialog handles modality/focus; restore a stable trigger if an event trigger disappears on render. Same-tab mutations only; multi-tab synchronization and recurrence out of scope.

Caller flow: static page → load validated storage → render month and agenda → select date/filter → open form → native/custom validation → mutate in-memory events → attempt persist → rerender + announce outcome. Failed persistence retains state with warning/retry; malformed storage leaves original untouched and offers confirmed reset. Deletion only mutates after confirmation.

Verification: independent architecture review, coder, independent code review, tester then independent test review. Tester uses real Chrome if available, plus Node model tests as useful; cover CRUD+reload, invalid fields, date boundaries, combined filters, corrupt/quota/unavailable storage, keyboard dialog lifecycle, mobile width and desktop. Record exact SHA256 input hashes including untracked source, commands, expected/actual results and skips. Test artifacts only in schedule-app/tests/ and docs/. No changes to plugin files.

Deployment: Sites static hosting if supported; do not change audience or add application login. Local browser access remains available without sign-in. Hosting failure does not prevent completing local app or independent verification, but must be reported. Product code approval and test evidence required for PASS.
