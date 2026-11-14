# Schedule app

Document type · Run instructions\
Status · Active\
Updated · 2026-11-14\
Related requirements and documents · SCH-001–SCH-007, [PRD](docs/prd/product.md), [design](docs/design/001_schedule_app.md), [implementation brief](docs/implementation/001_schedule_app.md)

A single-user schedule management web app (일정관리 웹앱) with a Korean UI. It is a static HTML, CSS and JavaScript site with no build step and no runtime dependencies. Events are stored in the browser's `localStorage` under the key `schedule-app.events.v1`.

## Run

- Open `index.html` directly in a browser (`file://` works, because the scripts are classic `<script>` tags, not ES modules).
- Or serve this folder over HTTP with any static server and open `index.html`.

## Files

| Path | Contents |
| --- | --- |
| `index.html` | Page markup and script tags in the order `model.js`, `storage.js`, `app.js` |
| `styles.css` | Visual and responsive styles |
| `src/model.js` | Validation, ordering, search matching, month grid and date helpers. No DOM access. |
| `src/storage.js` | `createStore(getStorage, key)` with `load`, `save`, `readRaw` and `reset`. No DOM access. |
| `src/app.js` | State, rendering, dialogs, focus and live regions |

`src/model.js` and `src/storage.js` also export through `module.exports`, so Node tests can `require()` them.
