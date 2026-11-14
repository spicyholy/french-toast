// CL01-SCHED T1 unit tests for src/model.js.
// Expectations come from the PRD (SCH-001, SCH-004, SCH-006), design §3, §8.3
// and the brief's storage contract, not from the implementation.
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');

const model = require(path.join(__dirname, '..', '..', 'src', 'model.js'));

// Design §8.3 strings.
const MSG = {
  titleEmpty: '제목을 입력해 주세요.',
  titleTooLong: '제목은 100자 이하로 입력해 주세요.',
  dateInvalid: '날짜를 선택해 주세요.',
  startEmpty: '시작 시간을 입력해 주세요.',
  endEmpty: '종료 시간을 입력해 주세요.',
  endNotAfterStart: '종료 시간은 시작 시간보다 늦어야 합니다.',
  notesTooLong: '메모는 1000자 이하로 입력해 주세요.'
};

function form(overrides) {
  return Object.assign({
    title: '회의', date: '2026-11-14', allDay: false, start: '09:00', end: '10:00',
    category: 'work', notes: ''
  }, overrides);
}

// Independent weekday (0 = Sunday) for the proleptic Gregorian calendar (Sakamoto).
function weekday(y, m, d) {
  const t = [0, 3, 2, 5, 0, 3, 5, 1, 4, 6, 2, 4];
  if (m < 3) y -= 1;
  return (y + Math.floor(y / 4) - Math.floor(y / 100) + Math.floor(y / 400) + t[m - 1] + d) % 7;
}
function isLeap(y) { return (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0; }

test('SCH-004 AC2 title: 100 code points saves, 101 is blocked (ASCII)', () => {
  assert.equal(model.validateEvent(form({ title: 'a'.repeat(100) })).ok, true);
  const r = model.validateEvent(form({ title: 'a'.repeat(101) }));
  assert.equal(r.ok, false);
  assert.equal(r.errors.title, MSG.titleTooLong);
  assert.equal(r.value, null);
});

test('SCH-004 AC2 title: emoji count as one code point each (100 ok, 101 blocked)', () => {
  const e100 = '😀'.repeat(100);
  assert.equal(e100.length, 200); // UTF-16 units, proves code-point counting is required
  assert.equal(model.validateEvent(form({ title: e100 })).ok, true);
  const r = model.validateEvent(form({ title: '😀'.repeat(101) }));
  assert.equal(r.ok, false);
  assert.equal(r.errors.title, MSG.titleTooLong);
});

test('SCH-004 title is trimmed before counting and saving', () => {
  const r = model.validateEvent(form({ title: '  ' + 'b'.repeat(100) + '  ' }));
  assert.equal(r.ok, true);
  assert.equal(r.value.title, 'b'.repeat(100));
});

test('SCH-004 AC1 empty and whitespace-only titles are blocked', () => {
  for (const title of ['', '   ', '\t\n ', '　']) {
    const r = model.validateEvent(form({ title }));
    assert.equal(r.ok, false, JSON.stringify(title));
    assert.equal(r.errors.title, MSG.titleEmpty);
  }
});

test('SCH-004 AC2 notes: 1000 code points saves, 1001 is blocked (ASCII and emoji)', () => {
  assert.equal(model.validateEvent(form({ notes: 'n'.repeat(1000) })).ok, true);
  assert.equal(model.validateEvent(form({ notes: '🎉'.repeat(1000) })).ok, true);
  for (const notes of ['n'.repeat(1001), '🎉'.repeat(1001)]) {
    const r = model.validateEvent(form({ notes }));
    assert.equal(r.ok, false);
    assert.equal(r.errors.notes, MSG.notesTooLong);
  }
});

test('SCH-004 AC1 end equal to start or earlier is blocked; later is accepted', () => {
  let r = model.validateEvent(form({ start: '10:00', end: '10:00' }));
  assert.equal(r.ok, false);
  assert.equal(r.errors.end, MSG.endNotAfterStart);
  r = model.validateEvent(form({ start: '10:00', end: '09:59' }));
  assert.equal(r.errors.end, MSG.endNotAfterStart);
  r = model.validateEvent(form({ start: '10:00', end: '10:01' }));
  assert.equal(r.ok, true);
  assert.equal(r.value.start, '10:00');
  assert.equal(r.value.end, '10:01');
});

test('SCH-004 AC1 missing start or end time is blocked when not all-day', () => {
  let r = model.validateEvent(form({ start: '', end: '10:00' }));
  assert.equal(r.errors.start, MSG.startEmpty);
  r = model.validateEvent(form({ start: '09:00', end: '' }));
  assert.equal(r.errors.end, MSG.endEmpty);
});

test('SCH-002 AC1 all-day ignores times and stores null start/end', () => {
  const r = model.validateEvent(form({ allDay: true, start: '', end: '' }));
  assert.equal(r.ok, true);
  assert.equal(r.value.allDay, true);
  assert.equal(r.value.start, null);
  assert.equal(r.value.end, null);
  const r2 = model.validateEvent(form({ allDay: true, start: '11:00', end: '10:00' }));
  assert.equal(r2.ok, true);
});

test('SCH-004 AC1 missing or impossible dates are blocked', () => {
  for (const date of ['', '2026-02-29', '2026-02-30', '2026-13-01', '2026-00-10', '2026-11-31', '1900-02-29', '0100-02-29', '26-11-14', '2026-1-14']) {
    const r = model.validateEvent(form({ date }));
    assert.equal(r.ok, false, date);
    assert.equal(r.errors.date, MSG.dateInvalid, date);
  }
  for (const date of ['2028-02-29', '2000-02-29', '2026-12-31', '0026-11-14', '0000-02-29', '0004-02-29']) {
    assert.equal(model.validateEvent(form({ date })).ok, true, date);
  }
});

test('Year 0026 (code review F1): low years are not shifted to 19xx', () => {
  // Weekday of 0026-11-14 in the proleptic Gregorian calendar differs from 1926-11-14.
  assert.notEqual(weekday(26, 11, 14), weekday(1926, 11, 14));
  assert.equal(model.weekdayOf('0026-11-14'), weekday(26, 11, 14));
  assert.equal(model.weekdayOf('2026-11-14'), 6); // design: 11-14 is a Saturday
  // Grid for November 0026 starts on the Sunday on/before 0026-11-01 and covers the whole month.
  const g = model.buildMonthGrid(26, 10);
  const lead = weekday(26, 11, 1);
  const cells = g.weeks.flat();
  const firstIn = cells.findIndex(c => c.inMonth);
  assert.equal(firstIn, lead);
  assert.equal(cells[firstIn].date, '0026-11-01');
  assert.equal(cells.filter(c => c.inMonth).length, 30);
  // Year 0 is a leap year; 1900 is not.
  assert.equal(isLeap(0), true);
  assert.equal(model.isValidDateString('0000-02-29'), true);
  assert.equal(model.daysInMonth(0, 1), 29);
  assert.equal(model.addDays('0026-12-31', 1), '0027-01-01');
});

test('SCH-004 errors are reported for every invalid field at once', () => {
  const r = model.validateEvent(form({ title: ' ', date: '', start: '10:00', end: '09:00', notes: 'x'.repeat(1001) }));
  assert.equal(r.ok, false);
  assert.deepEqual(Object.keys(r.errors).sort(), ['date', 'end', 'notes', 'title']);
});

test('SCH-002 AC1 valid input yields the record body with category and notes kept', () => {
  const r = model.validateEvent(form({ category: 'health', notes: '  메모 ' }));
  assert.equal(r.ok, true);
  assert.equal(r.value.category, 'health');
  assert.equal(r.value.notes, '  메모 ');
  assert.equal(r.value.date, '2026-11-14');
});

test('SCH-001 grid: Sunday start, 5 or 6 weeks, covers the month', () => {
  const nov = model.buildMonthGrid(2026, 10);
  assert.equal(nov.weeks.length, 5); // design §2.1: November 2026 needs 5 rows
  assert.equal(nov.weeks[0][0].date, '2026-11-01');
  assert.equal(nov.weeks[4][1].date, '2026-11-30');
  assert.equal(nov.weeks[4][2].date, '2026-12-01');
  assert.equal(nov.weeks[4][2].inMonth, false);
  const aug = model.buildMonthGrid(2026, 7); // 2026-08-01 is a Saturday, 31 days -> 6 rows
  assert.equal(weekday(2026, 8, 1), 6);
  assert.equal(aug.weeks.length, 6);
  for (let m = 0; m < 12; m++) {
    const g = model.buildMonthGrid(2026, m);
    assert.ok(g.weeks.length === 5 || g.weeks.length === 6, 'month ' + m);
    for (const w of g.weeks) {
      assert.equal(w.length, 7);
      assert.equal(weekday(...w[0].date.split('-').map(Number)), 0);
    }
    const inMonth = g.weeks.flat().filter(c => c.inMonth).length;
    assert.equal(inMonth, new Date(Date.UTC(2026, m + 1, 0)).getUTCDate());
  }
});

test('SCH-001 month navigation clamps the day (design §3.1, §6.2)', () => {
  assert.equal(model.addMonthsClamped('2026-03-31', 1), '2026-04-30');
  assert.equal(model.addMonthsClamped('2026-01-31', 1), '2026-02-28');
  assert.equal(model.addMonthsClamped('2028-01-31', 1), '2028-02-29');
  assert.equal(model.addMonthsClamped('2026-12-15', 1), '2027-01-15');
  assert.equal(model.addMonthsClamped('2026-01-15', -1), '2025-12-15');
});

test('PRD ordering: all-day first, then start time, then title', () => {
  const base = { date: '2026-11-14', category: 'work', notes: '', createdAt: '2026-11-14T00:00:00.000Z', updatedAt: '2026-11-14T00:00:00.000Z' };
  const evs = [
    Object.assign({ id: '1', title: '다', allDay: false, start: '12:00', end: '13:00' }, base),
    Object.assign({ id: '2', title: '나', allDay: false, start: '09:00', end: '10:00' }, base),
    Object.assign({ id: '3', title: '가', allDay: false, start: '09:00', end: '09:30' }, base),
    Object.assign({ id: '4', title: '하', allDay: true, start: null, end: null }, base),
    Object.assign({ id: '5', title: '가', allDay: true, start: null, end: null }, base)
  ];
  const sorted = evs.slice().sort(model.compareEvents).map(e => e.id);
  assert.deepEqual(sorted, ['5', '4', '3', '2', '1']);
});

test('SCH-006 AC1-AC3 search ignores case on title and notes; filter and search combine', () => {
  const a = { title: 'Weekly MEETING', notes: '', category: 'work' };
  const b = { title: '등산', notes: '회의 후 meeting', category: 'health' };
  const c = { title: '독서', notes: '', category: 'personal' };
  assert.equal(model.matchesQuery(a, 'meeting', 'all'), true);
  assert.equal(model.matchesQuery(b, 'MEETING', 'all'), true);
  assert.equal(model.matchesQuery(c, 'meeting', 'all'), false);
  assert.equal(model.matchesQuery(b, '회의', 'all'), true);
  assert.equal(model.matchesQuery(a, '  meeting  ', 'all'), true);
  assert.equal(model.matchesQuery(a, 'meeting', 'health'), false);
  assert.equal(model.matchesQuery(b, 'meeting', 'health'), true);
  assert.equal(model.matchesQuery(c, '', 'all'), true);
  assert.equal(model.matchesQuery(c, '', 'personal'), true);
  assert.equal(model.matchesQuery(c, '', 'work'), false);
});

function rec(over) {
  return Object.assign({ id: 'r1', title: '회의', date: '2026-11-14', allDay: false, start: '09:00', end: '10:00', category: 'work', notes: '', createdAt: '2026-11-14T01:00:00.000Z', updatedAt: '2026-11-14T01:00:00.000Z' }, over);
}

test('Storage contract record shape check (brief)', () => {
  assert.equal(model.isValidRecord(rec()), true);
  assert.equal(model.isValidRecord(rec({ allDay: true, start: null, end: null })), true);
  assert.equal(model.isValidRecord(rec({ extra: { keep: 1 } })), true);
  assert.equal(model.isValidRecord(rec({ title: '😀'.repeat(100) })), true);
  const bad = [
    rec({ id: '' }), rec({ id: 5 }), rec({ title: ' 회의' }), rec({ title: '' }), rec({ title: 'a'.repeat(101) }),
    rec({ date: '2026-02-30' }), rec({ allDay: 'false' }), rec({ allDay: true }), rec({ start: '10:00', end: '10:00' }),
    rec({ start: '25:00' }), rec({ category: 'travel' }), rec({ notes: 'x'.repeat(1001) }), rec({ notes: null }),
    rec({ createdAt: '' }), rec({ updatedAt: 'not a date' }), null, [], 'x'
  ];
  bad.forEach((r, i) => assert.equal(model.isValidRecord(r), false, 'bad #' + i));
});
