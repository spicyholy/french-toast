/*
 * Schedule app UI controller (CL01-SCHED, SCH-001–SCH-007).
 * Owns state, rendering, event handlers, dialogs, focus and live regions.
 * Every mutation re-reads storage, applies the change to a copy of the fresh
 * list, saves, and only then commits to in-memory state and the DOM.
 */
(function () {
  'use strict';

  // This file needs a DOM; under Node it does nothing.
  if (typeof document === 'undefined') {
    return;
  }

  // Domain helpers loaded earlier by model.js.
  const model = globalThis.ScheduleApp.model;
  // Storage boundary loaded earlier by storage.js.
  const storageApi = globalThis.ScheduleApp.storage;
  // The getter is resolved inside each store method because reading window.localStorage may throw (F3).
  const store = storageApi.createStore(function () { return window.localStorage; }, storageApi.STORAGE_KEY);

  // Maximum chips shown per day cell before the +N line (SCH-001 AC3).
  const MAX_CHIPS = 3;
  // Notes preview length in the day list (design §3.4).
  const NOTES_PREVIEW = 80;
  // Debounce before announcing the search summary (design §6.3).
  const SEARCH_ANNOUNCE_DELAY = 500;
  // Delay before filling the banner, so role="alert" announces inserted text (S15).
  const BANNER_FILL_DELAY = 100;

  // Exact Korean strings from design §8 that app.js renders.
  const TEXT = Object.freeze({
    dayEmpty: '이 날에는 일정이 없습니다.',
    dayEmptyFiltered: '조건에 맞는 일정이 없습니다.',
    allDay: '종일',
    summaryNone: '이번 달에 조건에 맞는 일정이 없습니다.',
    dialogAdd: '새 일정',
    dialogEdit: '일정 수정',
    formInvalid: '입력 내용을 확인해 주세요.',
    saveFailed: '저장하지 못했습니다. 브라우저 저장 공간을 확인한 후 다시 시도해 주세요.',
    deleteTitle: '일정을 삭제할까요?',
    deleteAction: '삭제',
    deleteFailed: '삭제하지 못했습니다. 다시 시도해 주세요.',
    bannerText: '저장된 일정을 불러올 수 없습니다. 저장된 데이터는 변경되지 않았습니다.',
    bannerButton: '데이터 초기화',
    resetTitle: '저장된 데이터를 초기화할까요?',
    resetMessage: '읽을 수 없는 저장 데이터가 삭제되며 되돌릴 수 없습니다.',
    resetAction: '초기화',
    resetFailed: '초기화하지 못했습니다. 다시 시도해 주세요.',
    unreadableAtWrite: '저장된 데이터를 읽을 수 없어 변경하지 못했습니다. 입력 내용은 유지됩니다.',
    editedRemoved: '이 일정은 다른 곳에서 삭제되었습니다. 저장을 다시 누르면 새 일정으로 저장됩니다.',
    deletedRemoved: '이 일정은 다른 곳에서 이미 삭제되었습니다.',
    resetChangedReadable: '저장된 데이터를 다시 불러왔습니다.',
    resetChangedUnreadable: '저장된 데이터가 바뀌었습니다. 내용을 다시 확인한 후 초기화해 주세요.',
    statusAdded: '일정을 추가했습니다.',
    statusUpdated: '일정을 수정했습니다.',
    statusDeleted: '일정을 삭제했습니다.',
    statusReset: '저장 데이터를 초기화했습니다.'
  });

  // Form field keys mapped to their control ids, in design §8.3 validation order.
  const FIELD_CONTROLS = Object.freeze([
    { field: 'title', id: 'event-title', counterId: 'title-count' },
    { field: 'date', id: 'event-date', counterId: null },
    { field: 'start', id: 'event-start', counterId: null },
    { field: 'end', id: 'event-end', counterId: null },
    { field: 'category', id: 'event-category', counterId: null },
    { field: 'notes', id: 'event-notes', counterId: 'notes-count' }
  ]);

  /** Shorthand for getElementById. */
  function byId(id) {
    return document.getElementById(id);
  }

  // Cached DOM references from index.html.
  const dom = {
    prevMonth: byId('prev-month'),
    nextMonth: byId('next-month'),
    today: byId('today'),
    monthHeading: byId('month-heading'),
    search: byId('search'),
    categoryFilter: byId('category-filter'),
    newEvent: byId('new-event'),
    filterBar: byId('filter-bar'),
    filterSummary: byId('filter-summary'),
    clearFilters: byId('clear-filters'),
    banner: byId('storage-banner'),
    calendarBody: byId('calendar-body'),
    dayHeading: byId('day-heading'),
    dayList: byId('day-list'),
    dayEmpty: byId('day-empty'),
    status: byId('status'),
    eventDialog: byId('event-dialog'),
    eventForm: byId('event-form'),
    eventDialogTitle: byId('event-dialog-title'),
    formAlert: byId('form-alert'),
    title: byId('event-title'),
    titleCount: byId('title-count'),
    date: byId('event-date'),
    allDay: byId('event-allday'),
    timeFields: byId('time-fields'),
    start: byId('event-start'),
    end: byId('event-end'),
    category: byId('event-category'),
    notes: byId('event-notes'),
    notesCount: byId('notes-count'),
    deleteEvent: byId('delete-event'),
    cancelEvent: byId('cancel-event'),
    saveEvent: byId('save-event'),
    confirmDialog: byId('confirm-dialog'),
    confirmTitle: byId('confirm-title'),
    confirmMessage: byId('confirm-message'),
    confirmAlert: byId('confirm-alert'),
    confirmCancel: byId('confirm-cancel'),
    confirmAction: byId('confirm-action')
  };

  // Today's date at startup; the visible month and selection start here (SCH-001 AC1).
  const startDate = model.todayString();
  // Parsed startup date for the visible month.
  const startParts = model.parseDate(startDate);

  // Single in-memory application state.
  const state = {
    // Events committed from the last successful load or write.
    events: [],
    // 'ok' or 'unreadable' (S15).
    storageStatus: 'ok',
    // Raw stored string seen when the banner was shown; the reset guard (S22).
    resetBaseline: undefined,
    // Visible month.
    viewYear: startParts.year,
    viewMonthIndex: startParts.month - 1,
    // Selected date, which always has the grid's tabindex="0".
    selectedDate: startDate,
    // Search text and category filter (SCH-006).
    query: '',
    category: 'all',
    // Event dialog mode: 'add' or 'edit', plus the id being edited.
    dialogMode: 'add',
    editId: null,
    // True after the first failed save, enabling per-field re-validation (S6).
    validationActive: false,
    // Which message #form-alert holds: null, 'validation' or 'other'.
    formAlertKind: null,
    // Confirm dialog purpose: 'delete' or 'reset'.
    confirmPurpose: null,
    // Focus return targets for each dialog (design §6.4).
    eventReturnTarget: null,
    confirmReturnTarget: null,
    // Whether each dialog is open by our own bookkeeping.
    eventOpen: false,
    confirmOpen: false
  };

  // Pending debounced search announcement.
  let searchAnnounceTimer = null;
  // Pending banner fill after unhide.
  let bannerFillTimer = null;
  // Pending re-announcement of an identical status message.
  let statusTimer = null;

  /* ------------------------------------------------------------------ */
  /* Derived data                                                        */
  /* ------------------------------------------------------------------ */

  /** True while a search text or category filter narrows the view (SCH-006). */
  function isFilterActive() {
    return state.query.trim().length > 0 || state.category !== 'all';
  }

  /** Events that match the current search and filter. */
  function visibleEvents() {
    return state.events.filter(function (event) {
      return model.matchesQuery(event, state.query, state.category);
    });
  }

  /** Groups events by date with each day's list in PRD order. */
  function groupByDate(events) {
    // Map from YYYY-MM-DD to that day's events.
    const groups = new Map();
    // Put every event into its date's bucket.
    for (const event of events) {
      // Create the bucket on first use.
      if (!groups.has(event.date)) {
        groups.set(event.date, []);
      }
      groups.get(event.date).push(event);
    }
    // Sort each day's bucket with the shared comparator.
    for (const list of groups.values()) {
      list.sort(model.compareEvents);
    }
    return groups;
  }

  /** Formats the visible month heading, for example 2026년 11월. */
  function monthHeadingText(year, monthIndex) {
    return year + '년 ' + (monthIndex + 1) + '월';
  }

  /** Text shown in the day list for an event's time line. */
  function timeLabel(event) {
    return event.allDay ? TEXT.allDay : event.start + '~' + event.end;
  }

  /** Chip text: the title for all-day events, "HH:MM 제목" for timed events. */
  function chipLabel(event) {
    return event.allDay ? event.title : event.start + ' ' + event.title;
  }

  /** Filter summary text for the visible month, or null when no filter is active. */
  function filterSummaryText() {
    // No summary without an active search or filter.
    if (!isFilterActive()) {
      return null;
    }
    // Prefix shared by every date inside the visible month.
    const monthPrefix = model.formatDate(state.viewYear, state.viewMonthIndex + 1, 1).slice(0, 8);
    // Matches counted only inside the visible month (brief decision 5).
    const count = visibleEvents().filter(function (event) {
      return event.date.slice(0, 8) === monthPrefix;
    }).length;
    return count > 0 ? '이번 달 검색 결과 ' + count + '개' : TEXT.summaryNone;
  }

  /* ------------------------------------------------------------------ */
  /* Rendering                                                           */
  /* ------------------------------------------------------------------ */

  /** Re-renders everything that depends on state. */
  function render() {
    renderMonthHeading();
    renderToolbar();
    renderGrid();
    renderDayPanel();
  }

  /** Updates the month heading only when it changes, so the live region announces real changes. */
  function renderMonthHeading() {
    // New heading text for the visible month.
    const text = monthHeadingText(state.viewYear, state.viewMonthIndex);
    // Skip identical text to avoid redundant announcements.
    if (dom.monthHeading.textContent !== text) {
      dom.monthHeading.textContent = text;
    }
  }

  /** Updates the new-event button and the filter summary. */
  function renderToolbar() {
    // New events are blocked while storage is unreadable (S15).
    dom.newEvent.disabled = state.storageStatus !== 'ok';
    // Summary text, or null to hide it.
    const summary = filterSummaryText();
    // Show the bar only while a search or filter is active.
    dom.filterBar.hidden = summary === null;
    dom.filterSummary.hidden = summary === null;
    dom.filterSummary.textContent = summary === null ? '' : summary;
  }

  /** Builds one event chip for a day cell. */
  function createChip(event) {
    // Chip container colored by category.
    const chip = document.createElement('span');
    chip.className = 'chip cat-' + event.category;
    // Text span, visually hidden on mobile where the chip is a bar (design §7).
    const text = document.createElement('span');
    text.className = 'chip-text';
    text.textContent = chipLabel(event);
    chip.appendChild(text);
    return chip;
  }

  /** Builds the accessible name for a day cell (design §3.3). */
  function cellLabel(cell, count, isToday) {
    // Parsed cell date parts.
    const parts = model.parseDate(cell.date);
    // Base label with the full weekday name.
    let label = parts.year + '년 ' + parts.month + '월 ' + parts.day + '일 ' +
      model.WEEKDAYS[cell.weekday] + '요일, ';
    label += count > 0 ? '일정 ' + count + '개' : '일정 없음';
    // Today gets an extra suffix.
    if (isToday) {
      label += ', 오늘';
    }
    return label;
  }

  /** Builds one grid cell. */
  function createCell(cell, dayEvents, today) {
    // The table cell itself.
    const td = document.createElement('td');
    // Whether this cell is today and whether it is selected.
    const isToday = cell.date === today;
    const isSelected = cell.date === state.selectedDate;
    td.setAttribute('role', 'gridcell');
    td.dataset.date = cell.date;
    // Adjacent-month cells are marked for styling and tests.
    if (!cell.inMonth) {
      td.dataset.outside = 'true';
    }
    // Weekend classes color the day number.
    if (cell.weekday === 0) {
      td.classList.add('sun');
    } else if (cell.weekday === 6) {
      td.classList.add('sat');
    }
    td.setAttribute('aria-selected', isSelected ? 'true' : 'false');
    td.tabIndex = isSelected ? 0 : -1;
    // Today's marker for assistive technology.
    if (isToday) {
      td.setAttribute('aria-current', 'date');
    }
    td.setAttribute('aria-label', cellLabel(cell, dayEvents.length, isToday));

    // Day number.
    const dayNumber = document.createElement('span');
    dayNumber.className = 'day-num';
    dayNumber.setAttribute('aria-hidden', 'true');
    dayNumber.textContent = String(cell.day);
    td.appendChild(dayNumber);

    // Chips are summarised by the cell label, so they are hidden from assistive technology.
    const chips = document.createElement('div');
    chips.className = 'chips';
    chips.setAttribute('aria-hidden', 'true');
    // Add up to MAX_CHIPS chips in PRD order.
    for (const event of dayEvents.slice(0, MAX_CHIPS)) {
      chips.appendChild(createChip(event));
    }
    // Remaining matches become a +N line.
    if (dayEvents.length > MAX_CHIPS) {
      // Overflow count element.
      const overflow = document.createElement('span');
      overflow.className = 'overflow';
      overflow.textContent = '+' + (dayEvents.length - MAX_CHIPS);
      chips.appendChild(overflow);
    }
    td.appendChild(chips);
    return td;
  }

  /** Rebuilds the month grid, keeping focus inside the grid when it was there (design §6.2). */
  function renderGrid() {
    // Remember whether a grid cell had focus before rebuilding.
    const hadFocus = dom.calendarBody.contains(document.activeElement);
    // Month layout from the model.
    const grid = model.buildMonthGrid(state.viewYear, state.viewMonthIndex);
    // Matching events grouped per date.
    const groups = groupByDate(visibleEvents());
    // Today's date for the marker, re-read so it stays current.
    const today = model.todayString();
    // New tbody content built off-document.
    const fragment = document.createDocumentFragment();
    // One table row per week.
    for (const week of grid.weeks) {
      // Row element.
      const row = document.createElement('tr');
      // One cell per day.
      for (const cell of week) {
        row.appendChild(createCell(cell, groups.get(cell.date) || [], today));
      }
      fragment.appendChild(row);
    }
    dom.calendarBody.replaceChildren(fragment);
    // Restore focus to the selected cell so focus never falls to body.
    if (hadFocus) {
      focusSelectedCell();
    }
  }

  /** Focuses the selected date's cell, if it is rendered. */
  function focusSelectedCell() {
    // Cell for the selected date.
    const cell = dom.calendarBody.querySelector('td[data-date="' + state.selectedDate + '"]');
    // Only focus a cell that exists in the current grid.
    if (cell) {
      cell.focus();
    }
  }

  /** Builds one day-list item button (design §3.4). */
  function createDayItem(event) {
    // List item wrapper.
    const item = document.createElement('li');
    // Activating the button opens the edit dialog.
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'event-item cat-' + event.category;
    button.dataset.id = event.id;

    // Time line and category badge.
    const meta = document.createElement('span');
    meta.className = 'event-meta';
    // Time label element.
    const time = document.createElement('span');
    time.className = 'event-time';
    time.textContent = timeLabel(event);
    // Category badge with its text label, so color is never the only cue.
    const badge = document.createElement('span');
    badge.className = 'badge cat-' + event.category;
    // Category definition for the badge label.
    const category = model.getCategory(event.category);
    badge.textContent = category ? category.label : event.category;
    meta.appendChild(time);
    meta.appendChild(badge);
    button.appendChild(meta);

    // Bold title.
    const title = document.createElement('strong');
    title.className = 'event-title';
    title.textContent = event.title;
    button.appendChild(title);

    // Notes preview, only when notes exist.
    if (event.notes.length > 0) {
      // Notes split by code point so the preview never cuts a surrogate pair.
      const characters = Array.from(event.notes);
      // Preview element.
      const notes = document.createElement('span');
      notes.className = 'event-notes';
      notes.textContent = characters.length > NOTES_PREVIEW
        ? characters.slice(0, NOTES_PREVIEW).join('') + '…'
        : event.notes;
      button.appendChild(notes);
    }
    item.appendChild(button);
    return item;
  }

  /** Renders the selected-day heading and list (SCH-001 AC4). */
  function renderDayPanel() {
    // Selected date parts for the heading.
    const parts = model.parseDate(state.selectedDate);
    // Weekday abbreviation of the selected date.
    const weekday = model.WEEKDAYS[model.weekdayOf(state.selectedDate)];
    dom.dayHeading.textContent = parts.month + '월 ' + parts.day + '일 (' + weekday + ') 일정';

    // Matching events on the selected date, in PRD order.
    const dayEvents = visibleEvents().filter(function (event) {
      return event.date === state.selectedDate;
    }).sort(model.compareEvents);
    // Fresh list content built off-document.
    const fragment = document.createDocumentFragment();
    // One item per matching event.
    for (const event of dayEvents) {
      fragment.appendChild(createDayItem(event));
    }
    dom.dayList.replaceChildren(fragment);
    dom.dayList.hidden = dayEvents.length === 0;

    // Empty state: filtered wording while a search or filter is active (S13, S14).
    if (dayEvents.length === 0) {
      dom.dayEmpty.textContent = isFilterActive() ? TEXT.dayEmptyFiltered : TEXT.dayEmpty;
      dom.dayEmpty.hidden = false;
    } else {
      dom.dayEmpty.textContent = '';
      dom.dayEmpty.hidden = true;
    }
  }

  /* ------------------------------------------------------------------ */
  /* Live regions and banner                                             */
  /* ------------------------------------------------------------------ */

  /** Announces a #status message; an identical repeat is cleared first so it is re-announced. */
  function announce(message) {
    // Drop any pending repeat from an earlier call.
    clearTimeout(statusTimer);
    // A repeated identical message needs a clear-then-set cycle to be announced again.
    if (dom.status.textContent === message) {
      dom.status.textContent = '';
      statusTimer = setTimeout(function () {
        dom.status.textContent = message;
      }, 50);
      return;
    }
    dom.status.textContent = message;
  }

  /** Clears #status and pending announcements, used when a dialog opens. */
  function clearStatus() {
    clearTimeout(statusTimer);
    clearTimeout(searchAnnounceTimer);
    dom.status.textContent = '';
  }

  /** Schedules the search summary announcement after typing pauses (S12, S13). */
  function scheduleSearchAnnouncement() {
    clearTimeout(searchAnnounceTimer);
    searchAnnounceTimer = setTimeout(function () {
      // Current summary, which may be null if the filter was cleared meanwhile.
      const summary = filterSummaryText();
      // Announce only while a summary is shown.
      if (summary !== null) {
        announce(summary);
      }
    }, SEARCH_ANNOUNCE_DELAY);
  }

  /**
   * Shows the storage banner. The container is unhidden first and filled
   * shortly after, so role="alert" announces the inserted text (S15).
   */
  function showBanner() {
    // An already visible, filled banner stays as it is.
    if (!dom.banner.hidden && dom.banner.childElementCount > 0) {
      return;
    }
    dom.banner.hidden = false;
    clearTimeout(bannerFillTimer);
    bannerFillTimer = setTimeout(fillBanner, BANNER_FILL_DELAY);
  }

  /** Inserts the banner text and reset button. */
  function fillBanner() {
    // Storage may have recovered before the timer fired.
    if (state.storageStatus !== 'unreadable') {
      return;
    }
    // Banner message.
    const text = document.createElement('p');
    text.textContent = TEXT.bannerText;
    // Reset button that opens the confirmation (S16).
    const button = document.createElement('button');
    button.type = 'button';
    button.id = 'reset-storage';
    button.className = 'btn btn-secondary';
    button.textContent = TEXT.bannerButton;
    button.addEventListener('click', openResetConfirm);
    dom.banner.replaceChildren(text, button);
  }

  /** Removes the banner and its content. */
  function hideBanner() {
    clearTimeout(bannerFillTimer);
    dom.banner.replaceChildren();
    dom.banner.hidden = true;
  }

  /** Returns the banner's reset button, creating the content now if the fill timer is pending. */
  function resetButton() {
    // Fill immediately when a dialog needs the button as a focus target.
    if (state.storageStatus === 'unreadable' && dom.banner.childElementCount === 0) {
      clearTimeout(bannerFillTimer);
      fillBanner();
    }
    return byId('reset-storage');
  }

  /** Enters the unreadable state: empty calendar, banner, new-event disabled, no writes (S15, S20). */
  function enterUnreadable(raw) {
    state.storageStatus = 'unreadable';
    state.events = [];
    state.resetBaseline = raw;
    showBanner();
    render();
  }

  /**
   * A mutation's fresh read is readable while the app still shows the banner
   * (for example S20, then the data was fixed elsewhere): reload from it as in
   * S22a before applying the change, so the write starts from valid data.
   */
  function recoverIfReadable(fresh) {
    // Only an unreadable app state with a readable fresh read needs recovery.
    if (state.storageStatus === 'unreadable' && fresh.status === 'ok') {
      enterReadable(fresh.events);
    }
  }

  /** Leaves the unreadable state with a freshly loaded readable list (S17, S22a). */
  function enterReadable(events) {
    state.storageStatus = 'ok';
    state.events = events;
    state.resetBaseline = undefined;
    hideBanner();
    render();
  }

  /* ------------------------------------------------------------------ */
  /* Navigation and selection                                            */
  /* ------------------------------------------------------------------ */

  /** Selects a date and shows its month; optionally focuses its grid cell. */
  function selectDate(date, focusCell) {
    // Parsed target date for the visible month.
    const parts = model.parseDate(date);
    state.selectedDate = date;
    state.viewYear = parts.year;
    state.viewMonthIndex = parts.month - 1;
    render();
    // Keyboard and click selection keep focus on the grid.
    if (focusCell) {
      focusSelectedCell();
    }
  }

  /** Moves the visible month by delta, carrying the selected day with clamping (design §3.1). */
  function changeMonth(delta) {
    selectDate(model.addMonthsClamped(state.selectedDate, delta), false);
  }

  /** Handles grid keys (design §6.2). */
  function handleGridKeydown(event) {
    // Leave modified keys to browser and assistive technology shortcuts.
    if (event.altKey || event.ctrlKey || event.metaKey) {
      return;
    }
    // Only key presses on a day cell are handled.
    const cell = event.target.closest('td[data-date]');
    // Ignore keys from anywhere else.
    if (!cell) {
      return;
    }
    // Current focused date.
    const date = cell.dataset.date;
    // Weekday of the focused date for Home and End.
    const weekday = model.weekdayOf(date);
    // Target date for the key, or null if the key is not handled.
    let target = null;
    // Map each supported key to its target date.
    switch (event.key) {
      case 'ArrowLeft':
        target = model.addDays(date, -1);
        break;
      case 'ArrowRight':
        target = model.addDays(date, 1);
        break;
      case 'ArrowUp':
        target = model.addDays(date, -7);
        break;
      case 'ArrowDown':
        target = model.addDays(date, 7);
        break;
      case 'Home':
        target = model.addDays(date, -weekday);
        break;
      case 'End':
        target = model.addDays(date, 6 - weekday);
        break;
      case 'PageUp':
        target = model.addMonthsClamped(date, -1);
        break;
      case 'PageDown':
        target = model.addMonthsClamped(date, 1);
        break;
      case 'Enter':
      case ' ':
        target = date;
        break;
      default:
        return;
    }
    event.preventDefault();
    selectDate(target, true);
  }

  /** Selects the clicked cell's date; an outside cell also switches month (design §3.3). */
  function handleGridClick(event) {
    // Clicked day cell, if any.
    const cell = event.target.closest('td[data-date]');
    // Clicks outside cells are ignored.
    if (!cell) {
      return;
    }
    selectDate(cell.dataset.date, true);
  }

  /* ------------------------------------------------------------------ */
  /* Search and filter                                                   */
  /* ------------------------------------------------------------------ */

  /** Applies the search text on every input event (S12). */
  function handleSearchInput() {
    state.query = dom.search.value;
    render();
    scheduleSearchAnnouncement();
  }

  /** Applies the category filter (S12, SCH-006 AC2). */
  function handleFilterChange() {
    state.category = dom.categoryFilter.value;
    render();
    scheduleSearchAnnouncement();
  }

  /** Clears search and filter, hides the summary and focuses the search field (S13). */
  function handleClearFilters() {
    clearTimeout(searchAnnounceTimer);
    dom.search.value = '';
    dom.categoryFilter.value = 'all';
    state.query = '';
    state.category = 'all';
    render();
    dom.search.focus();
  }

  /* ------------------------------------------------------------------ */
  /* Dialog infrastructure (design §6.4)                                 */
  /* ------------------------------------------------------------------ */

  /** True when an element can take focus: connected, rendered, enabled and not in a hidden container. */
  function isFocusable(element) {
    return Boolean(element) && element !== document.body && element.isConnected && !element.disabled &&
      !element.closest('[hidden]') && element.getClientRects().length > 0;
  }

  /** Tabbable elements inside a dialog, in DOM order. */
  function tabbableIn(dialog) {
    // Candidate controls.
    const candidates = dialog.querySelectorAll('button, input, select, textarea, [tabindex]');
    return Array.from(candidates).filter(function (element) {
      return element.tabIndex >= 0 && isFocusable(element);
    });
  }

  /** Wraps Tab and Shift+Tab inside the dialog. */
  function trapTab(event) {
    // Only Tab is wrapped.
    if (event.key !== 'Tab') {
      return;
    }
    // Focus order inside this dialog.
    const tabbable = tabbableIn(event.currentTarget);
    // A dialog with nothing tabbable keeps focus where it is.
    if (tabbable.length === 0) {
      event.preventDefault();
      return;
    }
    // Ends of the focus order.
    const first = tabbable[0];
    const last = tabbable[tabbable.length - 1];
    // Index of the current element, -1 when focus is on the dialog itself.
    const index = tabbable.indexOf(document.activeElement);
    // Shift+Tab from the first (or from outside the list) wraps to the last.
    if (event.shiftKey && (index <= 0)) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && (index === -1 || index === tabbable.length - 1)) {
      // Tab from the last (or from outside the list) wraps to the first.
      event.preventDefault();
      first.focus();
    }
  }

  /** Moves focus to the return target, or to the fallbacks in order, ending at #day-heading. */
  function restoreFocus(target, fallbacks) {
    // Candidates in priority order.
    const candidates = [target].concat(fallbacks || []);
    // Use the first candidate that can take focus.
    for (const candidate of candidates) {
      // Skip disconnected, hidden or disabled candidates.
      if (isFocusable(candidate)) {
        candidate.focus();
        return;
      }
    }
    dom.dayHeading.focus();
  }

  /* ------------------------------------------------------------------ */
  /* Event dialog                                                        */
  /* ------------------------------------------------------------------ */

  /** Shows or clears a field's error, wiring aria-invalid and aria-describedby (design §6.5). */
  function setFieldError(control, message) {
    // Error element id for this control.
    const errorId = control.id + '-error';
    // Existing error element, if any.
    let errorElement = byId(errorId);
    // Counter id that stays in aria-describedby.
    const counterId = control === dom.title ? 'title-count' : (control === dom.notes ? 'notes-count' : null);
    // A message shows or updates the error.
    if (message) {
      // Create the error element right after the control on first use.
      if (!errorElement) {
        errorElement = document.createElement('p');
        errorElement.className = 'field-error';
        errorElement.id = errorId;
        control.insertAdjacentElement('afterend', errorElement);
      }
      errorElement.textContent = message;
      control.setAttribute('aria-invalid', 'true');
      control.setAttribute('aria-describedby', counterId ? errorId + ' ' + counterId : errorId);
    } else {
      // Remove the error element when it exists.
      if (errorElement) {
        errorElement.remove();
      }
      control.setAttribute('aria-invalid', 'false');
      // Keep only the counter reference, or drop the attribute.
      if (counterId) {
        control.setAttribute('aria-describedby', counterId);
      } else {
        control.removeAttribute('aria-describedby');
      }
    }
  }

  /** Clears every field error and the invalid markers. */
  function clearFieldErrors() {
    // Reset each mapped control.
    for (const entry of FIELD_CONTROLS) {
      // Control element for the field.
      const control = byId(entry.id);
      setFieldError(control, null);
      control.removeAttribute('aria-invalid');
    }
  }

  // Pending re-announcement timers for each alert element.
  const alertTimers = new Map();

  /**
   * Shows a message in an alert element; an empty message hides it. A repeat
   * of the visible message (for example a retry that fails the same way in S8,
   * S11 or S18) is cleared and set again so role="alert" announces it again.
   */
  function setAlert(element, message) {
    // Drop any pending re-announcement for this element.
    clearTimeout(alertTimers.get(element));
    alertTimers.delete(element);
    // Same message already visible: clear now, set again after a short pause.
    if (message && !element.hidden && element.textContent === message) {
      element.textContent = '';
      alertTimers.set(element, setTimeout(function () {
        alertTimers.delete(element);
        element.textContent = message;
      }, 50));
      return;
    }
    element.textContent = message || '';
    element.hidden = !message;
  }

  /** Sets #form-alert and remembers which kind of message it holds. */
  function setFormAlert(message, kind) {
    setAlert(dom.formAlert, message);
    state.formAlertKind = message ? kind : null;
  }

  /** Updates a code-point counter, colored when over the limit (design §3.5). */
  function updateCounter(counter, text, limit) {
    // Length in code points.
    const length = model.codePointLength(text);
    counter.textContent = length + '/' + limit;
    counter.classList.toggle('over-limit', length > limit);
  }

  /** Updates both counters; the title is trimmed before counting. */
  function updateCounters() {
    updateCounter(dom.titleCount, dom.title.value.trim(), model.TITLE_MAX);
    updateCounter(dom.notesCount, dom.notes.value, model.NOTES_MAX);
  }

  /** Shows or hides the time fields for the all-day checkbox; values are kept (design §3.5). */
  function syncAllDay() {
    dom.timeFields.hidden = dom.allDay.checked;
  }

  /** Reads the form into validateEvent input. */
  function readForm() {
    return {
      title: dom.title.value,
      date: dom.date.value,
      allDay: dom.allDay.checked,
      start: dom.start.value,
      end: dom.end.value,
      category: dom.category.value,
      notes: dom.notes.value
    };
  }

  /** Switches the dialog's mode, title and delete button. */
  function setDialogMode(mode, editId) {
    state.dialogMode = mode;
    state.editId = mode === 'edit' ? editId : null;
    dom.eventDialogTitle.textContent = mode === 'edit' ? TEXT.dialogEdit : TEXT.dialogAdd;
    dom.deleteEvent.hidden = mode !== 'edit';
  }

  /** Opens the event dialog in add or edit mode (S4, S5); opener is the focus return target. */
  function openEventDialog(mode, event, opener) {
    // Store the opener as the return target before the modal takes focus (design §6.4).
    state.eventReturnTarget = opener || document.activeElement;
    clearStatus();
    clearFieldErrors();
    setFormAlert(null, null);
    state.validationActive = false;
    setDialogMode(mode, event ? event.id : null);
    // Edit fills the saved values; add uses the defaults from design §3.5.
    if (mode === 'edit' && event) {
      dom.title.value = event.title;
      dom.date.value = event.date;
      dom.allDay.checked = event.allDay;
      dom.start.value = event.allDay ? '09:00' : event.start;
      dom.end.value = event.allDay ? '10:00' : event.end;
      dom.category.value = event.category;
      dom.notes.value = event.notes;
    } else {
      dom.title.value = '';
      dom.date.value = state.selectedDate;
      dom.allDay.checked = false;
      dom.start.value = '09:00';
      dom.end.value = '10:00';
      dom.category.value = 'work';
      dom.notes.value = '';
    }
    syncAllDay();
    updateCounters();
    state.eventOpen = true;
    dom.eventDialog.showModal();
    dom.title.focus();
  }

  /** Closes the event dialog without moving focus (callers decide focus). */
  function closeEventDialog() {
    state.eventOpen = false;
    // Close only when the element is still open.
    if (dom.eventDialog.open) {
      dom.eventDialog.close();
    }
  }

  /** Cancel or Escape on the event dialog: close and return focus (design §6.4). */
  function cancelEventDialog() {
    closeEventDialog();
    // Fallbacks for an opener that is gone: the banner button while unreadable (S20).
    const fallbacks = state.storageStatus === 'unreadable' ? [resetButton()] : [];
    restoreFocus(state.eventReturnTarget, fallbacks);
  }

  /** Shows field errors from a validation result and focuses the first invalid field (S6). */
  function showValidationErrors(result) {
    // First invalid control in form order.
    let firstInvalid = null;
    // Apply each field's error state in order.
    for (const entry of FIELD_CONTROLS) {
      // Control element and its message, if any.
      const control = byId(entry.id);
      const message = result.errors[entry.field] || null;
      setFieldError(control, message);
      // Remember the first invalid control for focus.
      if (message && !firstInvalid) {
        firstInvalid = control;
      }
    }
    setFormAlert(TEXT.formInvalid, 'validation');
    // Focus the first invalid field.
    if (firstInvalid) {
      firstInvalid.focus();
    }
  }

  /** Re-validates the edited field after the first failed save (S6 recovery). */
  function revalidateField(control) {
    // Only active after a failed save.
    if (!state.validationActive) {
      return;
    }
    // Current validation result for the whole form.
    const result = model.validateEvent(readForm());
    // Fields that depend on the changed control: start and end are coupled, all-day affects both.
    let fields;
    // Pick the fields to refresh for this control.
    if (control === dom.allDay || control === dom.start || control === dom.end) {
      fields = ['start', 'end'];
    } else {
      // Mapping entry for the changed control.
      const entry = FIELD_CONTROLS.find(function (item) { return item.id === control.id; });
      fields = entry ? [entry.field] : [];
    }
    // Refresh each affected field's error.
    for (const field of fields) {
      // Mapping entry for the field.
      const entry = FIELD_CONTROLS.find(function (item) { return item.field === field; });
      setFieldError(byId(entry.id), result.errors[field] || null);
    }
    // The validation alert clears once every field is valid.
    if (result.ok && state.formAlertKind === 'validation') {
      setFormAlert(null, null);
    }
  }

  /** Handles any input or change inside the event form. */
  function handleFormInput(event) {
    // Counters follow every edit.
    updateCounters();
    // The all-day checkbox toggles the time fields.
    if (event.target === dom.allDay) {
      syncAllDay();
    }
    revalidateField(event.target);
  }

  /** Builds a new record id that is not already used by the list. */
  function uniqueId(events) {
    // Candidate id from the model.
    let id = model.createId();
    // Regenerate in the unlikely case of a collision.
    while (events.some(function (event) { return event.id === id; })) {
      id = model.createId();
    }
    return id;
  }

  /** Save: validate, re-read, apply to a copy, write, then commit (S6, S7, S8, S20, S21a). */
  function handleSave(submitEvent) {
    submitEvent.preventDefault();
    // Validation runs first; a blocked save never touches storage (SCH-004 AC3).
    const result = model.validateEvent(readForm());
    // Invalid input shows errors and stops.
    if (!result.ok) {
      state.validationActive = true;
      showValidationErrors(result);
      return;
    }

    // Fresh read immediately before writing (write protocol).
    const fresh = store.load();
    // Unreadable at write time: write nothing, keep input, show banner (S20).
    if (fresh.status !== 'ok') {
      enterUnreadable(fresh.raw);
      // The opener may be gone or disabled, so cancel returns to the banner button.
      state.eventReturnTarget = resetButton();
      setFormAlert(TEXT.unreadableAtWrite, 'other');
      dom.saveEvent.focus();
      return;
    }

    recoverIfReadable(fresh);

    // Edit target position in the fresh list, or -1.
    const editIndex = state.dialogMode === 'edit'
      ? fresh.events.findIndex(function (item) { return item.id === state.editId; })
      : -1;
    // Edited event removed elsewhere: write nothing, switch to add mode (S21a).
    if (state.dialogMode === 'edit' && editIndex === -1) {
      state.events = fresh.events;
      render();
      clearFieldErrors();
      setDialogMode('add', null);
      setFormAlert(TEXT.editedRemoved, 'other');
      dom.saveEvent.focus();
      return;
    }

    // Timestamp shared by createdAt and updatedAt.
    const now = new Date().toISOString();
    // Copy of the fresh list that receives the change.
    const nextEvents = fresh.events.slice();
    // The saved record, used for month selection and focus.
    let record;
    // Add appends a new record; edit spreads the fresh stored record to keep unknown fields.
    if (state.dialogMode === 'edit') {
      record = Object.assign({}, fresh.events[editIndex], result.value, { updatedAt: now });
      nextEvents[editIndex] = record;
    } else {
      record = Object.assign({ id: uniqueId(fresh.events) }, result.value, { createdAt: now, updatedAt: now });
      nextEvents.push(record);
    }

    // Write the copy; nothing in memory or the DOM changes until it succeeds.
    const saved = store.save(nextEvents);
    // Write failure keeps the dialog, input and current view (S8).
    if (!saved.ok) {
      setFormAlert(TEXT.saveFailed, 'other');
      dom.saveEvent.focus();
      return;
    }

    // Commit: the fresh list with the change, then show the event's date (S7).
    const wasEdit = state.dialogMode === 'edit';
    state.events = nextEvents;
    closeEventDialog();
    selectDate(record.date, false);
    // Add returns focus to the new-event button; edit focuses the saved item or the heading.
    if (wasEdit) {
      // Saved event's item, absent when the filter hides it.
      const item = dom.dayList.querySelector('button[data-id="' + CSS.escape(record.id) + '"]');
      restoreFocus(item, []);
      announce(TEXT.statusUpdated);
    } else {
      dom.newEvent.focus();
      announce(TEXT.statusAdded);
    }
  }

  /** Opens the edit dialog for a day-list item (S5). */
  function handleDayListClick(event) {
    // Clicked item button, if any.
    const button = event.target.closest('button.event-item');
    // Clicks elsewhere in the list are ignored.
    if (!button) {
      return;
    }
    // Event for the button's id in committed state.
    const target = state.events.find(function (item) { return item.id === button.dataset.id; });
    // Only open for a known event.
    if (target) {
      openEventDialog('edit', target, button);
    }
  }

  /* ------------------------------------------------------------------ */
  /* Confirm dialog: delete and reset                                    */
  /* ------------------------------------------------------------------ */

  /** Opens the confirm dialog for a purpose with its texts (S9, S16); opener is the focus return target. */
  function openConfirm(purpose, title, message, actionLabel, opener) {
    state.confirmReturnTarget = opener;
    state.confirmPurpose = purpose;
    dom.confirmTitle.textContent = title;
    dom.confirmMessage.textContent = message;
    dom.confirmAction.textContent = actionLabel;
    setAlert(dom.confirmAlert, null);
    state.confirmOpen = true;
    dom.confirmDialog.showModal();
    dom.confirmCancel.focus();
  }

  /** Opens the delete confirmation over the event dialog (S9). */
  function openDeleteConfirm() {
    // Title shown in the message: the stored title of the event being edited.
    const target = state.events.find(function (item) { return item.id === state.editId; });
    // Fall back to the typed title when the event is no longer in memory.
    const title = target ? target.title : dom.title.value.trim();
    openConfirm('delete', TEXT.deleteTitle, '「' + title + '」 일정이 삭제되며 되돌릴 수 없습니다.', TEXT.deleteAction, dom.deleteEvent);
  }

  /** Opens the reset confirmation from the banner (S16). */
  function openResetConfirm() {
    clearStatus();
    openConfirm('reset', TEXT.resetTitle, TEXT.resetMessage, TEXT.resetAction, resetButton());
  }

  /** Closes the confirm dialog without moving focus. */
  function closeConfirmDialog() {
    state.confirmOpen = false;
    state.confirmPurpose = null;
    // Close only when the element is still open.
    if (dom.confirmDialog.open) {
      dom.confirmDialog.close();
    }
  }

  /** Cancel or Escape on the confirm dialog: close only it and return focus (S9, S16). */
  function cancelConfirmDialog() {
    closeConfirmDialog();
    // While unreadable the banner button is the fallback; otherwise the event dialog's delete button.
    const fallbacks = state.storageStatus === 'unreadable' ? [resetButton()] : [];
    // Inside the still-open event dialog, keep focus there.
    if (state.eventOpen) {
      fallbacks.push(dom.deleteEvent, dom.saveEvent);
    }
    restoreFocus(state.confirmReturnTarget, fallbacks);
  }

  /** Confirmed delete: re-read, remove from a copy, write, then commit (S10, S11, S20, S21b). */
  function confirmDelete() {
    // Fresh read immediately before writing.
    const fresh = store.load();
    // Unreadable at write time: both dialogs stay open (S20).
    if (fresh.status !== 'ok') {
      enterUnreadable(fresh.raw);
      state.eventReturnTarget = resetButton();
      setAlert(dom.confirmAlert, TEXT.unreadableAtWrite);
      dom.confirmAction.focus();
      return;
    }
    recoverIfReadable(fresh);
    // Copy of the fresh list without the target.
    const nextEvents = fresh.events.filter(function (item) { return item.id !== state.editId; });
    // Target already removed elsewhere: write nothing, close both, notify (S21b).
    if (nextEvents.length === fresh.events.length) {
      state.events = fresh.events;
      closeConfirmDialog();
      closeEventDialog();
      render();
      dom.dayHeading.focus();
      announce(TEXT.deletedRemoved);
      return;
    }
    // Write the copy.
    const saved = store.save(nextEvents);
    // Write failure keeps everything and shows the alert (S11).
    if (!saved.ok) {
      setAlert(dom.confirmAlert, TEXT.deleteFailed);
      dom.confirmAction.focus();
      return;
    }
    // Commit and close both dialogs (S10).
    state.events = nextEvents;
    closeConfirmDialog();
    closeEventDialog();
    render();
    dom.dayHeading.focus();
    announce(TEXT.statusDeleted);
  }

  /** Confirmed reset, guarded by the baseline raw string (S17, S18, S22). */
  function confirmReset() {
    // Guarded write of [].
    const result = store.reset(state.resetBaseline);
    // Success: empty list, banner removed (S17).
    if (result.ok) {
      closeConfirmDialog();
      enterReadable([]);
      dom.newEvent.focus();
      announce(TEXT.statusReset);
      return;
    }
    // Stored value changed since the banner: write nothing and reload (S22).
    if (result.reason === 'changed') {
      // Current stored state, read without writing.
      const fresh = store.load();
      // Now readable: close and show the events (S22a).
      if (fresh.status === 'ok') {
        closeConfirmDialog();
        enterReadable(fresh.events);
        dom.newEvent.focus();
        announce(TEXT.resetChangedReadable);
        return;
      }
      // Still unreadable with a different value: new baseline, stay open (S22b).
      state.resetBaseline = fresh.raw;
      setAlert(dom.confirmAlert, TEXT.resetChangedUnreadable);
      dom.confirmAction.focus();
      return;
    }
    // Write or access failure keeps the dialog and banner (S18).
    setAlert(dom.confirmAlert, TEXT.resetFailed);
    dom.confirmAction.focus();
  }

  /** Dispatches the confirm action by purpose. */
  function handleConfirmAction() {
    // Delete and reset share one dialog.
    if (state.confirmPurpose === 'delete') {
      confirmDelete();
    } else if (state.confirmPurpose === 'reset') {
      confirmReset();
    }
  }

  /* ------------------------------------------------------------------ */
  /* Wiring and startup                                                  */
  /* ------------------------------------------------------------------ */

  /** Attaches every event listener. */
  function bindEvents() {
    dom.prevMonth.addEventListener('click', function () { changeMonth(-1); });
    dom.nextMonth.addEventListener('click', function () { changeMonth(1); });
    dom.today.addEventListener('click', function () { selectDate(model.todayString(), false); });
    dom.search.addEventListener('input', handleSearchInput);
    dom.categoryFilter.addEventListener('change', handleFilterChange);
    dom.clearFilters.addEventListener('click', handleClearFilters);
    dom.newEvent.addEventListener('click', function () { openEventDialog('add', null, dom.newEvent); });
    dom.calendarBody.addEventListener('keydown', handleGridKeydown);
    dom.calendarBody.addEventListener('click', handleGridClick);
    dom.dayList.addEventListener('click', handleDayListClick);

    dom.eventForm.addEventListener('submit', handleSave);
    dom.eventForm.addEventListener('input', handleFormInput);
    dom.eventForm.addEventListener('change', handleFormInput);
    dom.cancelEvent.addEventListener('click', cancelEventDialog);
    dom.deleteEvent.addEventListener('click', openDeleteConfirm);
    dom.eventDialog.addEventListener('keydown', trapTab);
    // Escape maps to 취소; preventDefault keeps focus handling in our code.
    dom.eventDialog.addEventListener('cancel', function (event) {
      event.preventDefault();
      cancelEventDialog();
    });
    // Covers a native close that bypassed our cancel handler.
    dom.eventDialog.addEventListener('close', function () {
      // Our own close already cleared the flag; otherwise treat it as a cancel.
      if (state.eventOpen) {
        state.eventOpen = false;
        restoreFocus(state.eventReturnTarget, []);
      }
    });

    dom.confirmCancel.addEventListener('click', cancelConfirmDialog);
    dom.confirmAction.addEventListener('click', handleConfirmAction);
    dom.confirmDialog.addEventListener('keydown', trapTab);
    // Escape closes only the confirm dialog, like 취소.
    dom.confirmDialog.addEventListener('cancel', function (event) {
      event.preventDefault();
      cancelConfirmDialog();
    });
    // Covers a native close that bypassed our cancel handler.
    dom.confirmDialog.addEventListener('close', function () {
      // Our own close already cleared the flag; otherwise treat it as a cancel.
      if (state.confirmOpen) {
        state.confirmOpen = false;
        state.confirmPurpose = null;
        restoreFocus(state.confirmReturnTarget, state.eventOpen ? [dom.deleteEvent] : []);
      }
    });
  }

  /** Loads storage once and renders the first view (S1, S2, S15). */
  function start() {
    bindEvents();
    // Initial read; load() never writes.
    const initial = store.load();
    // Readable data renders normally; unreadable shows the banner and an empty calendar.
    if (initial.status === 'ok') {
      state.events = initial.events;
      render();
    } else {
      enterUnreadable(initial.raw);
    }
  }

  start();
})();
