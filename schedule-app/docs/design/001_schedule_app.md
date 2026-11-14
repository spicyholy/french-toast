# Schedule app screen design

Document type · Screen design and local wireframe\
Status · Revised after architecture review (retry 2)\
Updated · 2026-11-14\
Related requirements and documents · SCH-001–SCH-007, [PRD](../prd/product.md), [implementation brief](../implementation/001_schedule_app.md), [shared standards](../../../.agent/standards.md)

Task ID · CL01-SCHED\
Base commit · `0a432183dc5c6c866dedccf1ddd53e499b5c49b1` on `test/claude_01`\
Design source · Figma was unavailable for this task. This file is the wireframe and screen specification. No `docs/design/references/` material exists for the schedule app.

## 1. Scope and design decisions

The app is one page with no routing. It has a header, a toolbar, a month calendar, a list for the selected day, and modal dialogs. All UI text is Korean. Section 8 lists the exact strings that tests can assert.

| Decision | Choice | Rationale |
| --- | --- | --- |
| Week start | Sunday. Headers are `일 월 화 수 목 금 토`. | Korean calendar convention |
| Grid keyboard model | **Arrow keys with a roving `tabindex`**. The grid is a single Tab stop. | A month grid has 35 to 42 cells, so a Tab stop per cell would slow keyboard use. This follows the WAI-ARIA APG date grid pattern. |
| Selection | Selection follows focus. Moving focus in the grid selects that date and updates the day list. | One concept for mouse and keyboard users. Satisfies SCH-001 AC4 without a separate "select" key. |
| Event chips in cells | Not interactive. Clicking anywhere in a cell selects the day. Events are opened from the day list. | One focus model. Every action has a single keyboard path. |
| Dialogs | Native `<dialog>` opened with `showModal()`, plus an explicit Tab wrap. | Native inertness and Escape handling, with no dependencies. The explicit wrap keeps focus out of browser chrome (SCH-007 AC2). |
| Confirmations | In-page confirmation dialog, not `window.confirm`. | Exact strings can be tested and styled, and focus can be managed. |
| Loading state | None. `localStorage` reads are synchronous, so the first render already holds data. A `<noscript>` message covers disabled JS. | No asynchronous load exists to represent. |
| Motion | No animation. | Nothing needs to move. This avoids `prefers-reduced-motion` handling. |

## 2. Layout

### 2.1 Desktop, 1280 px viewport

The content is centered with `max-width: 1200px`, a 24 px side gutter and a two-column main area. The calendar takes `1fr` and the day panel is 360 px wide, with a 24 px gap between them.

```text
Desktop 1280 px (not to scale; Korean glyphs are double width)
+------------------------------------------------------------------------------------------+
| 일정 관리                                                                     <h1>        |
| [‹] 2026년 11월 [›]   [오늘]                                                <header nav> |
+------------------------------------------------------------------------------------------+
| 검색 [ 제목 또는 메모 검색            ]   분류 [ 전체        v ]            [ 새 일정 ]    |
| 이번 달 검색 결과 3개   [검색 조건 지우기]          <- only while search or filter active  |
+------------------------------------------------------------------------------------------+
| ! 저장된 일정을 불러올 수 없습니다. ...                    [데이터 초기화]  <- banner, only  |
|                                                                   when storage unreadable |
+--------------------------------------------------------------+---------------------------+
|  일      월      화      수      목      금      토          | 11월 14일 (토) 일정        |
| +------+-------+-------+-------+-------+-------+-------+     |                           |
| |  1   |  2    |  3    |  4    |  5    |  6    |  7    |     | +-----------------------+ |
| |      |[회의 ]|       |       |       |       |       |     | | 종일          [건강]   | |
| +------+-------+-------+-------+-------+-------+-------+     | | 등산                  | |
| |  8   |  9    | 10    | 11    | 12    | 13    |#(14)#|     | +-----------------------+ |
| |      |       |       |       |       |       |#등산#|     | +-----------------------+ |
| |      |       |       |       |       |       |#09:00|     | | 09:00~10:00   [업무]   | |
| |      |       |       |       |       |       |#12:00|     | | 주간 회의             | |
| |      |       |       |       |       |       |# +2 #|     | | 안건 정리 후 공유...   | |
| +------+-------+-------+-------+-------+-------+-------+     | +-----------------------+ |
| | 15 ... 21                                            |     |                           |
| | 22 ... 28                                            |     |                           |
| | 29   | 30    |  1    |  2    |  3    |  4    |  5    |     |                           |
| |      |       | (grey: next month, own chips and +N)  |     |                           |
| +------------------------------------------------------+     |                           |
+--------------------------------------------------------------+---------------------------+
 November 2026: 11-01 is a Sunday and 11-14 is a Saturday. This month needs 5 rows, with no leading cells.
 (14) = today marker (filled circle).  #...# = selected cell (tinted background, 2 px inset border).
 [회의 ] = event chip.  +2 = overflow count.
```

### 2.2 Mobile, 375 px viewport

At widths up to 640 px, the layout is a single column with a 16 px side gutter. The order is header, toolbar, banner, calendar, then day panel. The search field takes its own row, and the category filter and "새 일정" button share the next row.

```text
Mobile 375 px
+-----------------------------------+
| 일정 관리                          |
| [‹] 2026년 11월 [›]       [오늘]   |
+-----------------------------------+
| 검색                               |
| [ 제목 또는 메모 검색           ]  |
| 분류 [ 전체      v ]  [ 새 일정 ]  |
| 이번 달 검색 결과 3개              |
| [검색 조건 지우기]                 |
+-----------------------------------+
| 일  월  화  수  목  금  토          |
|+----+----+----+----+----+----+----+|
||  1 |  2 |  3 |  4 |  5 |  6 |  7 ||
|+----+----+----+----+----+----+----+|
||  8 |  9 | 10 | 11 | 12 | 13 |#14#||
||    | == |    |    |    |    |#==#||
||    |    |    |    |    |    |#==#||
||    |    |    |    |    |    |#+2#||
|+----+----+----+----+----+----+----+|
|  ...                               |
+-----------------------------------+
| 11월 14일 (토) 일정                |
| +-------------------------------+ |
| | 종일                    [건강] | |
| | 등산                          | |
| +-------------------------------+ |
+-----------------------------------+
 == = event chip shown as a 6 px colored bar. The title text stays in the DOM, visually hidden.
```

