# Schedule app verification record (run T1)

Document type · Test evidence\
Status · Executed / All required checks passed\
Updated · 2026-11-14\
Related requirements and documents · SCH-001–SCH-007, [PRD](../prd/product.md), [design](../design/001_schedule_app.md), [implementation brief](../implementation/001_schedule_app.md), [test evidence skill](../../../.claude/skills/ax-test-evidence/SKILL.md)

Task ID · CL01-SCHED\
Run · T1 (first test run, by `tester`)\
Base commit and verified scope · `0a432183dc5c6c866dedccf1ddd53e499b5c49b1` on `test/claude_01`. Nothing is committed. The verified scope is the untracked `schedule-app/` tree at the code-approved revision C2. The `git hash-object` values below were checked before the run and again after it, and they were unchanged.\
Previous result · None. This is the first record.

| File (product revision C2) | Blob hash |
| --- | --- |
| `index.html` | `0bdaccfed00ad783b2bac232caf72ed0b0f7d3ca` |
| `styles.css` | `badc057f5b1a8600599ce4271cfa86c99c3b2ba2` |
| `src/model.js` | `3a2037477eaba50a3651bb41a4170bf47fee1067` |
| `src/storage.js` | `6e521d4e3c475e5564e0bbe37e5793af4692287f` |
| `src/app.js` | `6c4ad46f505178e2333f6023b55d41b60d08be06` |
| `README.md` (schedule-app) | `cd7c90b79fb7c715e104c86ebb3a6023f4cfe808` |
| Inputs: PRD / design / brief | `d025f79b…` / `8d7e23c2…` / `3d4b8ff7…` |

| File (test revision T1) | Blob hash |
| --- | --- |
| `tests/unit/index.js` | `dae474636ab9f9eba89bea52c4eb32e99d5c9b3b` |
| `tests/unit/model.test.js` | `3152d88329f878ef94c0a1c2ce720dd64480aea0` |
| `tests/unit/storage.test.js` | `4e13a7935517d29a75fb1e4ea32e80d3c930fe8f` |
| `tests/e2e/cdp.js` | `6e21b42afa2ca82dc8a25e73b3d0ff11decbcf96` |
| `tests/e2e/run.js` | `33538781c136e40b385c1016d955bc76aea62785` |
| `tests/regression/check.js` | `4114bc1e0ffdcadbbb405f49e14cba6744f0e4e9` |

## Environment and commands

- Windows 11 Home 10.0.26300, Node `v22.19.0`, Chrome `156.0.8078.81` at `C:/Program Files/Google/Chrome/Application/chrome.exe`, run with `--headless=new`, a temporary `--user-data-dir` and a random remote-debugging port. No npm packages were used.
- Clock · `Date` was overridden through `Page.addScriptToEvaluateOnNewDocument` to local 2026-11-14 10:00, advancing in real time. The time zone was set with `Emulation.setTimezoneOverride` to `Asia/Seoul`. Focus emulation was on.
- Input · Keys and clicks were real CDP `Input.dispatchKeyEvent` and `Input.dispatchMouseEvent` events, with elements scrolled into view first. Text went in through `Input.insertText`. Date, time and select values were set through `.value` and then fired `input` and `change` events.
- Viewports · 1280×800 and 375×800 (mobile emulation). The Space no-scroll check used 375×400 so the page could scroll.
- Second tab · simulated by a direct `localStorage.setItem` between opening a dialog and pressing the button. Blocked storage · a `window.localStorage` getter that throws `SecurityError`, injected with `Page.addScriptToEvaluateOnNewDocument`. Quota failure · `Storage.prototype.setItem` stubbed to throw `QuotaExceededError`, then restored.

Commands, run from `D:\french-toast`:

```text
node --test schedule-app/tests/unit/                               # exit 0, 36/36
node --test --test-reporter=spec "schedule-app/tests/unit/*.test.js" # exit 0, 36/36 (same tests, glob form)
node schedule-app/tests/regression/check.js                        # exit 0, 4/4
node schedule-app/tests/e2e/run.js --mode=file                     # exit 0, 208/208 (primary target)
node schedule-app/tests/e2e/run.js --mode=http                     # exit 0, 208/208 (node:http static server)
```

