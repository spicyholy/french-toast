# Schedule app verification rerun (run T2)

Document type · Test evidence\
Status · Executed / All required checks passed\
Updated · 2026-11-14\
Related requirements and documents · SCH-001–SCH-007, [PRD](../prd/product.md), [design](../design/001_schedule_app.md), [implementation brief](../implementation/001_schedule_app.md), [test evidence skill](../../../.claude/skills/ax-test-evidence/SKILL.md)

Task ID · CL01-SCHED\
Run · T2 (workflow retry 4), after test review of T1 returned PRODUCT_FAILURE and TEST_DEFECT\
Previous result · [001_schedule_app_verification.md](001_schedule_app_verification.md) (run T1 on product revision C2). That record and `tests/T1/` are left unchanged.\
Base commit and verified scope · `0a432183dc5c6c866dedccf1ddd53e499b5c49b1` on `test/claude_01`. Nothing is committed. The verified scope is the untracked `schedule-app/` tree at the code-approved revision C3. Hashes were checked before the run and recorded again by the harness during it.

| File (product revision C3) | Blob hash | Change from C2 |
| --- | --- | --- |
| `index.html` | `0bdaccfed00ad783b2bac232caf72ed0b0f7d3ca` | none |
| `styles.css` | `4c750d53c9dfbc7db8c8a56712238e944cd131f8` | was `badc057f…`. Adds `max-width: none` to `dialog` |
| `src/model.js` | `3a2037477eaba50a3651bb41a4170bf47fee1067` | none |
| `src/storage.js` | `6e521d4e3c475e5564e0bbe37e5793af4692287f` | none |
| `src/app.js` | `6c4ad46f505178e2333f6023b55d41b60d08be06` | none |
| `README.md` (schedule-app) | `cd7c90b79fb7c715e104c86ebb3a6023f4cfe808` | none |

| File (test revision T2) | Blob hash | Change from T1 |
| --- | --- | --- |
| `tests/unit/index.js` | `dae474636ab9f9eba89bea52c4eb32e99d5c9b3b` | none |
| `tests/unit/model.test.js` | `3152d88329f878ef94c0a1c2ce720dd64480aea0` | none |
| `tests/unit/storage.test.js` | `4e13a7935517d29a75fb1e4ea32e80d3c930fe8f` | none |
| `tests/e2e/cdp.js` | `6e21b42afa2ca82dc8a25e73b3d0ff11decbcf96` | none |
| `tests/e2e/run.js` | `441a5f21bda98d3c4fef698dcc25142fa53f956d` | was `33538781…`. Changes F1–F3 and the non-blocking items below |
| `tests/regression/check.js` | `4114bc1e0ffdcadbbb405f49e14cba6744f0e4e9` | none |

## Environment and commands

The environment matches T1: Windows 11 Home 10.0.26300, Node `v22.19.0`, Chrome `156.0.8078.81` with `--headless=new`, a temporary `--user-data-dir` and a random port. The clock is local 2026-11-14 10:00, advancing, with time zone `Asia/Seoul`. Input is real CDP input events. Viewports are 1280×800, 375×800 (mobile emulation), and 375×400 for the Space check.

New in T2: before any page script runs, an init script wraps `Storage.prototype.setItem` and records every write to `schedule-app.events.v1` in `window.__lsWrites`. Harness seeding and the simulated "second tab" call the original `setItem`, so the list holds only the app's own writes since the current page loaded.

Commands, run from `D:\french-toast`:

```text
node --test schedule-app/tests/unit/                                    # exit 0, 36/36
node --test --test-reporter=spec "schedule-app/tests/unit/*.test.js"      # exit 0, 36/36 (same tests)
node schedule-app/tests/regression/check.js --out=schedule-app/tests/T2 # exit 0, 4/4
node schedule-app/tests/e2e/run.js --mode=file --out=schedule-app/tests/T2  # exit 0, 238/238 (primary)
node schedule-app/tests/e2e/run.js --mode=http --out=schedule-app/tests/T2  # exit 0, 238/238
```