### 2.3 Responsive rules (SCH-007 AC1)

| Rule | Value |
| --- | --- |
| Breakpoint | `@media (max-width: 640px)` switches to one column. |
| Grid columns | `grid-template-columns: repeat(7, minmax(0, 1fr))` (or `table-layout: fixed; width: 100%` for a table). Cells and chips have `min-width: 0`. |
| Chip text | `white-space: nowrap; overflow: hidden; text-overflow: ellipsis`. |
| Long words in titles and notes | `overflow-wrap: anywhere` in the day list and dialog |
| Dialog width | `width: min(560px, calc(100vw - 32px))`, `max-height: calc(100vh - 32px)`, `overflow-y: auto` inside the dialog |
| Page | `html, body { overflow-x: hidden }` is not allowed as a fix. Content must fit. Verification: `document.documentElement.scrollWidth <= window.innerWidth` at 375 and 1280. |
| Cell min height | 112 px on desktop, 64 px on mobile |

## 3. Components

### 3.1 Header

- `<header>` holds `<h1>일정 관리</h1>`.
- The month navigation group contains the "이전 달" button (visible glyph `‹`, `aria-label="이전 달"`), the month heading `<h2 id="month-heading">2026년 11월</h2>`, the "다음 달" button (glyph `›`, `aria-label="다음 달"`) and the "오늘" button (visible text).
- The month heading format is `${year}년 ${month}월`, with no zero padding. The heading is inside a polite live region (`aria-live="polite"` on its wrapper), so month changes are announced.
- "이전 달" and "다음 달" change the visible month. The selected date moves to the same day number, clamped to the last day of the month (for example, 3월 31일 goes to 4월 30일 with "다음 달"). Focus stays on the button.
- "오늘" shows the current month and selects today. Focus stays on the button.

### 3.2 Toolbar

- Search is `<label for="search">검색</label>` with `<input type="search" id="search" placeholder="제목 또는 메모 검색">`. It filters on every `input` event with no submit button. The match is a case-insensitive substring of title or notes, after trimming the query. An empty query means no search.
- The category filter is `<label for="category-filter">분류</label>` with a `<select id="category-filter">`. The options are `전체` (value `all`, the default), then the four categories in Section 4 order.
- `<button id="new-event">새 일정</button>` is the primary style. It opens the dialog in add mode with the date set to the selected date.
- The filter summary `<p id="filter-summary">` shows only while the search is non-empty or the filter is not `all`. With N greater than 0 in the visible month, the text is `이번 달 검색 결과 N개`. With N equal to 0, the text is `이번 달에 조건에 맞는 일정이 없습니다.` The button `<button id="clear-filters">검색 조건 지우기</button>` follows the text. It empties the search, sets the filter to `전체`, hides the summary and moves focus to the search field.
- The filter summary is not a live region, because it would announce on every keystroke. The `#status` region announces the count after a 500 ms pause in typing (Section 6.3).

### 3.3 Calendar grid

- Use `<table id="calendar" role="grid" aria-labelledby="month-heading">`. The `<thead>` has seven `<th scope="col">` cells with `abbr` full names (`일요일`, and so on). The `<tbody>` has 5 or 6 `<tr>` rows, as many as the month needs, with no fixed sixth row.
- Each day is a `<td role="gridcell" data-date="YYYY-MM-DD">`. Leading and trailing days from the adjacent months are shown and have `data-outside="true"`.
- A cell contains the day number (`<span class="day-num">`), then up to three event chips, then an overflow line `+N` if needed. Chips and the overflow line are counted after search and filter (SCH-006 AC2).
- Outside cells (from adjacent months) follow the same rules. They show chips and `+N` for their own date's matching events, and their `aria-label` counts those events. They differ only in the `#F9FAFB` background and `#4B5563` day number. The `이번 달 검색 결과 N개` count in `#filter-summary` includes **only dates inside the visible month**, so events on outside cells are not counted. Events are ordered all-day first, then by start time, then by title (PRD ordering rule).
- Chip text is the title for all-day events and `HH:MM 제목` for timed events. The chip background is the category color (Section 4).
- The cell's accessible name comes from `aria-label`, in the format `2026년 11월 14일 토요일, 일정 3개`. Add `, 오늘` when the cell is today. With zero matching events, the name ends with `, 일정 없음`. The visible chips are `aria-hidden="true"`, because the label summarises them and the day list carries the detail.
- Today has `aria-current="date"`. The selected cell has `aria-selected="true"` and all others have `aria-selected="false"`.
- Exactly one cell has `tabindex="0"`, and it is the selected date. All others have `tabindex="-1"`.
- Clicking a cell selects its date. Clicking an outside cell also switches the visible month to that date's month.

### 3.4 Selected-day panel

- `<section aria-labelledby="day-heading">` holds `<h2 id="day-heading" tabindex="-1">11월 14일 (토) 일정</h2>`. The format is `${month}월 ${day}일 (${weekday}) 일정`, where the weekday is one of `일 월 화 수 목 금 토`.
- `<ul id="day-list">` has one `<li>` per matching event, in PRD order. Each `<li>` contains one `<button type="button" class="event-item" data-id="...">` that opens the dialog in edit mode. The button content, in reading order:
  1. The time line is `종일` or `HH:MM~HH:MM` (two zero-padded 24 h times joined by `~`, U+007E, with no spaces).
  2. The category badge, with its Korean label in text, so category is never shown by color alone.
  3. The title, in bold.
  4. The first 80 characters of the notes, if any, followed by `…` when truncated, in muted text.
