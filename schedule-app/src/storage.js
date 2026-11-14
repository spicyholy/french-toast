/*
 * Schedule app storage boundary (CL01-SCHED, SCH-005).
 * createStore(getStorage, key) wraps a Storage-like object. The getter is
 * called inside each method's try, because reading window.localStorage itself
 * throws a SecurityError when site data is blocked (brief F3). No method throws.
 */
(function () {
  'use strict';

  // Under Node the model comes from require(); in the browser from the shared namespace.
  const model = (typeof module !== 'undefined' && module && module.exports)
    ? require('./model.js')
    : globalThis.ScheduleApp.model;

  // Versioned storage key from the brief's storage contract.
  const STORAGE_KEY = 'schedule-app.events.v1';

  /**
   * Classifies a raw stored string without writing anything.
   * Returns {status: 'ok', events, raw} or {status: 'unreadable', reason, raw}.
   */
  function parseRaw(raw) {
    // A missing key is a valid empty first run (S1).
    if (raw === null) {
      return { status: 'ok', events: [], raw: null };
    }
    // Parsed JSON value, filled inside the try below.
    let parsed;
    // JSON errors are an unreadable state, never an exception.
    try {
      parsed = JSON.parse(raw);
    } catch (error) {
      return { status: 'unreadable', reason: 'parse', raw: raw };
    }
    // The stored value must be an array of records.
    if (!Array.isArray(parsed)) {
      return { status: 'unreadable', reason: 'shape', raw: raw };
    }
    // Ids seen so far, to detect duplicates.
    const seenIds = new Set();
    // Check every record's shape and id uniqueness.
    for (const record of parsed) {
      // One invalid record makes the whole value unreadable (brief decision 3).
      if (!model.isValidRecord(record)) {
        return { status: 'unreadable', reason: 'record', raw: raw };
      }
      // A repeated id would make edits and deletes ambiguous.
      if (seenIds.has(record.id)) {
        return { status: 'unreadable', reason: 'duplicate-id', raw: raw };
      }
      seenIds.add(record.id);
    }
    return { status: 'ok', events: parsed, raw: raw };
  }

  /** Creates the store for one key over an injected storage getter. */
  function createStore(getStorage, key) {
    // Default to the app's key when the caller omits it.
    const storageKey = key || STORAGE_KEY;

    /** Reads the raw string: {ok: true, raw} (raw may be null) or {ok: false, error}. */
    function readRaw() {
      // Getter and getItem both may throw.
      try {
        return { ok: true, raw: getStorage().getItem(storageKey) };
      } catch (error) {
        return { ok: false, error: error };
      }
    }

    /** Loads and validates stored events. Never writes (SCH-005 AC2). */
    function load() {
      // Current raw value or the access error.
      const read = readRaw();
      // An access error is unreadable with raw undefined (design open issue 2).
      if (!read.ok) {
        return { status: 'unreadable', reason: 'access', raw: undefined, error: read.error };
      }
      return parseRaw(read.raw);
    }

    /** Writes the whole list. Returns {ok: true} or {ok: false, error}; never throws. */
    function save(events) {
      // Getter, serialization and setItem (quota) may all throw.
      try {
        getStorage().setItem(storageKey, JSON.stringify(events));
        return { ok: true };
      } catch (error) {
        return { ok: false, error: error };
      }
    }

    /**
     * Writes [] only if the current raw value still === expectedRaw and is
     * still unreadable. Returns {ok: true}, {ok: false, reason: 'changed'}
     * without writing, or {ok: false, error}.
     */
    function reset(expectedRaw) {
      // Getter, getItem and setItem may all throw.
      try {
        // Storage object resolved once for both the read and the write.
        const storage = getStorage();
        // Value present right now, just before the guarded write.
        const current = storage.getItem(storageKey);
        // Another tab changed the value, or it became readable: do not write (S22).
        if (current !== expectedRaw || parseRaw(current).status !== 'unreadable') {
          return { ok: false, reason: 'changed' };
        }
        storage.setItem(storageKey, '[]');
        return { ok: true };
      } catch (error) {
        return { ok: false, error: error };
      }
    }

    return { key: storageKey, load: load, save: save, readRaw: readRaw, reset: reset };
  }

  // Public storage API.
  const api = { STORAGE_KEY: STORAGE_KEY, createStore: createStore, parseRaw: parseRaw };

  // Shared namespace; extend it, never replace it.
  const namespace = (globalThis.ScheduleApp = globalThis.ScheduleApp || {});
  namespace.storage = api;

  // Node export for tests when a CommonJS module object exists.
  if (typeof module !== 'undefined' && module && module.exports) {
    module.exports = api;
  }
})();
