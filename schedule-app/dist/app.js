(function () {
  'use strict';
  const M = window.Onyu;
  const $ = id => document.getElementById(id);
  const store = M.createStore(() => window.localStorage);
  const now = new Date();
  let selected = M.dateKey(now);
  let year = now.getFullYear();
  let month = now.getMonth();
  let query = '';
  let categories = Object.keys(M.CATEGORIES);
  let editingId = null;
  let confirmCallback = null;
  let eventTrigger = null;
  let confirmTrigger = null;
  let toastTimer;
  const form = $('event-form');
  const eventDialog = $('event-dialog');
  const confirmDialog = $('confirm-dialog');
  const fields = Object.fromEntries(['title', 'date', 'start', 'end', 'category', 'notes'].map(name => [name, $(`event-${name}`)]));
  const weekdays = ['일요일', '월요일', '화요일', '수요일', '목요일', '금요일', '토요일'];

  function element(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  }
  function localDate(key) { const [y, m, d] = key.split('-').map(Number); return new Date(y, m - 1, d); }
  function announce(text) {
    $('announcement').textContent = text;
    $('toast').textContent = text;
    $('toast').hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { $('toast').hidden = true; }, 2800);
  }
  function restoreFocus(trigger) {
    const target = trigger && trigger.isConnected && !trigger.disabled ? trigger : $('new-event');
    if (!target.disabled) target.focus();
    else $('retry-storage').focus();
  }
  function allFiltered() { return M.filterEvents(store.events, query, categories); }
  function filteredActive() { return query.trim() !== '' || categories.length !== Object.keys(M.CATEGORIES).length; }
  function renderStorage() {
    const locked = store.locked;
    $('new-event').disabled = locked;
    $('add-selected').disabled = locked;
    $('storage-warning').hidden = store.status === 'ready';
    $('reset-storage').hidden = !locked;
    $('storage-label').textContent = store.status === 'ready' ? '이 브라우저에 저장됨' : '저장 상태를 확인해 주세요';
    const messages = {
      'read-error': '저장된 일정을 읽지 못했습니다. 기존 일정 보호를 위해 편집을 잠시 멈췄습니다. 브라우저의 저장 권한을 확인한 뒤 다시 시도해 주세요. 다시 시도는 기존 일정을 읽기만 합니다.',
      invalid: '저장된 데이터의 형식을 확인할 수 없습니다. 원본 데이터는 그대로 보존했습니다. 다시 시도하거나, 기존 데이터를 지우는 초기화를 선택해 주세요.',
      'write-error': '저장하지 못했습니다. 지금 변경한 일정은 이 화면에 남아 있지만, 새로고침하면 사라질 수 있습니다. 저장 공간과 브라우저 권한을 확인하고 다시 시도해 주세요.'
    };
    $('storage-message').textContent = messages[store.status] || '';
  }
  function renderCalendar(filtered) {
    $('month-label').textContent = `${year}년 ${month + 1}월`;
    $('prev-month').disabled = year === 1000 && month === 0;
    $('next-month').disabled = year === 9999 && month === 11;
    const prefix = `${year}-${String(month + 1).padStart(2, '0')}-`;
    const count = filtered.filter(event => event.date.startsWith(prefix)).length;
    $('month-summary').textContent = filteredActive() ? `검색·분류에 맞는 일정 ${count}개` : `이번 달, ${count}개의 소중한 일정`;
    const byDate = new Map();
    for (const event of filtered) {
      if (!byDate.has(event.date)) byDate.set(event.date, []);
      byDate.get(event.date).push(event);
    }
    const today = M.dateKey(new Date());
    const fragment = document.createDocumentFragment();
    for (const date of M.monthDays(year, month)) {
      const key = M.dateKey(date);
      const events = byDate.get(key) || [];
      const outside = date.getMonth() !== month;
      const day = element('button', `day${outside ? ' outside' : ''}${key === selected ? ' selected' : ''}${key === today ? ' today' : ''}`);
      day.type = 'button';
      day.dataset.date = key;
      day.disabled = !M.validDate(key);
      day.setAttribute('aria-label', `${date.getFullYear()}년 ${date.getMonth() + 1}월 ${date.getDate()}일 ${weekdays[date.getDay()]}${key === today ? ', 오늘' : ''}, 일정 ${events.length}개`);
      day.setAttribute('aria-pressed', String(key === selected));
      if (key === today) day.setAttribute('aria-current', 'date');
      day.append(element('span', 'day-number', date.getDate()));
      for (const event of events.slice(0, 2)) {
        const chip = element('span', `event-chip ${event.category}`);
        chip.setAttribute('aria-hidden', 'true');
        chip.append(element('span', 'chip-time', event.start), document.createTextNode(event.title));
        chip.title = `${event.start} ${event.title} · ${M.CATEGORIES[event.category]}`;
        day.append(chip);
      }
      if (events.length > 2) day.append(element('span', 'more-events', `+${events.length - 2}개 더`));
      day.addEventListener('click', () => {
        selected = key;
        year = date.getFullYear();
        month = date.getMonth();
        render();
        const updated = [...$('calendar').children].find(node => node.dataset.date === key);
        if (updated) updated.focus({ preventScroll: true });
      });
      fragment.append(day);
    }
    $('calendar').replaceChildren(fragment);
  }
  function renderAgenda(filtered) {
    const date = localDate(selected);
    const dayEvents = filtered.filter(event => event.date === selected);
    $('selected-date').textContent = `${date.getMonth() + 1}월 ${date.getDate()}일`;
    $('selected-weekday').textContent = weekdays[date.getDay()];
    $('day-summary').textContent = `${date.getFullYear()}년 · ${dayEvents.length}개의 일정${M.dateKey(new Date()) === selected ? ' · 오늘' : ''}`;
    const fragment = document.createDocumentFragment();
    if (!dayEvents.length) {
      const empty = element('div', 'empty-agenda');
      const icon = element('div', 'empty-icon');
      icon.setAttribute('aria-hidden', 'true');
      icon.innerHTML = '<svg viewBox="0 0 32 32"><rect x="7" y="7" width="18" height="20" rx="3"/><path d="M12 5v5M20 5v5M7 14h18m-12 6 2 2 4-4"/></svg>';
      const hasHiddenEvents = store.events.some(event => event.date === selected);
      empty.append(icon, element('h3', '', store.locked ? '저장 상태를 확인해 주세요' : hasHiddenEvents && filteredActive() ? '조건에 맞는 일정이 없어요' : '여유로운 하루네요'), element('p', '', store.locked ? '위 안내에서 다시 시도해 주세요.' : hasHiddenEvents && filteredActive() ? '검색어나 분류를 바꾸어 확인해 보세요.' : '아직 등록된 일정이 없어요.\n나를 위한 시간을 계획해 볼까요?'));
      if (filteredActive()) {
        const reset = element('button', 'button small', '필터 초기화');
        reset.type = 'button';
        reset.addEventListener('click', resetFilters);
        empty.append(reset);
      }
      fragment.append(empty);
    }
    for (const event of dayEvents) {
      const card = element('article', `agenda-card ${event.category}`);
      card.append(element('p', 'event-time', `${event.start} — ${event.end}`), element('h3', '', event.title));
      if (event.notes) card.append(element('p', 'event-notes', event.notes));
      const bottom = element('div', 'card-bottom');
      const actions = element('div', 'card-actions');
      const edit = element('button', 'text-button', '수정');
      edit.type = 'button';
      edit.setAttribute('aria-label', `${event.title} 일정 수정`);
      edit.disabled = store.locked;
      edit.addEventListener('click', () => openEvent(event, edit));
      const remove = element('button', 'text-button', '삭제');
      remove.type = 'button';
      remove.setAttribute('aria-label', `${event.title} 일정 삭제`);
      remove.disabled = store.locked;
      remove.addEventListener('click', () => askConfirm('일정을 삭제할까요?', `“${event.title}” 일정을 삭제합니다. 삭제한 일정은 되돌릴 수 없습니다.`, '삭제', () => {
        store.replace(store.events.filter(item => item.id !== event.id));
        render();
        announce(store.status === 'ready' ? '일정을 삭제했습니다.' : '일정을 삭제했지만 저장에 실패했습니다. 위 안내를 확인해 주세요.');
      }, remove));
      actions.append(edit, remove);
      bottom.append(element('span', 'category-label', M.CATEGORIES[event.category]), actions);
      card.append(bottom);
      fragment.append(card);
    }
    $('agenda').replaceChildren(fragment);
  }
  function render() { const filtered = allFiltered(); renderStorage(); renderCalendar(filtered); renderAgenda(filtered); }
  function resetFilters() {
    query = '';
    categories = Object.keys(M.CATEGORIES);
    $('search').value = '';
    $('category-options').querySelectorAll('input').forEach(input => { input.checked = true; });
    render();
    $('search').focus();
  }
  function clearErrors() {
    $('form-error').hidden = true;
    Object.values(fields).forEach(field => { field.removeAttribute('aria-invalid'); field.removeAttribute('aria-describedby'); });
  }
  function openEvent(event, trigger) {
    if (store.locked) return;
    eventTrigger = trigger;
    editingId = event ? event.id : null;
    form.reset();
    clearErrors();
    $('event-dialog-title').textContent = event ? '일정 수정하기' : '새 일정 만들기';
    const data = event || { title: '', date: selected, start: '09:00', end: '10:00', category: 'personal', notes: '' };
    Object.entries(fields).forEach(([name, field]) => { field.value = data[name]; });
    eventDialog.showModal();
    fields.title.focus();
  }
  function askConfirm(title, description, action, callback, trigger) {
    confirmTrigger = trigger;
    confirmCallback = callback;
    $('confirm-title').textContent = title;
    $('confirm-description').textContent = description;
    $('confirm-action').textContent = action;
    confirmDialog.showModal();
    $('confirm-cancel').focus();
  }
  function moveMonth(delta) {
    const next = new Date(year, month + delta, 1);
    if (next.getFullYear() < 1000 || next.getFullYear() > 9999) return;
    year = next.getFullYear();
    month = next.getMonth();
    selected = M.dateKey(next);
    render();
  }
  for (const [key, name] of Object.entries(M.CATEGORIES)) {
    const label = element('label', `category-option ${key}`);
    const input = document.createElement('input');
    input.type = 'checkbox'; input.value = key; input.checked = true;
    input.addEventListener('change', () => {
      categories = [...$('category-options').querySelectorAll('input:checked')].map(field => field.value);
      render();
    });
    const dot = element('span', 'category-dot'); dot.style.background = 'var(--cat)'; dot.setAttribute('aria-hidden', 'true');
    label.append(input, document.createTextNode(name), dot);
    $('category-options').append(label);
  }
  $('new-event').addEventListener('click', () => openEvent(null, $('new-event')));
  $('add-selected').addEventListener('click', () => openEvent(null, $('add-selected')));
  $('prev-month').addEventListener('click', () => moveMonth(-1));
  $('next-month').addEventListener('click', () => moveMonth(1));
  $('today').addEventListener('click', () => {
    const date = new Date(); year = date.getFullYear(); month = date.getMonth(); selected = M.dateKey(date); render();
  });
  $('search').addEventListener('input', event => { query = event.target.value; render(); });
  $('retry-storage').addEventListener('click', () => {
    const wasLocked = store.locked;
    const success = store.retry(); render();
    announce(success ? wasLocked ? '저장된 일정을 불러왔습니다.' : '일정을 이 브라우저에 저장했습니다.' : '다시 시도했지만 저장소에 접근하지 못했습니다.');
    if (success) $('new-event').focus();
  });
  $('reset-storage').addEventListener('click', () => askConfirm('저장 데이터를 초기화할까요?', '이 브라우저에 저장된 온유 일정 데이터를 모두 지우고 빈 일정으로 시작합니다. 읽지 못한 기존 일정도 삭제되며 되돌릴 수 없습니다.', '초기화', () => {
    store.reset(); render(); announce(store.status === 'ready' ? '저장 데이터를 초기화했습니다.' : '빈 일정으로 시작합니다. 저장에 실패했으니 위 안내를 확인해 주세요.');
  }, $('reset-storage')));
  form.addEventListener('submit', event => {
    event.preventDefault();
    if (store.locked) return;
    clearErrors();
    const data = Object.fromEntries(Object.entries(fields).map(([name, field]) => [name, field.value]));
    data.title = data.title.trim();
    const error = M.validate(data);
    if (error) {
      $('form-error').textContent = error.message;
      $('form-error').hidden = false;
      fields[error.field].setAttribute('aria-invalid', 'true');
      fields[error.field].setAttribute('aria-describedby', 'form-error');
      fields[error.field].focus();
      return;
    }
    const wasEditing = editingId !== null;
    data.id = editingId || (window.crypto && typeof window.crypto.randomUUID === 'function' ? window.crypto.randomUUID() : `event-${Date.now()}-${Math.random().toString(36).slice(2)}`);
    const events = wasEditing ? store.events.map(item => item.id === editingId ? data : item) : [...store.events, data];
    store.replace(events);
    selected = data.date;
    const date = localDate(selected); year = date.getFullYear(); month = date.getMonth();
    eventDialog.close(); render();
    const hiddenByFilters = !M.filterEvents([data], query, categories).length;
    announce(store.status !== 'ready' ? '변경했지만 저장에 실패했습니다. 위 안내를 확인해 주세요.' : hiddenByFilters ? '일정을 저장했습니다. 현재 검색·분류 필터에는 표시되지 않습니다.' : wasEditing ? '일정을 수정했습니다.' : '새 일정을 저장했습니다.');
  });
  document.querySelectorAll('[data-close]').forEach(button => button.addEventListener('click', () => $(button.dataset.close).close()));
  eventDialog.addEventListener('close', () => restoreFocus(eventTrigger));
  confirmDialog.addEventListener('close', () => { confirmCallback = null; restoreFocus(confirmTrigger); });
  $('confirm-cancel').addEventListener('click', () => confirmDialog.close());
  $('confirm-action').addEventListener('click', () => {
    const action = confirmCallback;
    confirmCallback = null;
    confirmDialog.close();
    if (action) action();
  });
  render();
}());