- Empty states are in Section 5.

### 3.5 Event dialog

`<dialog id="event-dialog" aria-labelledby="event-dialog-title">` contains `<form id="event-form" novalidate>`. The built-in browser validation bubbles are off so that the Korean messages in this design are the only ones shown.

| Order | Field | Element | Default (add mode) |
| --- | --- | --- | --- |
| 0 | Form alert | `<div id="form-alert" role="alert">`, empty and hidden until needed | — |
| 1 | 제목 | `<input id="event-title" type="text" autocomplete="off">`. No `maxlength` attribute, so over-length input is visible and blocked by validation. Counter `<span id="title-count">0/100</span>` sits below it. | empty |
| 2 | 날짜 | `<input id="event-date" type="date">` | selected date |
| 3 | 종일 | `<input id="event-allday" type="checkbox">` with label `종일` | unchecked |
| 4 | 시작 시간 | `<input id="event-start" type="time">` | `09:00` |
| 5 | 종료 시간 | `<input id="event-end" type="time">` | `10:00` |
| 6 | 분류 | `<select id="event-category">` with the four categories | `work` (업무) |
| 7 | 메모 | `<textarea id="event-notes" rows="4">`, no `maxlength`, counter `<span id="notes-count">0/1000</span>` | empty |
| 8 | Actions | `[삭제]` (`#delete-event`, edit mode only, `hidden` in add mode, left aligned, danger style) ... `[취소] [저장]` (right aligned, 저장 is primary) | — |

- The title is `새 일정` in add mode and `일정 수정` in edit mode (`<h2 id="event-dialog-title">`).
- When `종일` is checked, the time fields' container gets the `hidden` attribute. The time fields are then excluded from validation and from the saved record. Their values are kept in the form, so unchecking restores them.
- Edit mode fills every field with the saved values (SCH-003 AC1). A saved all-day event opens with the time fields at `09:00` and `10:00`.
- The counters update on `input`. A counter turns `#B91C1C` when its length goes over the limit. Length is counted in code points (`Array.from(value).length`). The title is trimmed before counting and before saving.

### 3.6 Confirmation dialog

There is one reusable `<dialog id="confirm-dialog" role="alertdialog" aria-labelledby="confirm-title" aria-describedby="confirm-message">`. It has `<h2 id="confirm-title">`, `<p id="confirm-message">`, `<div id="confirm-alert" role="alert">` (hidden until needed) and buttons `[취소] [<action>]`. The action button is danger style. It is used for delete (stacked over the event dialog) and for storage reset.

## 4. Categories and colors

The category list is fixed. Stored records hold the `id`. The UI shows the `label`.

| id | label | Chip and badge background | Text on it | Contrast |
| --- | --- | --- | --- | --- |
| `work` | 업무 | `#1E40AF` | `#FFFFFF` | 8.72:1 |
| `personal` | 개인 | `#7E22CE` | `#FFFFFF` | 6.98:1 |
| `health` | 건강 | `#047857` | `#FFFFFF` | 5.48:1 |
| `other` | 기타 | `#4B5563` | `#FFFFFF` | 7.56:1 |

### 4.1 Interface palette

Ratios use the WCAG 2.x relative luminance formula. They were computed for this design and are rounded to two decimals.

| Token | Use | Foreground / background | Contrast |
| --- | --- | --- | --- |
| `--text` | Body text | `#1F2937` on `#FFFFFF` | 14.68:1 |
| `--text` on selected cell | Day number and chips area | `#1F2937` on `#EFF6FF` | 13.49:1 |
| `--muted` | Secondary text, notes preview, outside-month numbers, counters | `#4B5563` on `#FFFFFF` / on `#F9FAFB` / on `#EFF6FF` | 7.56:1 / 7.23:1 / 6.94:1 |
| Placeholder | Search placeholder | `#6B7280` on `#FFFFFF` | 4.83:1 |
| `--primary` | Primary button text, today circle | `#FFFFFF` on `#1D4ED8` | 6.70:1 |
| Secondary button | Button text and link-like text | `#1D4ED8` on `#FFFFFF` | 6.70:1 |
| `--danger` | Danger button | `#FFFFFF` on `#B91C1C` | 6.47:1 |
| Error text | Field errors, over-limit counters | `#B91C1C` on `#FFFFFF` | 6.47:1 |
| Sunday numbers | Day number in the 일 column | `#B91C1C` on `#FFFFFF` / `#F9FAFB` / `#EFF6FF` | 6.47:1 / 6.19:1 / 5.95:1 |
| Saturday numbers | Day number in the 토 column | `#1D4ED8` on `#FFFFFF` / `#F9FAFB` / `#EFF6FF` | 6.70:1 / 6.41:1 / 6.16:1 |
| Banner | Storage error banner text | `#7F1D1D` on `#FEF2F2` | 9.16:1 |
| Form alert | Alert text inside dialogs | `#B91C1C` on `#FEF2F2` | 5.91:1 |
| Outside-month background | Cells from adjacent months | `#F9FAFB` | (background) |
| Selected background | Selected cell | `#EFF6FF` | (background) |

Non-text contrast (WCAG 1.4.11, at least 3:1):

| Element | Colors | Contrast |
| --- | --- | --- |
| Input, select and textarea borders | `#6B7280` on `#FFFFFF` | 4.83:1 |
| Focus ring | `#1D4ED8` on `#FFFFFF` / `#EFF6FF` | 6.70:1 / 6.16:1 |
| Selected-cell inset border | `#1D4ED8` on `#EFF6FF` | 6.16:1 |
| Grid lines | `#D1D5DB` on `#FFFFFF` | 1.47:1, decorative only and not the sole indicator of anything |

A disabled button uses background `#F3F4F6`, text `#4B5563` (6.87:1) and `cursor: not-allowed`. Disabled controls are exempt from the contrast rule, but this keeps their text readable.

