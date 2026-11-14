# Schedule app product requirements

Document type · Product requirements\
Status · Active\
Updated · 2026-11-14\
Related requirements and documents · SCH-001–SCH-007, [design](../design/001_schedule_app.md), [implementation brief](../implementation/001_schedule_app.md)

Task ID · CL01-SCHED\
Base commit · `0a432183dc5c6c866dedccf1ddd53e499b5c49b1` on `test/claude_01`

## Problem and scope

The user asked for a schedule management web app (일정관리 웹앱) as a live test of the French Toast AX workflow in Claude Code. The architect chose a single-user scope with no login. Data stays in the browser's `localStorage`. This matches the scope chosen for `test/codex_01`, so the two runs can be compared. The app is a static HTML, CSS and JavaScript site in `schedule-app/` with no build step and no runtime dependencies. The UI is in Korean.

Out of scope · accounts, sync, sharing, recurring events, reminders and notifications, import and export, and time zones other than the browser's local zone.

## Requirements and acceptance criteria

| ID | Requirement | Acceptance criteria |
| --- | --- | --- |
| SCH-001 | Month calendar | AC1 · The app opens on the current month with today marked. AC2 · Previous, next and today controls change the visible month, and the heading shows the year and month. AC3 · Each day cell shows up to three of its events plus a "+N" count for the rest. AC4 · Selecting a day by mouse or keyboard makes it the selected date and lists that day's events. |
| SCH-002 | Create an event | AC1 · The user can add an event with a title, a date, all-day or start and end times, a category and optional notes. AC2 · The new event appears on the calendar and in the list without a reload. AC3 · The add form defaults its date to the selected day. |
| SCH-003 | Edit and delete | AC1 · Opening an event shows its saved values, and saving changes updates the calendar and list. AC2 · Deleting asks for confirmation, and cancelling keeps the event. |
| SCH-004 | Validation | AC1 · An empty or whitespace-only title, a missing date, or an end time not after the start time blocks saving and shows an error next to the field. AC2 · A title over 100 characters or notes over 1000 characters cannot be saved. AC3 · A blocked save changes no stored data. |
| SCH-005 | Persistence and storage failure | AC1 · Events survive a page reload. AC2 · If stored data cannot be parsed or has the wrong shape, the app shows a recoverable error, keeps the original stored value unchanged, and does not overwrite it until the user chooses to reset. AC3 · If writing to storage fails, for example because the quota is exceeded, the app shows an error, keeps the form open with the user's input, and does not report success. |
| SCH-006 | Search and filter | AC1 · A text search matches title and notes, ignoring case. AC2 · A category filter limits the calendar and list to that category. AC3 · Search and filter combine, and clearing them restores all events. AC4 · When nothing matches, an empty state message appears. |
| SCH-007 | Responsive and accessible | AC1 · The layout works at 375 px and 1280 px widths without horizontal page scroll. AC2 · All actions work by keyboard, focus is visible, the dialog traps focus and returns it on close, and Escape closes it. AC3 · Form controls have labels, and errors are announced to assistive technology. AC4 · Text contrast is at least 4.5:1. |

Events within a day are ordered with all-day events first, then by start time, then by title.

## Regressions

The change adds only files under `schedule-app/` and the report at the top of `README.md`. The existing French Toast plugin, documents and English README content must remain unchanged.
