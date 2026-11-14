/*
 * Schedule app domain model (CL01-SCHED, SCH-001, SCH-004, SCH-006).
 * Pure logic with no DOM access, so Node tests can require() it and the
 * browser can load it as a classic script over file://.
 */
(function () {
  'use strict';

  // Fixed category list in design §4 order; stored records hold the id only.
  const CATEGORIES = Object.freeze([
    Object.freeze({ id: 'work', label: '업무', color: '#1E40AF' }),
    Object.freeze({ id: 'personal', label: '개인', color: '#7E22CE' }),
    Object.freeze({ id: 'health', label: '건강', color: '#047857' }),
    Object.freeze({ id: 'other', label: '기타', color: '#4B5563' })
  ]);

  // Category ids alone, used by validation and the record shape check.
  const CATEGORY_IDS = Object.freeze(CATEGORIES.map(function (category) { return category.id; }));

  // Length limits from SCH-004 AC2, counted in Unicode code points.
  const TITLE_MAX = 100;
  // Notes limit from SCH-004 AC2.
  const NOTES_MAX = 1000;

  // Korean weekday abbreviations, Sunday first (design §1 week start).
  const WEEKDAYS = Object.freeze(['일', '월', '화', '수', '목', '금', '토']);

  // Exact Korean validation messages from design §8.3.
  const MESSAGES = Object.freeze({
    titleEmpty: '제목을 입력해 주세요.',
    titleTooLong: '제목은 100자 이하로 입력해 주세요.',
    dateInvalid: '날짜를 선택해 주세요.',
    startEmpty: '시작 시간을 입력해 주세요.',
    endEmpty: '종료 시간을 입력해 주세요.',
    endNotAfterStart: '종료 시간은 시작 시간보다 늦어야 합니다.',
    notesTooLong: '메모는 1000자 이하로 입력해 주세요.',
    // Not reachable from the UI select; guards the record contract for other callers.
    categoryInvalid: '분류를 선택해 주세요.'
  });

  // Strict date and time patterns; real-calendar checks follow separately.
  const DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;
  // 24-hour HH:MM with no seconds, matching <input type="time"> output.
  const TIME_PATTERN = /^([01]\d|2[0-3]):([0-5]\d)$/;

  /** Counts code points so surrogate pairs count once (design §3.5). */
  function codePointLength(text) {
    return Array.from(String(text)).length;
  }

  /**
   * Returns a UTC timestamp for a calendar date. setUTCFullYear is used instead
   * of Date.UTC because Date.UTC maps years 0–99 to 1900–1999 (review F1).
   * Month and day may overflow; Date normalizes them as usual.
   */
  function utcTime(year, monthIndex, day) {
    // Epoch date whose fields are then replaced in full, with no 1900 offset.
    const date = new Date(0);
    date.setUTCFullYear(year, monthIndex, day);
    return date.getTime();
  }

  /** Returns the number of days in a month (monthIndex 0–11), using UTC to avoid DST shifts. */
  function daysInMonth(year, monthIndex) {
    // Day 0 of the next month is the last day of this month.
    return new Date(utcTime(year, monthIndex + 1, 0)).getUTCDate();
  }

  /** Zero-pads a number to two digits for date and time strings. */
  function pad2(value) {
    return String(value).padStart(2, '0');
  }

  /** Formats year, month (1–12) and day as a local YYYY-MM-DD string. */
  function formatDate(year, month, day) {
    return String(year).padStart(4, '0') + '-' + pad2(month) + '-' + pad2(day);
  }

  /** Parses YYYY-MM-DD into numbers, or returns null when it is not a real calendar date. */
  function parseDate(text) {
    // Only strings can be dates; anything else is rejected.
    if (typeof text !== 'string') {
      return null;
    }
    // Regex match gives the three numeric parts.
    const match = DATE_PATTERN.exec(text);
    // Shape mismatch means the value is not a date string.
    if (!match) {
      return null;
    }
    // Numeric parts of the matched string.
    const year = Number(match[1]);
    const month = Number(match[2]);
    const day = Number(match[3]);
    // Reject month 0 or 13+, and days past the month end such as 2026-02-30.
    if (month < 1 || month > 12 || day < 1 || day > daysInMonth(year, month - 1)) {
      return null;
    }
    return { year: year, month: month, day: day };
  }

  /** True when the text is a real YYYY-MM-DD calendar date. */
  function isValidDateString(text) {
    return parseDate(text) !== null;
  }

  /** True when the text is a valid 24-hour HH:MM time. */
  function isValidTimeString(text) {
    return typeof text === 'string' && TIME_PATTERN.test(text);
  }

  /** Converts a date string to a UTC timestamp for day arithmetic without time zone shifts. */
  function toUtcTime(text) {
    // Parsed parts; callers pass valid dates.
    const parts = parseDate(text);
    return utcTime(parts.year, parts.month - 1, parts.day);
  }

  /** Converts a UTC timestamp back to a YYYY-MM-DD string. */
  function fromUtcTime(time) {
    // Date object read with UTC getters only.
    const date = new Date(time);
    return formatDate(date.getUTCFullYear(), date.getUTCMonth() + 1, date.getUTCDate());
  }

  /** Adds whole days to a date string (negative values go back). */
  function addDays(text, days) {
    return fromUtcTime(toUtcTime(text) + days * 86400000);
  }

  /** Returns the weekday (0 = Sunday) of a date string. */
  function weekdayOf(text) {
    return new Date(toUtcTime(text)).getUTCDay();
  }

  /** Moves a date by whole months, clamping the day to the target month's last day (design §3.1, §6.2). */
  function addMonthsClamped(text, months) {
    // Source date parts.
    const parts = parseDate(text);
    // Absolute month count makes year rollover a simple division.
    const total = parts.year * 12 + (parts.month - 1) + months;
    // Target year and zero-based month.
    const year = Math.floor(total / 12);
    const monthIndex = total - year * 12;
    // Clamp, for example 3월 31일 to 4월 30일.
    const day = Math.min(parts.day, daysInMonth(year, monthIndex));
    return formatDate(year, monthIndex + 1, day);
  }

  /** Returns today's local date string from the browser clock (SCH-001 AC1). */
  function todayString(now) {
    // Allows tests to pass a fixed clock; defaults to the real one.
    const date = now instanceof Date ? now : new Date();
    return formatDate(date.getFullYear(), date.getMonth() + 1, date.getDate());
  }

  /**
   * Builds a Sunday-start month grid of 5 or 6 weeks (brief, model.js row).
   * A month that fits in exactly 4 weeks (for example February 2026) gets a
   * trailing fifth week so the grid always has 5 or 6 rows as the brief states.
   */
  function buildMonthGrid(year, monthIndex) {
    // First day of the visible month.
    const firstDate = formatDate(year, monthIndex + 1, 1);
    // Number of leading cells from the previous month.
    const leading = weekdayOf(firstDate);
    // Days in the visible month.
    const monthDays = daysInMonth(year, monthIndex);
    // Weeks the month needs, with the brief's minimum of 5.
    const weekCount = Math.max(5, Math.ceil((leading + monthDays) / 7));
    // Date in the top-left cell.
    const gridStart = addDays(firstDate, -leading);
    // Rows of seven cells.
    const weeks = [];
    // Build each week row.
    for (let week = 0; week < weekCount; week += 1) {
      // Cells of the current row.
      const row = [];
      // Build each day cell of the row, Sunday to Saturday.
      for (let weekday = 0; weekday < 7; weekday += 1) {
        // Date for this cell.
        const date = addDays(gridStart, week * 7 + weekday);
        // Parsed parts tell whether the cell belongs to the visible month.
        const parts = parseDate(date);
        row.push({
          date: date,
          day: parts.day,
          weekday: weekday,
          inMonth: parts.year === year && parts.month === monthIndex + 1
        });
      }
      weeks.push(row);
    }
    return { year: year, monthIndex: monthIndex, weeks: weeks };
  }

  /** True when the id is one of the four fixed categories. */
  function isCategoryId(id) {
    return CATEGORY_IDS.indexOf(id) !== -1;
  }

  /** Returns the category definition for an id, or undefined. */
  function getCategory(id) {
    return CATEGORIES.find(function (category) { return category.id === id; });
  }

  /**
   * Validates form input in design §8.3 field order (SCH-004).
   * Returns {ok, errors: {field: message}, value}; value is the normalized
   * record body (no id or timestamps) when ok, otherwise null.
   */
  function validateEvent(input) {
    // Treat a missing input as an empty form.
    const source = input || {};
    // Field errors keyed by title, date, start, end, category, notes.
    const errors = {};
    // Title is trimmed before counting and saving (design §3.5).
    const title = String(source.title == null ? '' : source.title).trim();
    // Date string from the form.
    const date = source.date == null ? '' : String(source.date);
    // All-day flag as a strict boolean.
    const allDay = source.allDay === true;
    // Time strings from the form.
    const start = source.start == null ? '' : String(source.start);
    const end = source.end == null ? '' : String(source.end);
    // Category id from the form.
    const category = source.category;
    // Notes are kept as typed, without trimming.
    const notes = source.notes == null ? '' : String(source.notes);

    // Title rules: empty first, then over-length.
    if (title.length === 0) {
      errors.title = MESSAGES.titleEmpty;
    } else if (codePointLength(title) > TITLE_MAX) {
      errors.title = MESSAGES.titleTooLong;
    }
    // Date must be a real calendar date.
    if (!isValidDateString(date)) {
      errors.date = MESSAGES.dateInvalid;
    }
    // Time rules apply only to timed events; all-day hides and ignores them.
    if (!allDay) {
      // Start must be present and well formed.
      if (!isValidTimeString(start)) {
        errors.start = MESSAGES.startEmpty;
      }
      // End must be present, then later than a valid start.
      if (!isValidTimeString(end)) {
        errors.end = MESSAGES.endEmpty;
      } else if (isValidTimeString(start) && end <= start) {
        errors.end = MESSAGES.endNotAfterStart;
      }
    }
    // Category must be one of the fixed ids so the record passes the load check.
    if (!isCategoryId(category)) {
      errors.category = MESSAGES.categoryInvalid;
    }
    // Notes over-length rule.
    if (codePointLength(notes) > NOTES_MAX) {
      errors.notes = MESSAGES.notesTooLong;
    }

    // Any error blocks the save and yields no value.
    const ok = Object.keys(errors).length === 0;
    return {
      ok: ok,
      errors: errors,
      value: ok ? {
        title: title,
        date: date,
        allDay: allDay,
        start: allDay ? null : start,
        end: allDay ? null : end,
        category: category,
        notes: notes
      } : null
    };
  }

  /** Compares two strings with plain code-unit order for stable final tiebreaks. */
  function compareStrings(left, right) {
    // Equal strings are a tie.
    if (left === right) {
      return 0;
    }
    return left < right ? -1 : 1;
  }

  /**
   * Orders events within a day: all-day first, then start time, then title
   * (localeCompare 'ko'), then createdAt, then id (PRD ordering, brief decisions).
   */
  function compareEvents(left, right) {
    // All-day events come before timed events.
    if (left.allDay !== right.allDay) {
      return left.allDay ? -1 : 1;
    }
    // Timed events sort by zero-padded start time, which orders as text.
    if (!left.allDay) {
      // Start-time comparison result.
      const byStart = compareStrings(left.start, right.start);
      // A start-time difference decides the order.
      if (byStart !== 0) {
        return byStart;
      }
    }
    // Korean-aware title comparison.
    const byTitle = left.title.localeCompare(right.title, 'ko');
    // A title difference decides the order.
    if (byTitle !== 0) {
      return byTitle;
    }
    // Earlier-created events first; ISO strings compare by time value.
    const byCreated = (Date.parse(left.createdAt) || 0) - (Date.parse(right.createdAt) || 0);
    // A creation-time difference decides the order.
    if (byCreated !== 0) {
      return byCreated < 0 ? -1 : 1;
    }
    return compareStrings(String(left.id), String(right.id));
  }

  /**
   * True when an event matches the search text (title or notes, ignoring case,
   * after trimming) and the category filter ('all' or empty means any) (SCH-006).
   */
  function matchesQuery(event, query, category) {
    // A specific category filter excludes other categories.
    if (category && category !== 'all' && event.category !== category) {
      return false;
    }
    // Normalized search text; empty means no search.
    const needle = String(query == null ? '' : query).trim().toLowerCase();
    // No search text matches everything left by the filter.
    if (needle.length === 0) {
      return true;
    }
    return String(event.title).toLowerCase().indexOf(needle) !== -1 ||
      String(event.notes).toLowerCase().indexOf(needle) !== -1;
  }

  /** True when the value is a non-empty string that Date.parse accepts. */
  function isTimestampString(value) {
    return typeof value === 'string' && value.length > 0 && !Number.isNaN(Date.parse(value));
  }

  /** Stored record shape check from the brief's storage contract (SCH-005 AC2). */
  function isValidRecord(record) {
    // Records must be plain objects, not null or arrays.
    if (record === null || typeof record !== 'object' || Array.isArray(record)) {
      return false;
    }
    // Id must be a non-empty string.
    if (typeof record.id !== 'string' || record.id.length === 0) {
      return false;
    }
    // Title must already be trimmed, non-empty and within the limit.
    if (typeof record.title !== 'string' || record.title.length === 0 ||
      record.title !== record.title.trim() || codePointLength(record.title) > TITLE_MAX) {
      return false;
    }
    // Date must be a real calendar date.
    if (!isValidDateString(record.date)) {
      return false;
    }
    // All-day flag must be a boolean.
    if (typeof record.allDay !== 'boolean') {
      return false;
    }
    // All-day events store null times.
    if (record.allDay) {
      // Any non-null time breaks the all-day rule.
      if (record.start !== null || record.end !== null) {
        return false;
      }
    } else if (!isValidTimeString(record.start) || !isValidTimeString(record.end) ||
      record.end <= record.start) {
      // Timed events need two valid times with end after start.
      return false;
    }
    // Unknown category ids are a shape failure (brief decision 3).
    if (!isCategoryId(record.category)) {
      return false;
    }
    // Notes must be a string within the limit.
    if (typeof record.notes !== 'string' || codePointLength(record.notes) > NOTES_MAX) {
      return false;
    }
    return isTimestampString(record.createdAt) && isTimestampString(record.updatedAt);
  }

  /** Creates a new record id: randomUUID when available, else time plus random. */
  function createId() {
    // Prefer the platform UUID generator.
    if (typeof crypto !== 'undefined' && crypto && typeof crypto.randomUUID === 'function') {
      return crypto.randomUUID();
    }
    return Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 12);
  }

  // Public model API shared by storage.js, app.js and Node tests.
  const api = {
    CATEGORIES: CATEGORIES,
    CATEGORY_IDS: CATEGORY_IDS,
    TITLE_MAX: TITLE_MAX,
    NOTES_MAX: NOTES_MAX,
    WEEKDAYS: WEEKDAYS,
    MESSAGES: MESSAGES,
    codePointLength: codePointLength,
    daysInMonth: daysInMonth,
    formatDate: formatDate,
    parseDate: parseDate,
    isValidDateString: isValidDateString,
    isValidTimeString: isValidTimeString,
    addDays: addDays,
    weekdayOf: weekdayOf,
    addMonthsClamped: addMonthsClamped,
    todayString: todayString,
    buildMonthGrid: buildMonthGrid,
    isCategoryId: isCategoryId,
    getCategory: getCategory,
    validateEvent: validateEvent,
    compareEvents: compareEvents,
    matchesQuery: matchesQuery,
    isValidRecord: isValidRecord,
    createId: createId
  };

  // Shared namespace; extend it, never replace it (brief, technical design).
  const namespace = (globalThis.ScheduleApp = globalThis.ScheduleApp || {});
  namespace.model = api;

  // Node export for tests when a CommonJS module object exists.
  if (typeof module !== 'undefined' && module && module.exports) {
    module.exports = api;
  }
})();