## 5. States, triggers, outcomes and verification

Each state has a short check for the `tester`. "Seed" means setting `localStorage` before load. The storage key is `schedule-app.events.v1` and holds a JSON array of event records. The implementation brief defines the record shape check.

**Write protocol (architect decision).** Every write (create, edit, delete, reset) re-reads the key just before writing:

- Create, edit and delete: if the re-read parses and passes the shape check, the change is applied to that fresh list and written. After a successful write, the calendar and list re-render from the fresh list, so events added in another tab appear. If the re-read is unreadable, the result is S20. If the target id is missing from the fresh list, the result is S21a for an edit or S21b for a delete.
- Reset: the write happens only if the raw stored string still equals the string seen when the banner was shown. Otherwise the result is S22.

The success states S7, S10 and S17 assume the re-read passed. The write-failure states S8, S11 and S18 apply when `setItem` throws after a good re-read.

| # | State | Trigger | Visible outcome | Focus and announcement | Recovery | Verify |
| --- | --- | --- | --- | --- | --- | --- |
| S1 | First run (empty) | No stored value under the key | The calendar shows the current month, today has the marker and is selected, and the cells have no chips. The day list shows `이 날에는 일정이 없습니다.` | No focus is moved on load. | Click `새 일정`. | Clear storage and load. Check that `#month-heading` equals the current `YYYY년 M월`, that `td[aria-current="date"]` has `aria-selected="true"`, and that the empty text is present. |
| S2 | Populated | Valid stored events | Chips show in the cells, at most 3 per cell plus `+N`, in PRD order. The day list shows the selected day's events. | — | — | Seed 5 events on one date. Check that the cell has 3 chips and the text `+2`, and that `#day-list li` count = 5 in order: all-day, then by time, then by title. |
| S3 | Day selected | Click a cell, or press an arrow key in the grid | The selected cell is tinted, `#day-heading` updates, and the list updates. | Focus is on the cell (keyboard), with no extra announcement. The heading text change is not live. | — | Press ArrowRight from the 14th. Check that `aria-selected` moves to the 15th, `#day-heading` = `11월 15일 (일) 일정`, and `document.activeElement` is the 15th cell. |
| S4 | Add dialog open | Click `새 일정` | The dialog shows the title `새 일정`, the date = selected date, `종일` unchecked, times `09:00` and `10:00`, category `업무`, and no `삭제` button. | Focus goes to `#event-title`. | `취소` or Escape closes the dialog with no change. | Select the 20th, open the dialog, and check that `#event-date.value` ends with `-20`. Check that `document.activeElement.id === 'event-title'`. |
| S5 | Edit dialog open | Activate an item in `#day-list` | The title is `일정 수정`, all fields hold the saved values, and `삭제` is visible. | Focus goes to `#event-title`. | `취소` or Escape | Open a seeded event and compare every field with the seed. |
| S6 | Validation error | `저장` with invalid input (Section 8.3) | Each invalid field gets `aria-invalid="true"` and an error `<p class="field-error" id="<field>-error">` below it, linked through `aria-describedby`. `#form-alert` shows `입력 내용을 확인해 주세요.` Storage is unchanged and the dialog stays open. | Focus goes to the first invalid field in form order. `#form-alert` (`role="alert"`) announces. | After the first failed save, each `input` event re-validates that field and removes its error when it becomes valid. `#form-alert` clears once all fields are valid. | Enter a title of 3 spaces and press `저장`. Check that the `#event-title-error` text is `제목을 입력해 주세요.`, that focus is on `#event-title`, and that the storage string is byte-identical to before. |
| S7 | Save success | `저장` with valid input and a successful write | The dialog closes. The visible month switches to the event's date, which becomes selected. The chip and list item appear without a reload. | Add: focus returns to `#new-event`. Edit: focus goes to the saved event's item in `#day-list`. If the item is hidden by the filter, focus goes to `#day-heading`. `#status` announces `일정을 추가했습니다.` or `일정을 수정했습니다.` | — | Add an event on the 20th. Check the chip in `td[data-date$="-20"]`, the list item, the `#status` text, and that the record is in storage after a reload. |
| S8 | Storage write failure | `setItem` throws (for example a quota error) on save | The dialog stays open with all input kept. `#form-alert` shows `저장하지 못했습니다. 브라우저 저장 공간을 확인한 후 다시 시도해 주세요.` The calendar and list are unchanged (in-memory state rolls back). No success message is shown. | Focus stays on `저장`. `#form-alert` announces. | Press `저장` again to retry, or `취소`. | Stub `Storage.prototype.setItem` to throw and save. Check that the dialog is open, the field values are unchanged, the alert text matches, `#status` is empty, and no new chip appears. |
| S9 | Delete confirmation | `삭제` in the edit dialog | `#confirm-dialog` opens above the event dialog with title `일정을 삭제할까요?`, message `「{title}」 일정이 삭제되며 되돌릴 수 없습니다.` and buttons `취소` and `삭제`. | Focus goes to `취소`, the safe default. | `취소` or Escape closes only the confirm dialog. The event is kept and focus returns to the `삭제` button in the event dialog (SCH-003 AC2). | Press `삭제`, then `취소`. Check that the event is still in storage and the list, and that the event dialog is still open. |
| S10 | Delete success | `삭제` in the confirm dialog with a successful write | Both dialogs close and the event disappears from the cell and list. | Focus goes to `#day-heading`. `#status` announces `일정을 삭제했습니다.` | — | Confirm the delete. Check that the record is gone from storage and the DOM and that the status text matches. |
| S11 | Delete write failure | `setItem` throws during delete | The confirm dialog stays open. `#confirm-alert` shows `삭제하지 못했습니다. 다시 시도해 주세요.` The event is kept in memory, storage and the DOM. | Focus stays on the confirm `삭제` button. The alert announces. | Retry, or `취소` | Stub `setItem` to throw and confirm the delete. Check that the event is still listed and the alert text matches. |
| S12 | Search or filter active, matches | Typing in `#search` or changing `#category-filter` | Cells and list show only matching events, and `+N` counts only matches. `#filter-summary` shows `이번 달 검색 결과 N개`. | `#status` announces the same text after 500 ms of no typing. | `검색 조건 지우기` | Seed a "회의" note and other events, then type `회의`. Check that only the matching chips remain and the summary count is correct. Check that `MEETING` matches `meeting` (ignoring case). |
| S13 | No results | Search and/or filter matches nothing in the visible month | Cells have no chips. `#filter-summary` shows `이번 달에 조건에 맞는 일정이 없습니다.` with `검색 조건 지우기`. The day list shows `조건에 맞는 일정이 없습니다.` | `#status` announces the summary text after the 500 ms pause. | `검색 조건 지우기` restores everything (SCH-006 AC3) and focuses `#search`. | Search `zzzz`. Check both empty texts. Press clear and check that all chips are back, `#search.value === ''` and `#category-filter.value === 'all'`. |
| S14 | Day empty under filter | The selected day has events but none match | The day list shows `조건에 맞는 일정이 없습니다.` | — | — | Filter `건강` on a day with only `업무` events and check the text. |
| S15 | Storage unreadable | The stored value fails `JSON.parse` or is not an array of valid records (shape check in the brief, including an unknown category id), or accessing `localStorage` throws | `#storage-banner` (`role="alert"`) is an empty container in the initial HTML (`hidden`). After startup, script fills in the text and the button and removes `hidden`, so the alert is announced. The banner text must not be in the initial DOM. The banner appears above the calendar with the text `저장된 일정을 불러올 수 없습니다. 저장된 데이터는 변경되지 않았습니다.` and the button `데이터 초기화`. The calendar renders with no events. `새 일정` is `disabled`. Search, filter and month navigation still work. The day list shows `이 날에는 일정이 없습니다.` | The banner announces on load. | `데이터 초기화` leads to S16. The stored value must not be written, removed or reformatted until the reset is confirmed (SCH-005 AC2). | Check that the served `index.html` source does not contain the banner text. Seed `"{not json"` and load. Check the banner text, that `#new-event` is disabled, and that `localStorage.getItem(key) === '{not json'` after load, after navigating months, and after cancelling a reset. |
| S16 | Reset confirmation | `데이터 초기화` | `#confirm-dialog` shows title `저장된 데이터를 초기화할까요?`, message `읽을 수 없는 저장 데이터가 삭제되며 되돌릴 수 없습니다.` and buttons `취소` and `초기화`. | Focus goes to `취소`. | `취소` or Escape closes the dialog. The value is unchanged and focus returns to `데이터 초기화`. | Cancel and check that storage is unchanged. |
| S17 | Reset success | `초기화` with a successful write | The stored value is replaced with an empty list (`[]`). The banner is removed and `새 일정` is enabled. | Focus goes to `#new-event`. `#status` announces `저장 데이터를 초기화했습니다.` | — | Confirm and check that storage holds `[]`, the banner is gone and the button is enabled. |
| S18 | Reset write failure | Writing during the reset throws | The confirm dialog stays open. `#confirm-alert` shows `초기화하지 못했습니다. 다시 시도해 주세요.` The banner stays. | Focus stays on `초기화`. The alert announces. | Retry, or `취소` | Stub `setItem` to throw, confirm the reset, and check the alert. Storage still holds the original value. |
| S19 | JavaScript disabled | No JS | `<noscript>` shows `이 앱을 사용하려면 JavaScript를 켜 주세요.` | — | — | Disable JS and load. |
| S20 | Storage became unreadable at write time | `저장` (add or edit) or the confirm `삭제` is pressed, and the pre-write re-read is unreadable (parse or shape failure, or access throws) | Nothing is written. The open dialog(s) stay open with all user input kept. The dialog alert (`#form-alert` for save, `#confirm-alert` for delete) shows `저장된 데이터를 읽을 수 없어 변경하지 못했습니다. 입력 내용은 유지됩니다.` Behind the dialog, the calendar shows no events and the S15 banner is shown (inserted as in S15). The raw string it holds becomes the reset baseline. `#new-event` is `disabled`. | Focus stays on the button that was pressed (`저장` or the confirm `삭제`). The dialog alert announces. The banner is inserted at once, but the page behind the modal is inert, so the dialog alert is the announcement and the banner is not expected to announce separately. | `취소` or Escape closes the dialog(s). Focus returns to `데이터 초기화` in the banner, since the previous opener may be gone. The user can then reset (S16). | Open the edit dialog, then set the key to `"{bad"` from the console and press `저장`. Check the `#form-alert` text, that the field values are unchanged, that `localStorage.getItem(key) === '{bad'`, that `#storage-banner` is visible, and that `#new-event` is disabled. |
| S21a | Edited event removed elsewhere | Edit-`저장`, where the fresh list (readable) no longer contains the target `id` | Nothing is written. `#event-dialog` stays open with every input kept. Behind the dialog, the calendar and day list re-render from the fresh list, so the event is gone and other tabs' changes appear. `#form-alert` shows `이 일정은 다른 곳에서 삭제되었습니다. 저장을 다시 누르면 새 일정으로 저장됩니다.` The dialog switches to add mode: `#event-dialog-title` becomes `새 일정`, the `삭제` button gets `hidden`, and the edit id is dropped. Any field errors are cleared. | Focus stays on `저장`. `#form-alert` announces. `#status` stays unchanged. | A second `저장` follows the normal create path (S6 validation, then the pre-write re-read with S20, then the write with S8, then S7 add success: `일정을 추가했습니다.` and focus to `#new-event`). The new record gets a new id. `취소` or Escape closes the dialog without writing, and focus goes to `#day-heading`, because the original list item is gone. | Open the edit dialog for event A and change its title to `B`. In the console, write the stored array without A and press `저장`. Check that the dialog is open, the title field is `B`, `#form-alert` text matches, `#event-dialog-title` is `새 일정`, `#delete-event` is hidden, storage equals the console-written value, A's item is gone from `#day-list`, and focus is on `저장`. Press `저장` again and check that one new record titled `B` with a new id is stored and `#status` is `일정을 추가했습니다.` |
| S21b | Deleted event already removed elsewhere | The confirm `삭제`, where the fresh list (readable) no longer contains the target `id` | Nothing is written. Both dialogs close. The calendar and list re-render from the fresh list, so the event is gone and other tabs' changes appear. | Focus goes to `#day-heading`. `#status` announces `이 일정은 다른 곳에서 이미 삭제되었습니다.` | None needed. | Open event A, press `삭제`, then in the console write the stored array without A and press the confirm `삭제`. Check that both dialogs are closed, A is absent from the DOM, storage equals the console-written value, the `#status` text matches, and focus is on `#day-heading`. |
| S22 | Reset target changed | The confirm `초기화` is pressed, and the raw stored string differs from the reset baseline (the string seen when the banner was shown) | Nothing is written. The app reloads its state from the new raw value. (a) If it is readable: the confirm dialog closes, the banner is removed, `새 일정` is enabled, and the events render. (b) If it is still unreadable (a different value): the confirm dialog stays open, `#confirm-alert` shows `저장된 데이터가 바뀌었습니다. 내용을 다시 확인한 후 초기화해 주세요.`, the banner stays, and the baseline is updated to the new raw string. | (a) Focus goes to `#new-event`. `#status` announces `저장된 데이터를 다시 불러왔습니다.` (b) Focus stays on `초기화`. The alert announces. | (a) None needed. (b) Pressing `초기화` again resets against the new baseline (S17), or `취소`. | Seed `"{a"` and open the reset confirm. (a) From the console, store a valid JSON array holding one event and press `초기화`. Check that storage holds the console value unchanged, the banner is gone, the event renders, and the status text matches. (b) Instead set `"{b"`, press `초기화`, and check that storage is still `{b`, the alert text matches, and a second `초기화` writes `[]`. |

