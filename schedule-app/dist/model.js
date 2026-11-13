(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.Onyu = api;
}(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  const KEY = 'onyu.schedule.v1';
  const CATEGORIES = { work: '업무', personal: '개인', health: '건강', study: '학습' };
  const pad = value => String(value).padStart(2, '0');
  const dateKey = date => `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
  function validDate(value) {
    if (typeof value !== 'string' || !/^[1-9]\d{3}-\d{2}-\d{2}$/.test(value)) return false;
    const [year, month, day] = value.split('-').map(Number);
    const date = new Date(year, month - 1, day);
    return date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day;
  }
  const validTime = value => typeof value === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(value);
  function validate(event) {
    if (typeof event.title !== 'string' || !event.title.trim() || event.title.trim().length > 100) return { field: 'title', message: '제목을 1~100자로 입력해 주세요.' };
    if (!validDate(event.date)) return { field: 'date', message: '올바른 날짜를 입력해 주세요.' };
    if (!validTime(event.start)) return { field: 'start', message: '시작 시간을 입력해 주세요.' };
    if (!validTime(event.end) || event.end <= event.start) return { field: 'end', message: '종료 시간은 시작 시간보다 늦어야 합니다.' };
    if (!Object.hasOwn(CATEGORIES, event.category)) return { field: 'category', message: '분류를 선택해 주세요.' };
    if (typeof event.notes !== 'string' || event.notes.length > 2000) return { field: 'notes', message: '메모는 2,000자 이내로 입력해 주세요.' };
    return null;
  }
  function decode(raw) {
    if (raw === null) return [];
    const data = JSON.parse(raw);
    if (!data || data.version !== 1 || !Array.isArray(data.events)) throw new Error('Unsupported data');
    const ids = new Set();
    return data.events.map(event => {
      if (!event || typeof event.id !== 'string' || !event.id || ids.has(event.id) || validate(event)) throw new Error('Invalid event');
      ids.add(event.id);
      return { id: event.id, title: event.title.trim(), date: event.date, start: event.start, end: event.end, category: event.category, notes: event.notes };
    });
  }
  function filterEvents(events, query, categories) {
    const text = query.trim().toLocaleLowerCase();
    return events.filter(event => categories.includes(event.category) && (!text || `${event.title}\n${event.notes}`.toLocaleLowerCase().includes(text))).sort((a, b) => a.date.localeCompare(b.date) || a.start.localeCompare(b.start) || a.title.localeCompare(b.title, 'ko'));
  }
  function monthDays(year, month) {
    const start = new Date(year, month, 1);
    start.setDate(1 - start.getDay());
    return Array.from({ length: 42 }, (_, index) => new Date(start.getFullYear(), start.getMonth(), start.getDate() + index));
  }
  function createStore(getStorage) {
    const store = {
      events: [], status: 'read-error',
      get locked() { return this.status === 'read-error' || this.status === 'invalid'; },
      load() {
        let raw;
        try { raw = getStorage().getItem(KEY); } catch { this.status = 'read-error'; return false; }
        try { this.events = decode(raw); this.status = 'ready'; return true; } catch { this.status = 'invalid'; return false; }
      },
      persist() {
        if (this.locked) return false;
        try { getStorage().setItem(KEY, JSON.stringify({ version: 1, events: this.events })); this.status = 'ready'; return true; }
        catch { this.status = 'write-error'; return false; }
      },
      replace(events) {
        if (this.locked) return false;
        this.events = events;
        return this.persist();
      },
      retry() { return this.locked ? this.load() : this.persist(); },
      reset() { this.events = []; this.status = 'ready'; return this.persist(); }
    };
    store.load();
    return store;
  }
  return { KEY, CATEGORIES, dateKey, validDate, validTime, validate, decode, filterEvents, monthDays, createStore };
}));
