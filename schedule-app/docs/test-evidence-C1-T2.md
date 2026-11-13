# FT-SCHEDULE-001 · C1 / T2

Executed 2026-11-13 14:21:31 UTC. Test-only revision following independent review `TEST_DEFECT`: T1 did not exercise the calendar date-button handler. Product C1 is unchanged. Previous evidence: [T1](test-evidence-C1-T1.md), [immutable T1 results](../tests/results-C1-T1.json), SHA256 `9f506292901d77aa6c044f31ed1c4bfbc949786f3cdef57c4b4def311d768e9a` (unchanged).

Command from repository root: `node schedule-app/tests/verify.cjs`.

Actual output: `{"verdict":"PASS","checks":77,"browser":"Chrome/156.0.8078.81","report":"schedule-app/tests/results.json"}`; exit 0. Same Node22/Windows/real Chrome156 pipe + direct-file environment and limits as T1. No uncaught browser exceptions. Full per-check expected/actual: [immutable T2 results](../tests/results-C1-T2.json), SHA256 `d8fb2d69a8122f28d97102c7a82a85cd2f69e48af8ec860b436c34fcdcf52015`.

Added four R1 assertions through normal rendered calendar buttons, without form-save selection:

1. With today's two saved events displayed, click another in-month `.day[data-date]` button: exactly that button gains `aria-pressed=true`.
2. The selected-date heading changes to the clicked date and its agenda is empty.
3. Click today's calendar button: selected aria state returns to today's date.
4. The heading returns to today and the saved `산책`, `수정 회의` agenda returns in chronological order.

All four passed, as did all previous73 checks. A missing/no-op calendar day handler would fail these assertions even if form saves still select dates. Test source SHA256: `9f5c003ca0c813e15e45ea479c8eb7bda9f789d71085ffe2baa43cfc6b3543b9`.

Product SHA256 remains identical to approved C1/T1:

```text
dist/index.html ed0b364a75dcab7c3ac96101a5de702e86bf324cc1778fc126ec197029d00db7
dist/styles.css 85bd2dcaec4712beb13c117e71d04cd4d9395f37e374d53fe8dd456811475525
dist/model.js   a292fd8cb7ce49245222e078b4085abf559ab742a6d847442065f362d5cc5467
dist/app.js     496fd8c0fdf8bc1eda8105d50adcd2c1aeb35437939ce949b12f12631a201a9f
```

T2 screenshots archived in [tests/T2](../tests/T2/), including [desktop demonstration](../tests/T2/desktop-demo.png), [mobile demonstration](../tests/T2/mobile-demo.png), [mobile dialog](../tests/T2/mobile-dialog.png). The rerun regenerated generic PNG filenames before the screenshot-retention followup arrived; original T1 screenshot binaries were not preserved separately. T1 numerical result and evidence document are preserved, and its generic screenshot links now show the fresh C1/T2 captures. T2's archived captures remain stable. This evidence-retention limitation does not alter the tested product revision or the recorded T1/T2 assertions.

No product defect found. HTTP-origin/publication routes remain blocked by executor socket/network permissions; the direct-file browser route has no remaining required check skipped.