## 6. Keyboard, focus and ARIA

### 6.1 Tab order

1. `이전 달`
2. `다음 달`
3. `오늘`
4. `#search`
5. `#category-filter`
6. `#new-event`
7. `검색 조건 지우기` (when shown)
8. `데이터 초기화` (when shown)
9. Calendar grid (one stop, the selected cell)
10. Each `#day-list` item button

The DOM order matches this visual order. Do not use a positive `tabindex`. The month heading sits between `이전 달` and `다음 달` but is not focusable.

### 6.2 Grid keys (focus on a cell)

| Key | Action |
| --- | --- |
| `ArrowLeft` / `ArrowRight` | Previous or next day |
| `ArrowUp` / `ArrowDown` | Same weekday, previous or next week |
| `Home` / `End` | Sunday or Saturday of the current week |
| `PageUp` / `PageDown` | Same day in the previous or next month, clamped to the month's last day |
| `Enter` / `Space` | Select the focused date. Selection already follows focus, so this repeats it. `preventDefault` stops page scroll on Space. |
| `Tab` / `Shift+Tab` | Leave the grid |

All arrow, Home, End and Page keys move focus and selection together and call `preventDefault`. If the target date is outside the visible month, the visible month changes first. The re-rendered cell for that date then gets `tabindex="0"` and `focus()`. Re-rendering must keep focus inside the grid, so code must not leave `document.activeElement` on `body`.

