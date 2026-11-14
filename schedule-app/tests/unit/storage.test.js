// CL01-SCHED T1 unit tests for src/storage.js against a fake Storage.
// Expectations come from the brief's storage contract and SCH-005.
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');

const storage = require(path.join(__dirname, '..', '..', 'src', 'storage.js'));
const KEY = 'schedule-app.events.v1';

function fake(initial, opts) {
  const o = opts || {};
  const map = new Map();
  if (initial !== undefined) map.set(KEY, initial);
  const log = { gets: 0, sets: [] };
  return {
    log,
    map,
    getItem(k) { log.gets++; if (o.getThrows) throw new Error('get blocked'); return map.has(k) ? map.get(k) : null; },
    setItem(k, v) { if (o.setThrows) { const e = new Error('QuotaExceededError'); e.name = 'QuotaExceededError'; throw e; } log.sets.push([k, v]); map.set(k, String(v)); },
    removeItem(k) { log.sets.push([k, undefined]); map.delete(k); }
  };
}

function rec(over) {
  return Object.assign({ id: 'a', title: '회의', date: '2026-11-14', allDay: false, start: '09:00', end: '10:00', category: 'work', notes: '', createdAt: '2026-11-14T01:00:00.000Z', updatedAt: '2026-11-14T01:00:00.000Z' }, over);
}

test('storage key is schedule-app.events.v1', () => {
  assert.equal(storage.STORAGE_KEY, KEY);
  const s = fake();
  assert.equal(storage.createStore(() => s, KEY).key, KEY);
});

test('SCH-005 missing key loads as ok with no events and raw null', () => {
  const s = fake();
  const r = storage.createStore(() => s, KEY).load();
  assert.equal(r.status, 'ok');
  assert.deepEqual(r.events, []);
  assert.equal(r.raw, null);
  assert.equal(s.log.sets.length, 0);
});

test('SCH-005 AC1 valid data loads and preserves unknown extra fields', () => {
  const raw = JSON.stringify([rec(), rec({ id: 'b', allDay: true, start: null, end: null, extra: 'keep' })]);
  const s = fake(raw);
  const r = storage.createStore(() => s, KEY).load();
  assert.equal(r.status, 'ok');
  assert.equal(r.events.length, 2);
  assert.equal(r.events[1].extra, 'keep');
  assert.equal(r.raw, raw);
});

const unreadable = {
  'bad JSON': '{not json',
  'non-array object': '{"a":1}',
  'JSON string': '"[]"',
  'unknown category': JSON.stringify([rec({ category: 'travel' })]),
  'duplicate ids': JSON.stringify([rec(), rec({ title: '다른' })]),
  'invalid record': JSON.stringify([rec({ end: '08:00' })]),
  'null element': JSON.stringify([null])
};
for (const [name, raw] of Object.entries(unreadable)) {
  test('SCH-005 AC2 ' + name + ' is unreadable, nothing is written and raw is unchanged', () => {
    const s = fake(raw);
    const store = storage.createStore(() => s, KEY);
    const r = store.load();
    assert.equal(r.status, 'unreadable');
    assert.equal(r.raw, raw);
    assert.equal(s.log.sets.length, 0);
    assert.equal(s.map.get(KEY), raw);
    store.load();
    assert.equal(s.map.get(KEY), raw);
    assert.equal(s.log.sets.length, 0);
  });
}

test('SCH-005 throwing getter (blocked storage) is unreadable with raw undefined and never throws', () => {
  const store = storage.createStore(() => { const e = new Error('SecurityError'); e.name = 'SecurityError'; throw e; }, KEY);
  const r = store.load();
  assert.equal(r.status, 'unreadable');
  assert.equal(r.raw, undefined);
  const w = store.save([]);
  assert.equal(w.ok, false);
  assert.ok(w.error);
  const z = store.reset(undefined);
  assert.equal(z.ok, false);
  assert.notEqual(z.reason, 'changed');
  assert.ok(z.error);
});

test('SCH-005 throwing getItem is unreadable', () => {
  const s = fake('[]', { getThrows: true });
  const r = storage.createStore(() => s, KEY).load();
  assert.equal(r.status, 'unreadable');
});

test('SCH-005 AC3 throwing setItem (quota) returns ok:false and never throws', () => {
  const s = fake('[]', { setThrows: true });
  const r = storage.createStore(() => s, KEY).save([rec()]);
  assert.equal(r.ok, false);
  assert.ok(r.error);
  assert.equal(s.map.get(KEY), '[]');
});

test('SCH-005 AC1 save writes a JSON array that loads back', () => {
  const s = fake();
  const store = storage.createStore(() => s, KEY);
  assert.deepEqual(store.save([rec()]), { ok: true });
  const r = store.load();
  assert.equal(r.status, 'ok');
  assert.deepEqual(r.events, [rec()]);
});

test('readRaw returns the stored string unchanged', () => {
  const s = fake('{x');
  const r = storage.createStore(() => s, KEY).readRaw();
  assert.equal(r.ok, true);
  assert.equal(r.raw, '{x');
});

test('S17 reset writes [] only when raw still matches and is unreadable', () => {
  const s = fake('{a');
  const store = storage.createStore(() => s, KEY);
  assert.deepEqual(store.reset('{a'), { ok: true });
  assert.equal(s.map.get(KEY), '[]');
});

test('S22 reset returns changed without writing when raw differs', () => {
  const s = fake('{b');
  const r = storage.createStore(() => s, KEY).reset('{a');
  assert.equal(r.ok, false);
  assert.equal(r.reason, 'changed');
  assert.equal(s.log.sets.length, 0);
  assert.equal(s.map.get(KEY), '{b');
});

test('S22 reset does not write when the matching raw value is readable', () => {
  const raw = JSON.stringify([rec()]);
  const s = fake(raw);
  const r = storage.createStore(() => s, KEY).reset(raw);
  assert.equal(r.ok, false);
  assert.equal(r.reason, 'changed');
  assert.equal(s.map.get(KEY), raw);
});

test('S18 reset with failing setItem returns an error and keeps the raw value', () => {
  const s = fake('{a', { setThrows: true });
  const r = storage.createStore(() => s, KEY).reset('{a');
  assert.equal(r.ok, false);
  assert.ok(r.error);
  assert.equal(s.map.get(KEY), '{a');
});