Totals · 516 checks executed (36 unit, 4 regression, 238 file://, 238 HTTP). 516 passed, 0 failed, 0 skipped. Compared with T1, the e2e suite adds 32 checks and drops the two weakened `L-dialog-fit-*` checks. All other T1 checks are repeated unchanged.

Raw outputs are in `schedule-app/tests/T2/`:
- `unit-output.tap`, `unit-output-glob.txt`, `regression-results.json`, `regression-output.txt`
- `e2e-results-{file,http}.json`, `e2e-output-{file,http}.txt`, `screenshots-{file,http}/`
- `mutants/` with each mutant's diff, output and results JSON

## Test changes for the T1 review findings

| Finding | Defect in T1 | Change in T2 |
| --- | --- | --- |
| F1 dialog width | `L-dialog-fit-*` accepted any width ≤ 560 px with gutters ≥ 16 px. That accepted the 337 px dialog (19 px gutters) that design §2.3 does not allow, and I recorded it as a note instead of a failure. | New checks `L-event-dialog-width-*` and `L-confirm-dialog-width-*`. Expected width is `min(560, innerWidth − 32)` ±1 px, using only the viewport width. At 375 px (mobile emulation, `innerWidth === clientWidth` asserted, so no scrollbar) the left and right gutters must each be 16 ±1 px. At 1280 px only the width is asserted, because the desktop scrollbar shifts the visual centre by design (100vw). |
| F2 S22b | The expected alert was `al === S.s22b ? S.s22b : al`, which equals the actual value whatever it is. | The expected value is the literal §8.4 string `S.s22b`. |
| F3 no-write in S15 | "Unchanged" was shown only through raw-value equality, so a same-bytes rewrite would pass. | A spy installed before load records writes. `W-*` checks assert `[]` after load, month navigation, search and filter, reset cancel and Escape, and reload. They also assert `[]` across every unreadable shape (`S15-<shape>`) and for blocked storage (load, cancel, reset attempt, and after unblocking). A confirmed reset must record exactly `["[]"]` (`W-S17-*`). The S22a, S22b and S22b-second checks now also assert `[]`, `[]` and `["[]"]`. |
| Non-blocking: contrast | Three §4 pairs were never rendered in a sweep. | Sweeps of a selected Wednesday (11-18), a selected Sunday (11-15), and the December grid with the outside-month Sunday 11-29 (cell position asserted), at both widths. `C-extra-pairs-*` requires all three pairs to be rendered and ≥ 4.5:1. |
| Non-blocking: S15 shape loop | `banner: shown === … \|\| visible(...)` accepted any visible banner. | The shape loop asserts the exact banner message and button label, with `hidden: false`, after navigation, search, filter and clear. |
| Harness | `check()` compared `JSON.stringify` output, which depends on key order. | `check()` now uses a key-sorted canonical JSON. Keys whose value is `undefined` are dropped, as `JSON.stringify` drops them, so a missing key still differs from `null`. |

## Mutation sanity checks

Each mutant is a copy of `schedule-app/` (product and tests) in the session scratch directory, outside the repository. Only the listed line was changed. The repository product was not modified. Each mutant ran with the T2 `run.js` from its copy, in file mode.

| Mutant | Change | Scenarios run | Expected | Actual | Verdict |
| --- | --- | --- | --- | --- | --- |
| m1 wrong S22b text | `app.js` S22b string changed to `저장된 데이터가 바뀌었습니다. 다시 확인해 주세요.` | `S22` | `S22b` fails | 4 checks, 1 failed: `S22b` (actual alert is the wrong text) | Killed |
| m2 same-bytes startup write | `app.js` gets a first line that reads the key and writes the same bytes back | `S15`, `blocked`, `S22` | F3 write checks fail even though raw stays byte-identical | 48 checks, 17 failed: `W-S15-load-nav`, `W-S16-cancel`, `W-S15-reload` and `W-S17` at both widths, all five `S15-<shape>`, `W-blocked-after`, `S22a`, `S22b`, `S22b-second`. The `W-blocked-*` checks with storage blocked still pass, because the throwing getter leaves no Storage object to write to | Killed |
| m3 UA max-width | `styles.css` line 506 `max-width: none;` removed (only the dialog rule) | `layout` | Width check fails at 375 | 15 checks, 2 failed: `L-event-dialog-width-375` and `L-confirm-dialog-width-375` (337 px, 19 px gutters) | Killed |

## Results

Check ids refer to `tests/T2/e2e-results-file.json`. The HTTP run has the same ids and verdicts. Rows that T1 already covered and that T2 repeats unchanged are summarised in the last row. Their expectations and steps are in [001](001_schedule_app_verification.md).

| Requirement ID | Command or UI steps | Preconditions and environment | Expected result | Actual result | Verdict | Evidence |
| --- | --- | --- | --- | --- | --- | --- |
| SCH-007 AC1 / design §2.3 (F1) | Open the edit dialog, then 삭제 for the confirm dialog. Measure each dialog's rect, `innerWidth` and `clientWidth` | 375×800 mobile emulation and 1280×800, a 1000-char note | 375: width 343 ±1, left and right gutters 16 ±1, no scrollbar. 1280: width 560 ±1 | 375: event and confirm dialogs 343 px, gutters 16/16, `innerWidth = clientWidth = 375`. 1280: both 560 px (left 352.5, right 367.5 with the 15 px scrollbar) | Pass | `L-event-dialog-width-*`, `L-confirm-dialog-width-*`, `L-dialog-*.png` |
| SCH-005 AC2 / S15, S16 (F3) | Seed `{not json`. Load, change month, search, filter, clear. Reset → 취소, reset → Escape. Reload. Confirm reset | 1280 and 375, write spy | Writes `[]` at each step before the confirmed reset, then exactly `["[]"]` | As expected at both widths | Pass | `W-S15-load-nav-*`, `W-S16-cancel-*`, `W-S15-reload-*`, `W-S17-*` |
| SCH-005 AC2 shapes (F3, exact banner) | For each of non-array, unknown category, duplicate ids, pretty-printed bad record with CRLF, and untrimmed title: load, change month, search, filter, clear | 1280, write spy | Banner `{hidden: false, text: §8.4 banner, btn: 데이터 초기화}`, raw byte-identical, `새 일정` disabled, writes `[]` | As expected for all five | Pass | `S15-non-array`, `S15-unknown-category`, `S15-duplicate-ids`, `S15-bad-record-pretty`, `S15-untrimmed-title` |
| SCH-005 blocked storage (F3) | Throwing `localStorage` getter: load, reset → 취소, reset → Escape, reset → 초기화. Remove the script and reload | 1280, write spy | Writes `[]` throughout. S15, then S18 as in T1. After unblocking, raw is byte-identical and writes are `[]` | As expected | Pass | `W-blocked-*`, `S15-blocked`, `S18-blocked`, `BLK-raw` |
| S22a / S22b (F2, F3) | Seed `{a`, open the reset confirm, a second tab writes a valid array (a) or `{b` (b), 초기화. For (b), 초기화 again | 1280, write spy | (a) Writes `[]`, otherwise as in T1. (b) Alert exactly `저장된 데이터가 바뀌었습니다. 내용을 다시 확인한 후 초기화해 주세요.`, writes `[]`. The second 초기화 writes exactly `["[]"]` | As expected | Pass | `S22a`, `S22b`, `S22b-second` |
| SCH-007 AC4 (non-blocking item) | Select 11-18 (Wed) and 11-15 (Sun) and sweep. Go to 12월 and sweep with the outside Sunday 11-29 | 1280 and 375 | `#1F2937` on `#EFF6FF`, `#B91C1C` on `#EFF6FF` and `#B91C1C` on `#F9FAFB` are rendered and ≥ 4.5:1. Every swept pair is a §4 token pair | All three rendered and ≥ 4.5:1 at both widths. All sweeps pass both the ratio and token checks | Pass | `C-selected-weekday-*`, `C-selected-sun-*`, `C-outside-sun-*`, `C-extra-pairs-*`, `contrast` in the JSON |
| SCH-001 to SCH-007, S1–S22, design §8 strings, year 0026, page exceptions (repeated from T1) | All T1 scenarios rerun on C3 with the T2 harness | Both modes | As in [001](001_schedule_app_verification.md) | All 206 repeated checks pass in both modes | Pass | `tests/T2/e2e-results-*.json` |
| Unit (model, storage) | `node --test schedule-app/tests/unit/` | Node 22.19.0 | 36 pass | 36 pass, 0 fail, 0 skipped | Pass | `tests/T2/unit-output.tap` |
| Regression 1 and 2 | `git diff --name-only 0a432183… -- . ':!schedule-app'` and `git status --porcelain --untracked-files=all -- . ':!schedule-app'` | Repository root | At most `README.md` | Empty for both | Pass | `tests/T2/regression-results.json` R1, R2 |
| Regression 3 | Normalize CRLF to LF in the base and current root `README.md`, then check the suffix and the inserted block | Repository root, report not yet written | The base is an exact suffix, and any inserted block ends with `\n` and has no `# ` heading | Suffix true, inserted length 0 | Pass on the unchanged README. Pending architect re-run after the report is written | R3 |

## Notes and limits

1. T1 note 2 (the 337 px dialog recorded as a minor visual difference) was a test defect. It accepted a deviation from design §2.3. On C3 the design-derived check passes, and on the reverted CSS (mutant m3) it fails.
2. The spy wraps `Storage.prototype.setItem`. A write through another API, such as `removeItem` or `clear`, would not be recorded. Raw-value equality checks still cover removal, because a removed key reads as `null`, not the seeded string.
3. The T1 limits remain: screen reader output was not tested, native pickers were not driven, the cross-tab `storage` event was not tested, and hover styles were not tested.