### 6.3 Live regions

| Region | Element | Politeness | Content |
| --- | --- | --- | --- |
| Status | `<p id="status" role="status" class="visually-hidden">` (one per page) | polite | All `#status` strings are listed in §8.2: success messages (S7, S10, S17), S21b, S22a and the debounced search summary (S12, S13). Clear it before each new message, so a repeated identical message is announced again. |
| Month heading | The wrapper of `#month-heading` | polite | The month after a change |
| Storage banner | `#storage-banner`, empty and `hidden` in the initial HTML and filled after startup | `role="alert"` | S15, S20 |
| Form alert | `#form-alert` | `role="alert"` | S6, S8, S20, S21a |
| Confirm alert | `#confirm-alert` | `role="alert"` | S11, S18, S20, S22b |

Use `.visually-hidden` as the standard clip pattern (`position:absolute; width:1px; height:1px; overflow:hidden; clip:rect(0 0 0 0); white-space:nowrap`). Do not use `display:none` for it.

### 6.4 Dialog focus management (SCH-007 AC2)

- On open, store `document.activeElement` as the return target, call `showModal()` and focus the initial element given in Section 5.
- Wrap Tab inside the dialog. On `keydown` Tab from the last focusable element, focus the first one. On Shift+Tab from the first, focus the last. The focusable elements are those not `hidden`, not `disabled` and not inside a `hidden` container.
- On Escape, the native `cancel` event closes only the top dialog. Treat it the same as `취소`. A stacked confirm dialog returns focus to the element that opened it, inside the event dialog.
- On close, focus the stored return target if it is still connected and visible. Otherwise, use the fallback in Section 5. The last resort is `#day-heading`.
- While a dialog is open, the page behind it is inert (native `showModal`).

### 6.5 Form labelling (SCH-007 AC3)

Every control has a visible `<label for>`. A field error is in `<p id="<field-id>-error" class="field-error">` placed right after the control. The control gets `aria-invalid="true"`, and `aria-describedby` lists the error id plus the counter id where one exists. When the error clears, remove the error id from `aria-describedby` and set `aria-invalid="false"`.

## 7. Visual specification