Totals · 456 checks executed (36 unit, 4 regression, 208 file://, 208 HTTP). 456 passed, 0 failed, 0 skipped.

Evidence files in `schedule-app/tests/T1/`:
- `unit-output.tap`, `unit-output-glob.txt`
- `regression-results.json`, `regression-output.txt`
- `e2e-results-file.json`, `e2e-results-http.json`, `e2e-output-*.txt`. Each check has an id, requirement, viewport, expected value, actual value and verdict. The contrast pairs for each state are included.
- `screenshots-file/*.png`, `screenshots-http/*.png`

Check ids in the table refer to `e2e-results-file.json`. The HTTP run repeats the same ids with the same verdicts.

## Results

| Requirement ID | Command or UI steps | Preconditions and environment | Expected result | Actual result | Verdict | Evidence |
| --- | --- | --- | --- | --- | --- | --- |
| SCH-001 AC1 (S1) | Load with no key | Empty storage, clock 2026-11-14 | Heading `2026년 11월`, one `aria-current="date"` cell, selected, tabindex 0, label `2026년 11월 14일 토요일, 일정 없음, 오늘`, marker `#1D4ED8`, 5 rows, `이 날에는 일정이 없습니다.`, no focus move, no write | As expected (key still `null` after load) | Pass | S1-*, `S1-desktop-empty.png` |
| SCH-001 AC2 | Click 다음 달 ×2, 이전 달 ×3, click 10-31 then 다음 달, then 오늘 | Desktop | `2026년 12월`, `2027년 1월`, `2026년 10월`. 10-31 clamps to 11-30. 오늘 returns to 11-14. Focus stays on each button | As expected | Pass | NAV-* |
| SCH-001 AC3 (S2) | Seed 5 events on 11-14 (2 all-day, 3 timed, out of order), plus 12-01 and 11-07 | 1280 and 375 | Chips `종일A`, `종일B`, `08:00 가나`, then `+2`. The list has 5 items in PRD order. Label `…, 일정 5개, 오늘`. The outside cell 12-01 shows its own chip. The notes preview is 80 chars plus `…`. On mobile, chips are 6 px bars with hidden titles, and `+N` stays visible | As expected at both widths | Pass | AC3-*, `S2-populated-*.png` |
| SCH-001 AC4 mouse | Click 11-20, then click the outside cell 12-01 | Desktop | Selected, `11월 20일 (금) 일정`, list updated. The outside click switches to 12월 | As expected | Pass | SEL-mouse, SEL-mouse-outside |
| SCH-001 AC4 keyboard | From 11-14: →, ←, ↓, ↑, Home, End, PageDown, PageUp. From 11-30: →. From 12-31: PageDown ×2. Enter and Space on 11-20 | Desktop. Enter and Space at 375×400 | Focus, `aria-selected`, the single tabindex 0 and the day heading move together. → from 11-30 lands on 12-01 with focus in the grid. 2027-01-31 PageDown goes to 2027-02-28. Enter and Space keep the selection, and Space does not scroll the scrollable page | As expected | Pass | SEL-key-*, SEL-cross, SEL-pgdn-clamp, SEL-enter, SEL-space |
| SCH-002 AC1–AC3 (S4, S7) | Select 11-20, then 새 일정 → fill → 저장. Add an all-day event dated 12-24. Keyboard-select 11-22, then 새 일정. Escape | Desktop, empty storage | Defaults: date = selected day, 09:00/10:00, 업무, no 삭제, focus on title. After save: chip `13:00 프로젝트 회의`, list item, `일정을 추가했습니다.`, focus on `#new-event`, stored record matches the form. All-day hides the times and stores `null`. The month follows the event date. The keyboard-selected day is the default | As expected | Pass | S4-*, S7-*, `S4-add-dialog-1280.png` |
| SCH-003 AC1 (S5, S7) | Open a seeded event, change title and date, 저장. Open an all-day event | Seed with an extra field | Every field holds the saved values and the title is `일정 수정`. After save: status `일정을 수정했습니다.`, the event moves to 11-16, same id, `createdAt` and the extra field kept, `updatedAt` changed, focus on the item. The all-day event opens with 09:00/10:00 hidden | As expected | Pass | S5-*, S7-edit* |
| SCH-003 AC2 (S9, S10) | 삭제 → 취소. 삭제 → Escape. 삭제 → 삭제 | Desktop | Confirm `일정을 삭제할까요?` / `「가족 행사」 일정이 삭제되며 되돌릴 수 없습니다.`, focus on 취소. Cancel and Escape keep the event, the edit dialog stays open, and focus returns to 삭제. Confirm removes the event, shows `일정을 삭제했습니다.` and moves focus to `#day-heading` | As expected | Pass | S9-*, S10, `S9-confirm-1280.png` |
| SCH-004 AC1 | Title `   `. End = start (10:00/10:00). End before start. Empty start. Empty end. Empty date. Several errors at once | Seeded raw string, pass-through `setItem` spy | Exact §8.3 messages in `<field>-error`, `aria-invalid="true"`, `aria-describedby` linked, `입력 내용을 확인해 주세요.`, focus on the first invalid field. Errors clear on input | As expected | Pass | S6-* |
| SCH-004 AC2 | Title of 101 ASCII and of 101 emoji. Notes of 1001 ASCII and of 1001 emoji. Then 100 emoji and 1000 emoji. Then a 100-char title padded with spaces | As above | 101/1001 blocked with exact messages, counters `101/100` (in `#B91C1C`) and `1001/1000`. 100/1000 code points save. The padded title is trimmed and saves | As expected | Pass | S6-title101-*, S6-notes1001-*, S6-boundary-save, S6-trim-save, unit tests |
| SCH-004 AC3 | Raw string and `setItem` count after each blocked save | As above | Raw byte-identical, 0 `setItem` calls | Identical, 0 calls until the first valid save (then 1) | Pass | `raw`/`writes` fields in S6-* |
| Code review F1 (year 0026) | Add an event dated `0026-11-14`. Unit tests on `weekdayOf`, `buildMonthGrid(26, 10)`, `0000-02-29` | Desktop | Heading `26년 11월`. Weekday and grid computed from an independent proleptic Gregorian formula, not shifted to 1926. Stored date `0026-11-14` | As expected | Pass | Y0026, `Y0026-1280.png`, model.test.js |
| SCH-005 AC1 | Add, reload, select the day | Desktop | Chip and list item still present | As expected | Pass | SCH005-reload |
| SCH-005 AC2 (S15, S16) | Seed `{not json`, a non-array, an unknown category, duplicate ids, pretty-printed bad JSON with CRLF, an untrimmed title. Navigate months, search and filter, open reset then 취소 and Escape, reload | 1280 and 375 | The banner text is not in the `index.html` source. After load, the exact banner text and `데이터 초기화` appear, `새 일정` is disabled, there are no chips and the empty-day text shows. The raw value stays byte-identical throughout. The reset confirm has the exact strings and focus on 취소. Cancel returns focus to the banner button. An extra unknown field is accepted | As expected | Pass | S15-*, S16-*, `S15-banner-*.png` |
| SCH-005 AC2 (S17) | Confirm 초기화 | Unreadable seed | Raw `[]`, banner gone, `새 일정` enabled, focus on `#new-event`, status `저장 데이터를 초기화했습니다.` | As expected at both widths | Pass | S17-* |
| SCH-005 blocked storage (S15 → S18) | Seed valid data, inject a throwing `window.localStorage` getter, reload, 데이터 초기화 → 초기화. Remove the script and reload | Desktop | The getter throws `SecurityError`. S15 banner, `새 일정` disabled. Reset ends in S18: confirm open, `초기화하지 못했습니다. 다시 시도해 주세요.`, banner stays, focus on 초기화. The original raw value is unchanged afterwards | As expected | Pass | BLK-*, S15-blocked, S18-blocked, `S18-blocked-1280.png` |
| SCH-005 S18 (quota) | Seed `{x`, stub `setItem`, 초기화. Then restore it and retry | Desktop | S18 alert, banner, raw `{x`, focus on 초기화. The retry reaches S17 | As expected | Pass | S18-quota, S18-retry |
| SCH-005 AC3 (S8) | Add: fill the form, stub `setItem`, 저장. Edit: change the title, stub, 저장 | Desktop | Dialog stays open with all input kept, exact S8 text, `#status` empty, no new chip or list change, focus on 저장, raw unchanged. The retry after restoring succeeds | As expected | Pass | S8-*, `S8-save-failure-1280.png` |
| SCH-005 S11 | Edit → 삭제 → stub → 삭제 | Desktop | Confirm stays open with `삭제하지 못했습니다. 다시 시도해 주세요.`, event kept, focus on confirm 삭제. 취소 returns to the edit dialog | As expected | Pass | S11, S11-cancel |
| S20 | Open add, edit or delete confirm, then a second tab writes `{bad`, then press 저장 or 삭제. Escape, then reset | Desktop | Nothing written, input kept, exact S20 text in `#form-alert` or `#confirm-alert`, banner shown, `새 일정` disabled, focus on the pressed button. Escape focuses `데이터 초기화`. The reset against the new baseline writes `[]` | As expected | Pass | S20-*, `S20-add-1280.png` |
| S21a | Edit A → title `B` → a second tab writes `[C, D]` → 저장 → 저장. A separate run uses Escape | Desktop | No write, exact S21a text, title `새 일정`, 삭제 hidden, list re-rendered (`C`, `D`), focus on 저장, status empty. The second 저장 adds one `B` with a new id and keeps C and D. Escape focuses `#day-heading` | As expected | Pass | S21a*, `S21a-1280.png` |
| S21b | Edit A → 삭제 → a second tab writes `[C, D]` → 삭제 | Desktop | Both dialogs close, no write, list re-rendered, `이 일정은 다른 곳에서 이미 삭제되었습니다.`, focus on `#day-heading` | As expected | Pass | S21b |
| Re-read before write (brief F2) | Create while a second tab added C and D. Edit while a second tab added a field to A | Desktop | No events lost. The other tab's events appear. The added field is kept on edit | As expected | Pass | CONC-create, CONC-edit |
| S22a / S22b | Seed `{a`, open the reset confirm, a second tab writes a valid array (a) or `{b` (b), 초기화. For (b), 초기화 again | Desktop | (a) No write, banner gone, the event renders, `저장된 데이터를 다시 불러왔습니다.`, focus on `#new-event`. (b) Raw `{b`, exact S22b alert, banner stays, focus on 초기화, and the second 초기화 writes `[]` | As expected | Pass | S22a, S22b*, `S22b-1280.png` |
| SCH-006 AC1–AC4 (S12–S14) | Search `MEETING`, add filter 건강, clear the search, filter 개인 on 11-14, search `zzzz`, 검색 조건 지우기. Filter 건강 on a day with 5 events | 1280 and 375 | Case-insensitive title and notes matches. The summary counts the visible month only (`이번 달 검색 결과 2개`) while the outside cell keeps its chip. Filters combine. `#status` repeats the summary after the pause. No-match texts are exact. Clear restores all chips, resets both controls, hides the summary and focuses `#search`. `+N` counts matches only | As expected | Pass | S12-*, S13-*, S14-*, `S13-no-results-*.png` |
| SCH-007 AC1 | Measure `scrollWidth`, `clientWidth` and `innerWidth` with 100-char unbroken titles and 1000-char notes, with the dialog open and in the banner state. Check columns and dialog fit | 1280×800 and 375×800 | `scrollWidth <= clientWidth`. Two columns with a 360 px panel at 1280, one column at 375. Dialog gutters ≥ 16 px, width ≤ 560 px | 1280: 1265/1265 (15 px scrollbar). 375: 375/375. Dialog 560 px and 337 px (see note 2) | Pass | L-*, S15-hscroll-*, `L-*.png` |
| SCH-007 AC2 | Tab ×9 from load. Tab with a search active and in the banner state. Enter on 새 일정, 20 Tab and 20 Shift+Tab, Enter to submit. Enter on an item, then Escape. Keyboard delete. Enter on 다음 달 | Desktop | Tab order as in §6.1, with the grid as one stop and the disabled `새 일정` skipped. Each stop has `:focus-visible` with a 3 px solid `rgb(29, 78, 216)` outline. Focus never leaves the dialogs. Escape returns focus to the opener. Create, edit and delete all work by keyboard alone | As expected | Pass | K-* |
| SCH-007 AC3 | Label every control. Check the roles of live regions. Check `aria-describedby` after an error | Desktop | Each input, select and textarea has a non-empty `<label for>`. The month wrapper is `polite`. `#status` is `status`. The banner and alerts are `alert`. `aria-describedby` resolves to the error text and the counter | As expected | Pass | A11Y-labels, S1-live, S6-describedby |
| SCH-007 AC4 | Read every visible text node's rendered color and effective background (alpha composited) in 15 states. Check the `::placeholder` color | 1280 and 375 | Every non-disabled pair ≥ 4.5:1, and every pair is a §4 token pair | 17 distinct pairs observed. The minimum is 5.48 (`#FFFFFF` on `#047857`). The ratios equal the §4 values. The placeholder is `#6B7280` (4.83:1). Disabled `새 일정` is 6.87:1 | Pass | C-*, `contrast` in the JSON |
| Design §8 strings | Compare the static text and every state string exactly | — | Exact §8.1–§8.4 strings | All matched | Pass | STR-1 and the state checks above |
| S19 | Load with `Emulation.setScriptExecutionDisabled` | Desktop | `이 앱을 사용하려면 JavaScript를 켜 주세요.` visible | Visible | Pass | S19, S19-src |
| Regression (page) | Listen for `Runtime.exceptionThrown` for the whole run | Both modes | No uncaught exceptions | None | Pass | EXC |
| Regression 1 | `git diff --name-only 0a432183… -- . ':!schedule-app'` | Repository root | At most `README.md` | Empty | Pass | `regression-results.json` R1 |
| Regression 2 | `git status --porcelain --untracked-files=all -- . ':!schedule-app'` | Repository root | At most `README.md` | Empty | Pass | R2 |
| Regression 3 | Normalize CRLF to LF in the base and current root `README.md`, check the suffix, the inserted block and the first base line | Repository root, report not yet written | The base is an exact suffix, and any inserted block ends with `\n` and has no `# ` heading | Suffix true, inserted length 0 (README unchanged) | Pass on the unchanged README. Pending architect re-run after the report is written | R3 |

## Notes, corrections and limits

1. Test defects fixed during this run, before the recorded run (no product change):
   - The brief's literal command `node --test schedule-app/tests/unit/` fails on Node 22, which loads a directory argument as a module. `tests/unit/index.js` makes the literal command work. The glob form runs the same 36 tests.
   - The layout checks first compared an object that included the raw measurements, so they reported false failures. The measurements are now recorded separately.
   - `L-dialog-fit-375` first expected a rendered width of exactly `min(560px, 100vw - 32px)` = 343 px. See note 2.
   - The Space no-scroll check first ran on a page that could not scroll, so it proved nothing. It now runs at 375×400 and asserts that the page is scrollable.
2. At 375 px, `styles.css` declares the §2.3 width (`min(560px, calc(100vw - 32px))`), but Chrome's UA rule for modal dialogs (`max-width: calc(100% - 2em - 6px)`) renders 337 px, with 19 px gutters. The dialog fits and there is no horizontal scroll, so SCH-007 AC1 holds. This is recorded as a minor visual difference from the §2.3 figure, not as a failure.
3. Not observed in any swept state: the §4 pairs `#1F2937` on `#EFF6FF` (non-weekend selected day number) and Sunday `#B91C1C` on `#F9FAFB` and on `#EFF6FF`. Their computed §4 ratios are ≥ 5.95:1. The sweep would have checked them if they had been rendered.
4. Limits:
   - Screen reader output was not tested. Announcements are verified through roles, `aria-*` attributes and the timed text changes.
   - Native date and time pickers were not driven. Values were set through the DOM with real `input` and `change` events.
   - The second tab is a direct `localStorage` write in the same page, so the app's handling of a cross-tab `storage` event was not tested.
   - Hover styles were not tested.