| Item | Spec |
| --- | --- |
| Font | `system-ui, -apple-system, "Segoe UI", "Apple SD Gothic Neo", "Malgun Gothic", sans-serif`. Base size 16 px, line height 1.5. |
| Sizes | h1 24 px/700. Month heading 20 px/700. Day heading 18 px/700. Chip 12 px/500. Day number 14 px/600. Field error 14 px. |
| Spacing scale | 4, 8, 12, 16, 24, 32 px. No other values. |
| Page gutter | 24 px (desktop) and 16 px (mobile). Section vertical gap 16 px. |
| Header | Gap between nav controls 8 px. Gap between h1 and nav 8 px. |
| Toolbar | Gap between controls 12 px. Label-to-control gap 4 px. Rows wrap with a 8 px gap. |
| Buttons | Min height 40 px (desktop) and 44 px (mobile). Padding 0 16 px. Border 1 px. Radius 6 px. Font 15 px/600. Primary: background `#1D4ED8`, border `#1D4ED8`, text `#FFFFFF`. Secondary: background `#FFFFFF`, border `#6B7280`, text `#1D4ED8`. Danger: background `#B91C1C`, border `#B91C1C`, text `#FFFFFF`. Icon nav buttons (`‹` `›`) are 40×40 px (44×44 px on mobile). |
| Inputs | Height 40 px (44 px mobile). Padding 0 12 px. Border 1 px `#6B7280`. Radius 6 px. Invalid border 2 px `#B91C1C`, with the error text below (never color alone). Textarea padding 8 px 12 px. |
| Grid | Cell border 1 px `#D1D5DB` (collapsed). Cell padding 4 px. Gap between chips 2 px. Day number at top left. Today: the day number in a 28 px circle `#1D4ED8` with white text. |
| Chip | Height 20 px. Padding 0 6 px. Radius 4 px. Category background, white text. On mobile the chip is a 6 px high full-width bar, and its text is in `.visually-hidden`. |
| Selected cell | Background `#EFF6FF` plus `box-shadow: inset 0 0 0 2px #1D4ED8`. |
| Hover (pointer) | Cells: `box-shadow: inset 0 0 0 1px #6B7280` (only when not selected). Buttons: filter `brightness(0.92)`. No background color change, so the contrast table stays valid. |
| Focus ring | All focusable elements: `:focus-visible { outline: 3px solid #1D4ED8; outline-offset: 2px; }`. Grid cells use `outline-offset: -6px`, so the ring sits inside the 2 px selected-cell inset border and is not clipped by neighbors. Never `outline: none` without a replacement. |
| Day list item | Full-width button. Padding 12 px. Border 1 px `#D1D5DB`. Radius 8 px. Gap between items 8 px. Left border 4 px in the category color. Text left aligned. |
| Category badge | Padding 2 px 8 px. Radius 999 px. 12 px/600. Category background, white text. |
| Banner | Background `#FEF2F2`. Border 1 px `#B91C1C`. Radius 8 px. Padding 12 px 16 px. The text and button are inline on desktop and stacked on mobile. |
| Dialog | Background `#FFFFFF`. Border 1 px `#D1D5DB`. Radius 12 px. Padding 24 px (16 px mobile). `::backdrop` is `rgba(17, 24, 39, 0.5)`. Field gap 16 px. Actions row top margin 24 px, button gap 8 px. |
| Motion | None. No transitions or animations. |

## 8. Korean UI strings

Tests may assert these exact strings. `{…}` marks interpolation.

### 8.1 Static text

| Key | String |
| --- | --- |
| Page `<title>` | `일정 관리` |
| h1 | `일정 관리` |
| Month heading | `{year}년 {month}월` |
| Previous / next / today | `이전 달` (aria-label), `다음 달` (aria-label), `오늘` |
| Weekday headers | `일` `월` `화` `수` `목` `금` `토` |
| Search label / placeholder | `검색` / `제목 또는 메모 검색` |
| Filter label / all option | `분류` / `전체` |
| New event button | `새 일정` |
| Filter summary | `이번 달 검색 결과 {n}개` / `이번 달에 조건에 맞는 일정이 없습니다.` |
| Clear filters | `검색 조건 지우기` |
| Day heading | `{month}월 {day}일 ({weekday}) 일정` |
| Day list empty | `이 날에는 일정이 없습니다.` |
| Day list empty under search or filter | `조건에 맞는 일정이 없습니다.` |
| All-day time label | `종일` |
| Cell label | `{year}년 {month}월 {day}일 {weekday}요일, 일정 {n}개` or `…, 일정 없음`, plus `, 오늘` |
| Overflow | `+{n}` |
| Dialog titles | `새 일정` / `일정 수정` |
| Field labels | `제목`, `날짜`, `종일`, `시작 시간`, `종료 시간`, `분류`, `메모` |
| Dialog buttons | `저장`, `취소`, `삭제` |
| Counters | `{n}/100`, `{n}/1000` |
| Noscript | `이 앱을 사용하려면 JavaScript를 켜 주세요.` |

### 8.2 Status messages (`#status`)

| Event | String |
| --- | --- |
| Added | `일정을 추가했습니다.` |
| Updated | `일정을 수정했습니다.` |
| Deleted | `일정을 삭제했습니다.` |
| Reset | `저장 데이터를 초기화했습니다.` |
| Deleted event already removed elsewhere (S21b) | `이 일정은 다른 곳에서 이미 삭제되었습니다.` |
| Reset target changed, now readable (S22a) | `저장된 데이터를 다시 불러왔습니다.` |
| Search summary, debounced 500 ms (S12, S13) | Same text as `#filter-summary`: `이번 달 검색 결과 {n}개` or `이번 달에 조건에 맞는 일정이 없습니다.` |

This table is the complete list of `#status` strings.

### 8.3 Validation errors (SCH-004)

Errors are checked in field order. Each field shows at most one error, the first rule it fails.

| Field | Rule | String |
| --- | --- | --- |
| 제목 | Empty after trim | `제목을 입력해 주세요.` |
| 제목 | More than 100 code points after trim | `제목은 100자 이하로 입력해 주세요.` |
| 날짜 | Empty or not a valid `YYYY-MM-DD` | `날짜를 선택해 주세요.` |
| 시작 시간 | Not all-day and empty | `시작 시간을 입력해 주세요.` |
| 종료 시간 | Not all-day and empty | `종료 시간을 입력해 주세요.` |
| 종료 시간 | Not all-day and end <= start | `종료 시간은 시작 시간보다 늦어야 합니다.` |
| 메모 | More than 1000 code points | `메모는 1000자 이하로 입력해 주세요.` |
| Form alert | Any field error | `입력 내용을 확인해 주세요.` |

### 8.4 Storage and confirmation

| Key | String |
| --- | --- |
| Write failure on save (`#form-alert`) | `저장하지 못했습니다. 브라우저 저장 공간을 확인한 후 다시 시도해 주세요.` |
| Delete confirm title | `일정을 삭제할까요?` |
| Delete confirm message | `「{title}」 일정이 삭제되며 되돌릴 수 없습니다.` |
| Delete confirm buttons | `취소`, `삭제` |
| Delete write failure (`#confirm-alert`) | `삭제하지 못했습니다. 다시 시도해 주세요.` |
| Unreadable banner | `저장된 일정을 불러올 수 없습니다. 저장된 데이터는 변경되지 않았습니다.` |
| Banner button | `데이터 초기화` |
| Reset confirm title | `저장된 데이터를 초기화할까요?` |
| Reset confirm message | `읽을 수 없는 저장 데이터가 삭제되며 되돌릴 수 없습니다.` |
| Reset confirm buttons | `취소`, `초기화` |
| Reset write failure (`#confirm-alert`) | `초기화하지 못했습니다. 다시 시도해 주세요.` |
| S20 unreadable at write time (`#form-alert` or `#confirm-alert`) | `저장된 데이터를 읽을 수 없어 변경하지 못했습니다. 입력 내용은 유지됩니다.` |
| S21a edited event removed elsewhere (`#form-alert`) | `이 일정은 다른 곳에서 삭제되었습니다. 저장을 다시 누르면 새 일정으로 저장됩니다.` |
| S21b deleted event already removed elsewhere (`#status`, also in §8.2) | `이 일정은 다른 곳에서 이미 삭제되었습니다.` |
| S22 reset target changed, now readable (`#status`, also in §8.2) | `저장된 데이터를 다시 불러왔습니다.` |
| S22 reset target changed, still unreadable (`#confirm-alert`) | `저장된 데이터가 바뀌었습니다. 내용을 다시 확인한 후 초기화해 주세요.` |

## 9. Flow per requirement

| Requirement | Flow | States |
| --- | --- | --- |
| SCH-001 | Load, then the current month with today selected. Prev, next and today buttons change the month. A click or arrow keys select a day, and the list updates. | S1, S2, S3 |
| SCH-002 | `새 일정`, then the dialog (date = selected day), then fill and `저장`. The dialog closes, the chip and list item appear, and the status is announced. | S4, S7 |
| SCH-003 | A list item opens the edit dialog with saved values. `저장` updates the event. `삭제` opens the confirmation, where `취소` keeps the event and `삭제` removes it. If the event was removed elsewhere, an edit keeps the input and offers to save it as a new event (S21a), and a delete closes with a notice (S21b). | S5, S7, S9, S10, S11, S21a, S21b |
| SCH-004 | `저장` with invalid input shows field errors and the alert, focuses the first invalid field, and writes nothing. | S6 |
| SCH-005 | A reload restores events. Unreadable data shows the banner, and storage is untouched until a confirmed reset. A write failure keeps the dialog and input. | S7, S8, S11, S15–S18, S20, S21a, S21b, S22 |
| SCH-006 | Search and/or filter narrow the cells, `+N`, the list and the summary. With no matches, the empty texts show. `검색 조건 지우기` restores everything. | S12, S13, S14 |
| SCH-007 | Single column at 640 px or less, no horizontal scroll, one Tab stop for the grid with arrow navigation, dialogs that trap focus, close on Escape and return focus, labels with linked errors and alerts, and contrast per Section 4. | Sections 2.3, 4, 6, 7 |

## 10. Accessibility verification checklist

1. At 375×800 and 1280×800, `document.documentElement.scrollWidth <= window.innerWidth`.
2. Tab from the top of the page reaches every control in the Section 6.1 order. Each focused element shows a 3 px `#1D4ED8` outline (check the computed `outline-style` and `outline-width` under `:focus-visible`).
3. In the grid, only one `td` has `tabindex="0"`. From the 30th, ArrowRight crosses into the next month and focus lands on the 1st of that month.
4. With the event dialog open, 20 Tab presses never move `document.activeElement` outside the dialog. Escape closes it, and focus returns to the opener.
5. Every `input`, `select` and `textarea` has a non-empty accessible name. After a failed save, the invalid control's `aria-describedby` resolves to the error text.
6. The colors used match the tokens in Section 4. No text color/background pair is used outside the tables in Section 4.

## 11. Decisions on the earlier open issues

The architect settled these after architecture review, retry 1.

1. **Storage key and shape.** The key is `schedule-app.events.v1` and holds a JSON array. A reset writes `[]`. Every write re-reads the key first (§5, write protocol).
2. **`localStorage` itself unavailable.** If access throws, the result is S15 (banner, `새 일정` disabled). A reset attempt then ends in S18.
3. **Unknown category id in stored data.** This is a shape failure, so the result is S15.
4. **Mobile chips as bars.** Accepted. At 640 px or less, chips show as color bars with the titles visually hidden, plus a visible `+N`.
5. **Search summary scope.** The count covers only dates inside the visible month. Outside cells still show their own chips (§3.3).
6. **No `maxlength`.** Length limits are enforced only by validation.

No open issues remain from the designer.
