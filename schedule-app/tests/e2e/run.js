// CL01-SCHED T1 end-to-end harness: drives headless Chrome over CDP.
// Usage (from the repository root):
//   node schedule-app/tests/e2e/run.js [--mode=file|http] [--out=schedule-app/tests/T1]
// Expectations come from the PRD (SCH-001..007) and design §3-§8, not the implementation.
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const { execFileSync } = require('node:child_process');
const { pathToFileURL } = require('node:url');
const { launchChrome, Cdp, delay } = require('./cdp.js');

const APP_DIR = path.resolve(__dirname, '..', '..');
const REPO = path.resolve(APP_DIR, '..');
const args = Object.fromEntries(process.argv.slice(2).map(a => a.replace(/^--/, '').split('=')));
const MODE = args.mode || 'file';
const OUT = path.resolve(REPO, args.out || 'schedule-app/tests/T1');
const SHOTS = path.join(OUT, 'screenshots-' + MODE);
fs.mkdirSync(SHOTS, { recursive: true });

const KEY = 'schedule-app.events.v1';

// ---- Exact strings from design §8 ----
const S = {
  bannerText: '저장된 일정을 불러올 수 없습니다. 저장된 데이터는 변경되지 않았습니다.',
  bannerBtn: '데이터 초기화',
  added: '일정을 추가했습니다.',
  updated: '일정을 수정했습니다.',
  deleted: '일정을 삭제했습니다.',
  resetDone: '저장 데이터를 초기화했습니다.',
  goneOnDelete: '이 일정은 다른 곳에서 이미 삭제되었습니다.',
  reloaded: '저장된 데이터를 다시 불러왔습니다.',
  formAlert: '입력 내용을 확인해 주세요.',
  saveFail: '저장하지 못했습니다. 브라우저 저장 공간을 확인한 후 다시 시도해 주세요.',
  delTitle: '일정을 삭제할까요?',
  delMsg: t => '「' + t + '」 일정이 삭제되며 되돌릴 수 없습니다.',
  delFail: '삭제하지 못했습니다. 다시 시도해 주세요.',
  resetTitle: '저장된 데이터를 초기화할까요?',
  resetMsg: '읽을 수 없는 저장 데이터가 삭제되며 되돌릴 수 없습니다.',
  resetFail: '초기화하지 못했습니다. 다시 시도해 주세요.',
  s20: '저장된 데이터를 읽을 수 없어 변경하지 못했습니다. 입력 내용은 유지됩니다.',
  s21a: '이 일정은 다른 곳에서 삭제되었습니다. 저장을 다시 누르면 새 일정으로 저장됩니다.',
  s22b: '저장된 데이터가 바뀌었습니다. 내용을 다시 확인한 후 초기화해 주세요.',
  titleEmpty: '제목을 입력해 주세요.',
  titleLong: '제목은 100자 이하로 입력해 주세요.',
  dateBad: '날짜를 선택해 주세요.',
  startEmpty: '시작 시간을 입력해 주세요.',
  endEmpty: '종료 시간을 입력해 주세요.',
  endOrder: '종료 시간은 시작 시간보다 늦어야 합니다.',
  notesLong: '메모는 1000자 이하로 입력해 주세요.',
  dayEmpty: '이 날에는 일정이 없습니다.',
  dayNoMatch: '조건에 맞는 일정이 없습니다.',
  summaryN: n => '이번 달 검색 결과 ' + n + '개',
  summaryNone: '이번 달에 조건에 맞는 일정이 없습니다.',
  noscript: '이 앱을 사용하려면 JavaScript를 켜 주세요.'
};
const WD = ['일', '월', '화', '수', '목', '금', '토'];
// Independent proleptic Gregorian weekday (Sakamoto), 0 = Sunday.
function weekday(y, m, d) {
  const t = [0, 3, 2, 5, 0, 3, 5, 1, 4, 6, 2, 4];
  if (m < 3) y -= 1;
  return (y + Math.floor(y / 4) - Math.floor(y / 100) + Math.floor(y / 400) + t[m - 1] + d) % 7;
}

// ---- Result collection ----
// Key-order-independent JSON for deep equality (arrays keep their order).
function canon(v) {
  if (Array.isArray(v)) return '[' + v.map(canon).join(',') + ']';
  if (v && typeof v === 'object') return '{' + Object.keys(v).filter(k => v[k] !== undefined).sort().map(k => JSON.stringify(k) + ':' + canon(v[k])).join(',') + '}';
  return v === undefined ? '<undefined>' : JSON.stringify(v);
}
const checks = [];
let current = { scenario: '', viewport: '' };
function check(id, req, desc, expected, actual, pass) {
  const ok = pass === undefined ? canon(expected) === canon(actual) : !!pass;
  checks.push({ id, req, scenario: current.scenario, viewport: current.viewport, mode: MODE, desc, expected, actual, verdict: ok ? 'pass' : 'fail' });
  if (!ok) console.log('  FAIL', id, desc, '\n    expected:', JSON.stringify(expected), '\n    actual:  ', JSON.stringify(actual));
  return ok;
}

// ---- Static server for --mode=http ----
function startServer() {
  const types = { '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.js': 'text/javascript' };
  const server = http.createServer((req, res) => {
    const p = decodeURIComponent(new URL(req.url, 'http://x').pathname);
    const file = path.join(APP_DIR, p === '/' ? 'index.html' : p);
    if (!file.startsWith(APP_DIR) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) { res.writeHead(404); res.end(); return; }
    res.writeHead(200, { 'content-type': types[path.extname(file)] || 'application/octet-stream', 'cache-control': 'no-store' });
    fs.createReadStream(file).pipe(res);
  });
  return new Promise(r => server.listen(0, '127.0.0.1', () => r(server)));
}

// ---- Browser helpers ----
let cdp;
let APP_URL;
const exceptions = [];

async function evaluate(expr) {
  const r = await cdp.send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true });
  if (r.exceptionDetails) throw new Error('evaluate failed: ' + (r.exceptionDetails.exception && r.exceptionDetails.exception.description || r.exceptionDetails.text) + '\n  in: ' + expr.slice(0, 200));
  return r.result.value;
}
async function waitFor(expr, timeout) {
  const end = Date.now() + (timeout || 2000);
  let v;
  while (Date.now() < end) {
    try { v = await evaluate(expr); } catch (e) { v = undefined; }
    if (v) return { ok: true, value: v };
    await delay(25);
  }
  return { ok: false, value: v };
}
const q = s => JSON.stringify(s);
const text = sel => evaluate(`(function(){var e=document.querySelector(${q(sel)});return e?e.textContent.trim():null})()`);
const raw = () => evaluate(`localStorage.getItem(${q(KEY)})`);
const active = () => evaluate(`(function(){var a=document.activeElement;return a?(a.id||(a.dataset&&a.dataset.date)||(a.dataset&&a.dataset.id&&('item:'+a.dataset.id))||a.tagName.toLowerCase()):null})()`);
const isOpen = id => evaluate(`document.getElementById(${q(id)}).open`);
const visible = sel => evaluate(`(function(){var e=document.querySelector(${q(sel)});if(!e)return false;if(e.closest('[hidden]'))return false;var r=e.getBoundingClientRect();return r.width>1&&r.height>1&&getComputedStyle(e).visibility!=='hidden'})()`);

const KEYS = {
  Tab: [9, 'Tab', 'Tab'], Enter: [13, 'Enter', 'Enter', '\r'], Space: [32, ' ', 'Space', ' '], Escape: [27, 'Escape', 'Escape'],
  ArrowLeft: [37, 'ArrowLeft', 'ArrowLeft'], ArrowUp: [38, 'ArrowUp', 'ArrowUp'], ArrowRight: [39, 'ArrowRight', 'ArrowRight'], ArrowDown: [40, 'ArrowDown', 'ArrowDown'],
  Home: [36, 'Home', 'Home'], End: [35, 'End', 'End'], PageUp: [33, 'PageUp', 'PageUp'], PageDown: [34, 'PageDown', 'PageDown'], Backspace: [8, 'Backspace', 'Backspace']
};
async function press(name, mods) {
  const [vk, key, code, txt] = KEYS[name];
  const modifiers = (mods && mods.shift ? 8 : 0) | (mods && mods.ctrl ? 2 : 0);
  await cdp.send('Input.dispatchKeyEvent', { type: txt ? 'keyDown' : 'rawKeyDown', key, code, windowsVirtualKeyCode: vk, nativeVirtualKeyCode: vk, text: txt, unmodifiedText: txt, modifiers });
  await cdp.send('Input.dispatchKeyEvent', { type: 'keyUp', key, code, windowsVirtualKeyCode: vk, nativeVirtualKeyCode: vk, modifiers });
  await delay(30);
}
async function click(sel) {
  const rect = await evaluate(`(function(){var e=document.querySelector(${q(sel)});if(!e)return null;e.scrollIntoView({block:'center',inline:'center'});var r=e.getBoundingClientRect();return {x:r.left+r.width/2,y:r.top+r.height/2}})()`);
  if (!rect) throw new Error('click: no element ' + sel);
  await cdp.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: rect.x, y: rect.y });
  await cdp.send('Input.dispatchMouseEvent', { type: 'mousePressed', x: rect.x, y: rect.y, button: 'left', clickCount: 1 });
  await cdp.send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: rect.x, y: rect.y, button: 'left', clickCount: 1 });
  await delay(40);
}
// Types into a text field with real input events: select existing text, then insert.
async function fill(sel, value) {
  await click(sel);
  await evaluate(`document.querySelector(${q(sel)}).select()`);
  if (value === '') await press('Backspace');
  else await cdp.send('Input.insertText', { text: value });
  await delay(20);
}
// Date, time and select controls: set the value and fire input/change as the browser would.
async function setValue(sel, value) {
  await evaluate(`(function(){var e=document.querySelector(${q(sel)});e.value=${q(value)};e.dispatchEvent(new Event('input',{bubbles:true}));e.dispatchEvent(new Event('change',{bubbles:true}));})()`);
  await delay(20);
}
async function shot(name) {
  try {
    const r = await cdp.send('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync(path.join(SHOTS, name + '.png'), Buffer.from(r.data, 'base64'));
  } catch (e) { console.log('screenshot failed', name, e.message); }
}
async function viewport(w, h) {
  current.viewport = w + 'x' + h;
  await cdp.send('Emulation.setDeviceMetricsOverride', { width: w, height: h, deviceScaleFactor: 1, mobile: w <= 640 });
}
async function navigate(url) {
  const loaded = cdp.once('Page.loadEventFired', 15000);
  await cdp.send('Page.navigate', { url });
  await loaded;
  await delay(50);
}
async function reload() {
  const loaded = cdp.once('Page.loadEventFired', 15000);
  await cdp.send('Page.reload', { ignoreCache: true });
  await loaded;
  await delay(50);
}
// Fresh page with the given raw stored value (undefined = key absent).
async function fresh(seedRaw) {
  await navigate(APP_URL);
  await evaluate(`(function(){localStorage.clear();${seedRaw === undefined ? '' : `window.__origSetItem.call(localStorage, ${q(KEY)}, ${q(seedRaw)});`}})()`);
  await reload();
  await waitFor(`document.getElementById('month-heading').textContent.length>0`);
}
const stubQuota = () => evaluate(`(function(){window.__realSet=Storage.prototype.setItem;Storage.prototype.setItem=function(){throw new DOMException('Quota exceeded (T1 stub)','QuotaExceededError')};})()`);
const unstubQuota = () => evaluate(`(function(){if(window.__realSet)Storage.prototype.setItem=window.__realSet;})()`);
// Counts setItem calls while passing them through.
const spySet = () => evaluate(`(function(){if(window.__spy)return;window.__spy=0;var o=Storage.prototype.setItem;Storage.prototype.setItem=function(){window.__spy++;return o.apply(this,arguments)};})()`);
const spyCount = () => evaluate('window.__spy');
// Writes storage as a second tab would (direct localStorage write, no app code).
const otherTab = value => evaluate(`window.__origSetItem.call(localStorage, ${q(KEY)}, ${q(value)})`);
// App writes to the key since this page loaded, recorded by the spy installed before any page script (T2, F3).
const writes = () => evaluate('window.__lsWrites');
// Banner contents split into message text and button label.
const bannerState = () => evaluate(`(function(){var b=document.getElementById('storage-banner');var btn=b.querySelector('button');return {hidden:b.hidden,text:b.textContent.replace(btn?btn.textContent:'','').trim(),btn:btn?btn.textContent.trim():null}})()`);

// ---- Seed data ----
let seq = 0;
function ev(over) {
  seq += 1;
  return Object.assign({
    id: 'seed-' + seq, title: '일정' + seq, date: '2026-11-14', allDay: false, start: '09:00', end: '10:00',
    category: 'work', notes: '', createdAt: '2026-11-01T00:00:0' + (seq % 10) + '.000Z', updatedAt: '2026-11-01T00:00:00.000Z'
  }, over);
}
const stored = async () => { const r = await raw(); try { return JSON.parse(r); } catch (e) { return r; } };
const cellSel = d => `td[data-date="${d}"]`;
const chipTexts = d => evaluate(`Array.from(document.querySelectorAll('${cellSel(d)} .chip')).map(function(c){return c.textContent.trim()})`);
const overflowText = d => evaluate(`(function(){var o=document.querySelector('${cellSel(d)} .overflow');return o?o.textContent.trim():null})()`);
const listTitles = () => evaluate(`Array.from(document.querySelectorAll('#day-list .event-item .event-title')).map(function(e){return e.textContent.trim()})`);
const selectedDate = () => evaluate(`(function(){var s=document.querySelectorAll('#calendar td[aria-selected="true"]');return s.length===1?s[0].dataset.date:('count='+s.length)})()`);
const tabStops = () => evaluate(`Array.from(document.querySelectorAll('#calendar td[tabindex="0"]')).map(function(t){return t.dataset.date})`);
const noHScroll = () => evaluate(`({scrollWidth:document.documentElement.scrollWidth,clientWidth:document.documentElement.clientWidth,innerWidth:window.innerWidth})`);
const dlg = async (fn) => evaluate(`(function(){var d=document.getElementById('event-dialog');return ${fn}})()`);
async function formValues() {
  return evaluate(`({title:document.getElementById('event-title').value,date:document.getElementById('event-date').value,allDay:document.getElementById('event-allday').checked,start:document.getElementById('event-start').value,end:document.getElementById('event-end').value,category:document.getElementById('event-category').value,notes:document.getElementById('event-notes').value})`);
}
async function waitText(sel, expected, timeout) {
  const r = await waitFor(`(function(){var e=document.querySelector(${q(sel)});return e&&e.textContent.trim()===${q(expected)}&&!e.closest('[hidden]')})()`, timeout || 1500);
  return r.ok ? expected : await text(sel);
}

// ---- Contrast sweep (SCH-007 AC4), computed from rendered colors ----
const CONTRAST_FN = `(function(rootSel){
  function parse(c){var m=c.match(/rgba?\\(([^)]+)\\)/);if(!m)return {r:0,g:0,b:0,a:0};var p=m[1].split(/[\\s,\\/]+/).filter(Boolean).map(Number);return {r:p[0],g:p[1],b:p[2],a:p.length>3?p[3]:1}}
  function blend(f,b){var a=f.a;return {r:f.r*a+b.r*(1-a),g:f.g*a+b.g*(1-a),b:f.b*a+b.b*(1-a),a:1}}
  function lum(c){function f(v){v/=255;return v<=0.03928?v/12.92:Math.pow((v+0.055)/1.055,2.4)}return 0.2126*f(c.r)+0.7152*f(c.g)+0.0722*f(c.b)}
  function hex(c){return '#'+[c.r,c.g,c.b].map(function(v){return Math.round(v).toString(16).padStart(2,'0')}).join('').toUpperCase()}
  function bgOf(el){var layers=[];for(var e=el;e;e=e.parentElement){var c=parse(getComputedStyle(e).backgroundColor);if(c.a>0){layers.push(c);if(c.a>=1)break}}var base={r:255,g:255,b:255,a:1};for(var i=layers.length-1;i>=0;i--)base=blend(layers[i],base);return base}
  function vis(el){if(el.closest('[hidden]'))return false;var cs=getComputedStyle(el);if(cs.visibility==='hidden'||cs.display==='none')return false;var r=el.getBoundingClientRect();return r.width>1&&r.height>1}
  var root=document.querySelector(rootSel);var out={};
  function add(el,label){var bg=bgOf(el);var fg=blend(parse(getComputedStyle(el).color),bg);var L1=lum(fg),L2=lum(bg);var ratio=(Math.max(L1,L2)+0.05)/(Math.min(L1,L2)+0.05);var key=hex(fg)+' on '+hex(bg);var disabled=!!el.closest(':disabled');if(!out[key]||out[key].ratio>ratio)out[key]={pair:key,ratio:Math.round(ratio*100)/100,sample:label.slice(0,40),disabled:disabled}}
  var w=document.createTreeWalker(root,NodeFilter.SHOW_TEXT);var n;
  while((n=w.nextNode())){var t=n.textContent.trim();if(!t)continue;var el=n.parentElement;if(!el||el.closest('option,script,style,noscript'))continue;if(rootSel==='body'&&el.closest('dialog'))continue;if(!vis(el))continue;add(el,t)}
  root.querySelectorAll('input:not([type=checkbox]),select,textarea').forEach(function(el){if(rootSel==='body'&&el.closest('dialog'))return;if(vis(el)&&el.value)add(el,'['+el.id+' value] '+el.value)});
  return Object.values(out)})`;
// Allowed text/background pairs from design §4 (text colors only).
const TOKEN_PAIRS = new Set([
  '#FFFFFF on #1E40AF', '#FFFFFF on #7E22CE', '#FFFFFF on #047857', '#FFFFFF on #4B5563',
  '#1F2937 on #FFFFFF', '#1F2937 on #EFF6FF',
  '#4B5563 on #FFFFFF', '#4B5563 on #F9FAFB', '#4B5563 on #EFF6FF',
  '#6B7280 on #FFFFFF', '#FFFFFF on #1D4ED8', '#1D4ED8 on #FFFFFF', '#FFFFFF on #B91C1C', '#B91C1C on #FFFFFF',
  '#B91C1C on #F9FAFB', '#B91C1C on #EFF6FF', '#1D4ED8 on #F9FAFB', '#1D4ED8 on #EFF6FF',
  '#7F1D1D on #FEF2F2', '#B91C1C on #FEF2F2', '#4B5563 on #F3F4F6'
]);
const contrastLog = [];
async function contrast(label, rootSel) {
  const pairs = await evaluate(CONTRAST_FN + '(' + q(rootSel || 'body') + ')');
  const low = pairs.filter(p => !p.disabled && p.ratio < 4.5);
  check('C-' + label, 'SCH-007 AC4', 'All visible text in ' + label + ' has contrast >= 4.5:1 (rendered colors)', 'min >= 4.5', low.length ? low : 'min ' + Math.min(...pairs.map(p => p.ratio)), low.length === 0);
  const off = pairs.filter(p => !TOKEN_PAIRS.has(p.pair));
  check('C-' + label + '-tokens', 'SCH-007 AC4 / design §4, §10.6', 'Every rendered text/background pair in ' + label + ' is a §4 token pair', 'all pairs in §4', off.length ? off : 'all ' + pairs.length + ' pairs in §4', off.length === 0);
  contrastLog.push({ label, viewport: current.viewport, pairs });
  return pairs;
  // Placeholder colour from ::placeholder.
}

// ================= Scenarios =================
const scenarios = [];
function scenario(name, fn) { scenarios.push({ name, fn }); }

scenario('static-strings-and-S1', async () => {
  await viewport(1280, 800);
  // S15/S19 source checks on the served file.
  const src = fs.readFileSync(path.join(APP_DIR, 'index.html'), 'utf8');
  check('S15-src', 'SCH-005 AC2 / S15', 'index.html source does not contain the banner text', false, src.includes(S.bannerText));
  check('S19-src', 'design §8.1', 'noscript string present in source', true, src.includes('<noscript>') && src.includes(S.noscript));
  await fresh(undefined);
  const t = await evaluate(`({title:document.title,h1:document.querySelector('h1').textContent.trim(),prev:document.getElementById('prev-month').getAttribute('aria-label'),next:document.getElementById('next-month').getAttribute('aria-label'),today:document.getElementById('today').textContent.trim(),
    weekdays:Array.from(document.querySelectorAll('#calendar thead th')).map(function(e){return e.textContent.trim()}),
    searchLabel:document.querySelector('label[for=search]').textContent.trim(),placeholder:document.getElementById('search').placeholder,
    filterLabel:document.querySelector('label[for=category-filter]').textContent.trim(),filterOptions:Array.from(document.querySelectorAll('#category-filter option')).map(function(o){return o.value+':'+o.textContent.trim()}),
    newEvent:document.getElementById('new-event').textContent.trim(),clear:document.getElementById('clear-filters').textContent.trim(),
    fieldLabels:['event-title','event-date','event-allday','event-start','event-end','event-category','event-notes'].map(function(id){return document.querySelector('label[for='+id+']').textContent.trim()}),
    catOptions:Array.from(document.querySelectorAll('#event-category option')).map(function(o){return o.value+':'+o.textContent.trim()}),
    buttons:['cancel-event','save-event','delete-event'].map(function(id){return document.getElementById(id).textContent.trim()}),
    counters:[document.getElementById('title-count').textContent.trim(),document.getElementById('notes-count').textContent.trim()]})`);
  check('STR-1', 'design §8.1', 'Static Korean strings', {
    title: '일정 관리', h1: '일정 관리', prev: '이전 달', next: '다음 달', today: '오늘', weekdays: WD, searchLabel: '검색', placeholder: '제목 또는 메모 검색',
    filterLabel: '분류', filterOptions: ['all:전체', 'work:업무', 'personal:개인', 'health:건강', 'other:기타'], newEvent: '새 일정', clear: '검색 조건 지우기',
    fieldLabels: ['제목', '날짜', '종일', '시작 시간', '종료 시간', '분류', '메모'], catOptions: ['work:업무', 'personal:개인', 'health:건강', 'other:기타'],
    buttons: ['취소', '저장', '삭제'], counters: ['0/100', '0/1000']
  }, t);
  // S1
  check('S1-heading', 'SCH-001 AC1', 'Opens on current month (clock fixed to 2026-11-14)', '2026년 11월', await text('#month-heading'));
  const todayCell = await evaluate(`(function(){var c=document.querySelectorAll('td[aria-current="date"]');return c.length===1?{date:c[0].dataset.date,sel:c[0].getAttribute('aria-selected'),label:c[0].getAttribute('aria-label'),tab:c[0].getAttribute('tabindex'),numBg:getComputedStyle(c[0].querySelector('.day-num')).backgroundColor}:c.length})()`);
  check('S1-today', 'SCH-001 AC1', 'Exactly one today cell, selected, with marker and label', { date: '2026-11-14', sel: 'true', label: '2026년 11월 14일 토요일, 일정 없음, 오늘', tab: '0', numBg: 'rgb(29, 78, 216)' }, todayCell);
  check('S1-tabstop', 'SCH-007 AC2 / design §3.3', 'Exactly one cell has tabindex=0', ['2026-11-14'], await tabStops());
  check('S1-rows', 'SCH-001 / design §2.1', 'November 2026 grid has 5 rows starting 11-01', { rows: 5, first: '2026-11-01' }, await evaluate(`({rows:document.querySelectorAll('#calendar tbody tr').length,first:document.querySelector('#calendar tbody td').dataset.date})`));
  check('S1-dayheading', 'SCH-001 AC4 / design §3.4', 'Day heading for today', '11월 14일 (토) 일정', await text('#day-heading'));
  check('S1-empty', 'SCH-001 / S1', 'Empty day text visible', S.dayEmpty, await visible('#day-empty') ? await text('#day-empty') : 'hidden');
  check('S1-chips', 'S1', 'No chips on first run', 0, await evaluate(`document.querySelectorAll('#calendar .chip').length`));
  check('S1-nofocus', 'S1', 'No focus moved on load', 'body', await active());
  check('S1-nowrite', 'SCH-005 AC2', 'First run writes nothing (key still absent)', null, await raw());
  check('S1-banner-hidden', 'S15', 'Banner hidden on valid storage', true, await evaluate(`document.getElementById('storage-banner').hidden`));
  check('S1-live', 'SCH-007 AC3 / design §6.3', 'Live regions: heading wrapper polite, status role=status, alerts role=alert', { heading: 'polite', status: 'status', formAlert: 'alert', confirmAlert: 'alert', banner: 'alert' },
    await evaluate(`({heading:document.getElementById('month-heading').parentElement.getAttribute('aria-live'),status:document.getElementById('status').getAttribute('role'),formAlert:document.getElementById('form-alert').getAttribute('role'),confirmAlert:document.getElementById('confirm-alert').getAttribute('role'),banner:document.getElementById('storage-banner').getAttribute('role')})`));
  const names = await evaluate(`Array.from(document.querySelectorAll('input,select,textarea')).map(function(e){return e.id+':'+(e.labels&&e.labels.length?e.labels[0].textContent.trim():'')})`);
  check('A11Y-labels', 'SCH-007 AC3', 'Every input/select/textarea has a non-empty <label for>', [], names.filter(n => n.endsWith(':')));
  await shot('S1-desktop-empty');
});

scenario('S19-noscript', async () => {
  await viewport(1280, 800);
  await cdp.send('Emulation.setScriptExecutionDisabled', { value: true });
  try {
    await navigate(APP_URL);
    check('S19', 'design §8.1 / S19', 'With JS disabled the noscript text is visible', S.noscript, await evaluate(`document.body.innerText.indexOf(${q(S.noscript)})>=0?${q(S.noscript)}:document.body.innerText.slice(0,80)`));
  } finally {
    await cdp.send('Emulation.setScriptExecutionDisabled', { value: false });
  }
});

scenario('SCH-001-month-nav', async () => {
  await viewport(1280, 800);
  await fresh('[]');
  await click('#next-month');
  check('NAV-next', 'SCH-001 AC2', 'Next month heading, selection same day, focus stays', { h: '2026년 12월', sel: '2026-12-14', f: 'next-month' }, { h: await text('#month-heading'), sel: await selectedDate(), f: await active() });
  await click('#next-month');
  check('NAV-year', 'SCH-001 AC2', 'Year rollover', '2027년 1월', await text('#month-heading'));
  await click('#prev-month'); await click('#prev-month'); await click('#prev-month');
  check('NAV-prev', 'SCH-001 AC2', 'Previous month heading and focus', { h: '2026년 10월', sel: '2026-10-14', f: 'prev-month' }, { h: await text('#month-heading'), sel: await selectedDate(), f: await active() });
  await click(cellSel('2026-10-31'));
  await click('#next-month');
  check('NAV-clamp', 'SCH-001 AC2 / design §3.1', '10-31 + next month clamps to 11-30', { h: '2026년 11월', sel: '2026-11-30' }, { h: await text('#month-heading'), sel: await selectedDate() });
  await click('#next-month'); await click('#next-month');
  await click('#today');
  check('NAV-today', 'SCH-001 AC2', 'Today button returns to current month and selects today; focus stays', { h: '2026년 11월', sel: '2026-11-14', f: 'today' }, { h: await text('#month-heading'), sel: await selectedDate(), f: await active() });
});

scenario('SCH-001-mouse-and-keyboard-selection', async () => {
  await viewport(1280, 800);
  seq = 0;
  const evs = [ev({ date: '2026-11-20', title: '스무날' }), ev({ date: '2026-12-01', title: '다음달' }), ev({ date: '2026-11-15', title: '보름' })];
  await fresh(JSON.stringify(evs));
  await click(cellSel('2026-11-20'));
  check('SEL-mouse', 'SCH-001 AC4', 'Mouse click selects day and lists its events', { sel: '2026-11-20', h: '11월 20일 (금) 일정', list: ['스무날'], f: '2026-11-20' }, { sel: await selectedDate(), h: await text('#day-heading'), list: await listTitles(), f: await active() });
  await click(cellSel('2026-12-01'));
  check('SEL-mouse-outside', 'SCH-001 AC4 / design §3.3', 'Clicking an outside cell switches month and selects it', { m: '2026년 12월', sel: '2026-12-01', list: ['다음달'] }, { m: await text('#month-heading'), sel: await selectedDate(), list: await listTitles() });
  await click('#today');
  // Move focus into the grid via Tab from the today button (grid is one Tab stop).
  await click(cellSel('2026-11-14'));
  const steps = [
    ['ArrowRight', '2026-11-15', '11월 15일 (일) 일정'], ['ArrowLeft', '2026-11-14', '11월 14일 (토) 일정'],
    ['ArrowDown', '2026-11-21', '11월 21일 (토) 일정'], ['ArrowUp', '2026-11-14', '11월 14일 (토) 일정'],
    ['Home', '2026-11-08', '11월 8일 (일) 일정'], ['End', '2026-11-14', '11월 14일 (토) 일정'],
    ['PageDown', '2026-12-14', '12월 14일 (월) 일정'], ['PageUp', '2026-11-14', '11월 14일 (토) 일정']
  ];
  for (const [k, d, h] of steps) {
    await press(k);
    check('SEL-key-' + k, 'SCH-001 AC4 / design §6.2', k + ' moves focus and selection', { sel: d, focus: d, h, stops: [d] }, { sel: await selectedDate(), focus: await active(), h: await text('#day-heading'), stops: await tabStops() });
  }
  await press('ArrowRight');
  check('SEL-key-list', 'SCH-001 AC4', 'Keyboard selection lists that day\'s events', ['보름'], await listTitles());
  // 11-30 -> ArrowRight crosses into December (design §10.3).
  await click(cellSel('2026-11-30'));
  await press('ArrowRight');
  check('SEL-cross', 'design §10.3', 'ArrowRight from 11-30 lands on 12-01 with focus kept in grid', { m: '2026년 12월', sel: '2026-12-01', focus: '2026-12-01' }, { m: await text('#month-heading'), sel: await selectedDate(), focus: await active() });
  // PageDown clamping: 12-31 -> 2027-01-31 -> 2027-02-28.
  await click(cellSel('2026-12-31'));
  await press('PageDown');
  await press('PageDown');
  check('SEL-pgdn-clamp', 'design §6.2', 'PageDown from 2027-01-31 clamps to 2027-02-28', { m: '2027년 2월', sel: '2027-02-28', focus: '2027-02-28' }, { m: await text('#month-heading'), sel: await selectedDate(), focus: await active() });
  // Enter / Space re-select the focused date; Space must not scroll the page.
  await click('#today');
  // 375x400 so the page is vertically scrollable and a missing preventDefault on Space would be visible.
  await viewport(375, 400);
  await delay(100);
  await click(cellSel('2026-11-20'));
  const y0 = await evaluate('window.scrollY');
  await press('Enter');
  check('SEL-enter', 'SCH-001 AC4 / design §6.2', 'Enter keeps the focused date selected and listed', { sel: '2026-11-20', focus: '2026-11-20', list: ['스무날'] }, { sel: await selectedDate(), focus: await active(), list: await listTitles() });
  await press('Space');
  const y1 = await evaluate('window.scrollY');
  check('SEL-space', 'SCH-001 AC4 / design §6.2', 'Space selects the focused date without scrolling the page', { sel: '2026-11-20', focus: '2026-11-20', scrolled: false, pageScrollable: true }, { sel: await selectedDate(), focus: await active(), scrolled: y1 !== y0, pageScrollable: await evaluate('document.documentElement.scrollHeight > window.innerHeight + 50') });
  await viewport(1280, 800);
});

scenario('SCH-001-AC3-cells-and-order', async () => {
  for (const [w, h] of [[1280, 800], [375, 800]]) {
    await viewport(w, h);
    seq = 0;
    const evs = [
      ev({ title: '나중', start: '15:00', end: '16:00', category: 'other' }),
      ev({ title: '종일B', allDay: true, start: null, end: null, category: 'health' }),
      ev({ title: '아침', start: '08:00', end: '09:00', category: 'personal' }),
      ev({ title: '종일A', allDay: true, start: null, end: null, category: 'work' }),
      ev({ title: '가나', start: '08:00', end: '08:30', category: 'work', notes: '첫 메모 '.repeat(20) }),
      ev({ title: '바깥', date: '2026-12-01', allDay: true, start: null, end: null }),
      ev({ title: '토요일외', date: '2026-11-07', category: 'health' })
    ];
    await fresh(JSON.stringify(evs));
    check('AC3-chips-' + w, 'SCH-001 AC3 / S2', 'Cell shows first 3 events in PRD order', ['종일A', '종일B', '08:00 가나'], await chipTexts('2026-11-14'));
    check('AC3-overflow-' + w, 'SCH-001 AC3 / S2', 'Overflow line +2', '+2', await overflowText('2026-11-14'));
    check('AC3-overflow-vis-' + w, 'SCH-001 AC3', '+N is visible', true, await visible(cellSel('2026-11-14') + ' .overflow'));
    check('AC3-list-' + w, 'S2 / PRD ordering', 'Day list has all 5 in order', ['종일A', '종일B', '가나', '아침', '나중'], await listTitles());
    check('AC3-label-' + w, 'design §3.3', 'Cell aria-label counts events', '2026년 11월 14일 토요일, 일정 5개, 오늘', await evaluate(`document.querySelector('${cellSel('2026-11-14')}').getAttribute('aria-label')`));
    check('AC3-outside-' + w, 'design §3.3', 'Outside cell 12-01 shows its own chip and is marked outside', { outside: 'true', chips: ['바깥'] }, { outside: await evaluate(`document.querySelector('${cellSel('2026-12-01')}').getAttribute('data-outside')`), chips: await chipTexts('2026-12-01') });
    const items = await evaluate(`Array.from(document.querySelectorAll('#day-list .event-item')).map(function(b){return b.innerText.replace(/\\s+/g,' ').trim()})`);
    check('AC3-items-' + w, 'design §3.4', 'List item shows time line, category badge and title', [true, true, true], [items[0].startsWith('종일') && items[0].includes('업무') && items[0].includes('종일A'), items[2].startsWith('08:00~08:30') && items[2].includes('업무'), items[4].includes('15:00~16:00') && items[4].includes('기타')]);
    const notes = await evaluate(`(function(){var n=document.querySelector('#day-list .event-notes');return n?n.textContent:null})()`);
    check('AC3-notes-preview-' + w, 'design §3.4', 'Notes preview is the first 80 chars followed by …', Array.from('첫 메모 '.repeat(20)).slice(0, 80).join('') + '…', notes);
    if (w === 375) {
      const chip = await evaluate(`(function(){var c=document.querySelector('${cellSel('2026-11-14')} .chip');var t=c.querySelector('.chip-text')||c;var r=t.getBoundingClientRect();return {barH:Math.round(c.getBoundingClientRect().height),textInDom:c.textContent.trim().length>0,textW:r.width}})()`);
      check('AC3-mobile-bars', 'design §2.2, open issue 4', 'Mobile chips are 6px bars with titles in DOM but visually hidden', { barH: 6, textInDom: true, hidden: true }, { barH: chip.barH, textInDom: chip.textInDom, hidden: chip.textW <= 1 });
    }
    await shot('S2-populated-' + w);
    await contrast('populated-' + w);
    // Selected-cell contrast: select an outside/other day too.
    await click(cellSel('2026-11-07'));
    await contrast('selected-sat-' + w);
    // T2: measure the three §4 pairs T1 never rendered.
    const seen = new Map();
    await click(cellSel('2026-11-18')); // Wednesday: --text on the selected background
    for (const p of await contrast('selected-weekday-' + w)) seen.set(p.pair, p.ratio);
    await click(cellSel('2026-11-15')); // Sunday: red number on the selected background
    for (const p of await contrast('selected-sun-' + w)) seen.set(p.pair, p.ratio);
    await click('#next-month'); // December 2026 grid starts with outside Sunday 2026-11-29
    check('C-outside-sun-cell-' + w, 'harness', 'December grid has outside Sunday 11-29 in column 1', { date: '2026-11-29', outside: 'true' },
      await evaluate(`(function(){var t=document.querySelector('#calendar tbody td');return {date:t.dataset.date,outside:t.getAttribute('data-outside')}})()`));
    for (const p of await contrast('outside-sun-' + w)) seen.set(p.pair, p.ratio);
    const want = ['#1F2937 on #EFF6FF', '#B91C1C on #EFF6FF', '#B91C1C on #F9FAFB'];
    check('C-extra-pairs-' + w, 'SCH-007 AC4 / design §4.1', 'The three previously unmeasured §4 pairs are rendered and each >= 4.5:1',
      want.map(k => k + ' >= 4.5'), want.map(k => seen.has(k) ? (seen.get(k) >= 4.5 ? k + ' >= 4.5' : k + ' = ' + seen.get(k)) : k + ' not rendered'));
  }
  await viewport(1280, 800);
});

scenario('SCH-002-create', async () => {
  await viewport(1280, 800);
  await fresh(undefined);
  await click(cellSel('2026-11-20'));
  await click('#new-event');
  check('S4-defaults', 'SCH-002 AC3 / S4', 'Add dialog defaults: date = selected day', {
    open: true, title: '새 일정', del: true, focus: 'event-title',
    form: { title: '', date: '2026-11-20', allDay: false, start: '09:00', end: '10:00', category: 'work', notes: '' }
  }, { open: await isOpen('event-dialog'), title: await text('#event-dialog-title'), del: await evaluate(`document.getElementById('delete-event').hidden`), focus: await active(), form: await formValues() });
  await shot('S4-add-dialog-1280');
  await fill('#event-title', '프로젝트 회의');
  check('S4-counter', 'design §3.5', 'Title counter updates on input', '7/100', await text('#title-count'));
  await setValue('#event-start', '13:00');
  await setValue('#event-end', '14:30');
  await setValue('#event-category', 'personal');
  await fill('#event-notes', '자료 준비');
  await click('#save-event');
  const st = await waitText('#status', S.added);
  check('S7-add', 'SCH-002 AC1, AC2 / S7', 'Dialog closes, chip and list item appear, status, focus to #new-event', {
    open: false, chip: ['13:00 프로젝트 회의'], list: ['프로젝트 회의'], status: S.added, focus: 'new-event'
  }, { open: await isOpen('event-dialog'), chip: await chipTexts('2026-11-20'), list: await listTitles(), status: st, focus: await active() });
  const s1 = await stored();
  const r0 = s1[0] || {};
  check('S7-record', 'SCH-002 AC1 / storage contract', 'Stored record matches the form', { n: 1, title: '프로젝트 회의', date: '2026-11-20', allDay: false, start: '13:00', end: '14:30', category: 'personal', notes: '자료 준비', id: true, ts: true },
    { n: s1.length, title: r0.title, date: r0.date, allDay: r0.allDay, start: r0.start, end: r0.end, category: r0.category, notes: r0.notes, id: typeof r0.id === 'string' && r0.id.length > 0, ts: !isNaN(Date.parse(r0.createdAt)) && !isNaN(Date.parse(r0.updatedAt)) });
  // All-day event in another month, chosen in the form: visible month follows (S7).
  await click('#new-event');
  await fill('#event-title', '연말 휴가');
  await setValue('#event-date', '2026-12-24');
  await click('#event-allday');
  check('S4-allday-hides', 'design §3.5', 'Checking 종일 hides the time fields', true, await evaluate(`document.getElementById('event-start').closest('[hidden]')!==null`));
  await click('#save-event');
  await waitText('#status', S.added);
  check('S7-month-follow', 'S7', 'Visible month switches to the event date, which is selected', { m: '2026년 12월', sel: '2026-12-24', chip: ['연말 휴가'], list: ['연말 휴가'] }, { m: await text('#month-heading'), sel: await selectedDate(), chip: await chipTexts('2026-12-24'), list: await listTitles() });
  const s2 = await stored();
  const hol = s2.find(e => e.title === '연말 휴가') || {};
  check('S7-allday-record', 'SCH-002 AC1', 'All-day record stores null times', { allDay: true, start: null, end: null }, { allDay: hol.allDay, start: hol.start, end: hol.end });
  check('S7-listtime', 'design §3.4', 'All-day list item shows 종일', true, (await evaluate(`document.querySelector('#day-list .event-time').textContent.trim()`)) === '종일');
  // Keyboard-selected day becomes the add-form default.
  await click('#today');
  await click(cellSel('2026-11-14'));
  await press('ArrowRight'); await press('ArrowDown');
  await click('#new-event');
  check('S4-default-keyboard', 'SCH-002 AC3', 'Add form date follows a keyboard-selected day', '2026-11-22', (await formValues()).date);
  await press('Escape');
  check('S4-escape', 'SCH-007 AC2 / S4', 'Escape closes add dialog with no change and returns focus', { open: false, focus: 'new-event', n: 2 }, { open: await isOpen('event-dialog'), focus: await active(), n: (await stored()).length });
  // SCH-005 AC1: reload keeps events.
  await reload();
  await waitFor(`document.getElementById('month-heading').textContent.length>0`);
  await click(cellSel('2026-11-20'));
  check('SCH005-reload', 'SCH-005 AC1', 'Events survive a reload', { chip: ['13:00 프로젝트 회의'], list: ['프로젝트 회의'] }, { chip: await chipTexts('2026-11-20'), list: await listTitles() });
});

scenario('year-0026', async () => {
  await viewport(1280, 800);
  await fresh('[]');
  await click('#new-event');
  await fill('#event-title', 'Y26');
  await setValue('#event-date', '0026-11-14');
  await click('#save-event');
  await waitText('#status', S.added);
  const wd = WD[weekday(26, 11, 14)];
  const first = await evaluate(`document.querySelector('#calendar tbody td').dataset.date`);
  const [fy, fm, fd] = first.split('-').map(Number);
  check('Y0026', 'SCH-004 / code review F1', 'Year 0026 event: heading, weekday and grid use the real year 26', {
    m: '26년 11월', sel: '0026-11-14', h: '11월 14일 (' + wd + ') 일정', label: '26년 11월 14일 ' + wd + '요일, 일정 1개', firstIsSunday: true, stored: '0026-11-14'
  }, {
    m: await text('#month-heading'), sel: await selectedDate(), h: await text('#day-heading'),
    label: await evaluate(`document.querySelector('${cellSel('0026-11-14')}').getAttribute('aria-label')`),
    firstIsSunday: weekday(fy, fm, fd) === 0, stored: ((await stored())[0] || {}).date
  });
  await shot('Y0026-1280');
});

scenario('SCH-003-edit-delete', async () => {
  await viewport(1280, 800);
  seq = 0;
  const A = ev({ id: 'evt-A', title: '치과 예약', start: '11:00', end: '11:30', category: 'health', notes: '보험증 지참', extraField: { keep: true } });
  const B = ev({ id: 'evt-B', title: '가족 행사', allDay: true, start: null, end: null, category: 'personal' });
  await fresh(JSON.stringify([A, B]));
  await click('#day-list .event-item[data-id="evt-A"]');
  check('S5-open', 'SCH-003 AC1 / S5', 'Edit dialog shows saved values', {
    title: '일정 수정', del: true, focus: 'event-title', form: { title: '치과 예약', date: '2026-11-14', allDay: false, start: '11:00', end: '11:30', category: 'health', notes: '보험증 지참' }
  }, { title: await text('#event-dialog-title'), del: await visible('#delete-event'), focus: await active(), form: await formValues() });
  await fill('#event-title', '치과 정기검진');
  await setValue('#event-date', '2026-11-16');
  await click('#save-event');
  const st = await waitText('#status', S.updated);
  const s = await stored();
  const a2 = s.find(e => e.id === 'evt-A') || {};
  check('S7-edit', 'SCH-003 AC1 / S7', 'Saving updates calendar, list, storage; same id; focus on the item', {
    status: S.updated, open: false, sel: '2026-11-16', list: ['치과 정기검진'], chip14: ['가족 행사'], chip16: ['11:00 치과 정기검진'], focus: 'item:evt-A',
    rec: { title: '치과 정기검진', date: '2026-11-16', createdAt: A.createdAt, extraField: { keep: true } }, n: 2
  }, {
    status: st, open: await isOpen('event-dialog'), sel: await selectedDate(), list: await listTitles(), chip14: await chipTexts('2026-11-14'), chip16: await chipTexts('2026-11-16'), focus: await active(),
    rec: { title: a2.title, date: a2.date, createdAt: a2.createdAt, extraField: a2.extraField }, n: s.length
  });
  check('S7-edit-updatedAt', 'storage contract', 'updatedAt changes on edit', true, a2.updatedAt !== A.updatedAt && !isNaN(Date.parse(a2.updatedAt)));
  // All-day event opens with times 09:00/10:00 and hidden time fields.
  await click(cellSel('2026-11-14'));
  await click('#day-list .event-item[data-id="evt-B"]');
  check('S5-allday', 'design §3.5', 'Saved all-day event opens checked with 09:00/10:00 kept hidden', { allDay: true, start: '09:00', end: '10:00', hidden: true },
    Object.assign((({ allDay, start, end }) => ({ allDay, start, end }))(await formValues()), { hidden: await evaluate(`document.getElementById('event-start').closest('[hidden]')!==null`) }));
  // Delete -> cancel keeps event (S9).
  const before = await raw();
  await click('#delete-event');
  check('S9-open', 'SCH-003 AC2 / S9', 'Confirm dialog strings and focus on 취소', { open: true, t: S.delTitle, m: S.delMsg('가족 행사'), c: '취소', a: '삭제', focus: 'confirm-cancel', role: 'alertdialog' },
    { open: await isOpen('confirm-dialog'), t: await text('#confirm-title'), m: await text('#confirm-message'), c: await text('#confirm-cancel'), a: await text('#confirm-action'), focus: await active(), role: await evaluate(`document.getElementById('confirm-dialog').getAttribute('role')`) });
  await shot('S9-confirm-1280');
  await contrast('confirm-dialog-1280', '#confirm-dialog');
  await click('#confirm-cancel');
  check('S9-cancel', 'SCH-003 AC2 / S9', '취소 keeps the event, event dialog stays open, focus returns to 삭제', { confirm: false, edit: true, focus: 'delete-event', same: true, list: ['가족 행사'] },
    { confirm: await isOpen('confirm-dialog'), edit: await isOpen('event-dialog'), focus: await active(), same: (await raw()) === before, list: await listTitles() });
  await click('#delete-event');
  await press('Escape');
  check('S9-escape', 'SCH-007 AC2 / S9', 'Escape closes only the confirm dialog', { confirm: false, edit: true, focus: 'delete-event', same: true }, { confirm: await isOpen('confirm-dialog'), edit: await isOpen('event-dialog'), focus: await active(), same: (await raw()) === before });
  await click('#delete-event');
  await click('#confirm-action');
  const st2 = await waitText('#status', S.deleted);
  check('S10', 'SCH-003 AC2 / S10', 'Confirmed delete removes event; focus to #day-heading', { confirm: false, edit: false, status: S.deleted, focus: 'day-heading', ids: ['evt-A'], list: [] },
    { confirm: await isOpen('confirm-dialog'), edit: await isOpen('event-dialog'), status: st2, focus: await active(), ids: (await stored()).map(e => e.id), list: await listTitles() });
});

scenario('SCH-004-validation', async () => {
  await viewport(1280, 800);
  seq = 0;
  const seed = JSON.stringify([ev({ id: 'keep', title: '기존' })], null, 0);
  await fresh(seed);
  await spySet();
  await click('#new-event');
  // Whitespace-only title.
  await fill('#event-title', '   ');
  await click('#save-event');
  const err = await evaluate(`(function(){var i=document.getElementById('event-title');var ids=(i.getAttribute('aria-describedby')||'').split(/\\s+/);var e=document.getElementById('event-title-error');return {inv:i.getAttribute('aria-invalid'),err:e?e.textContent.trim():null,cls:e?e.className:null,linked:ids.indexOf('event-title-error')>=0,resolved:ids.map(function(x){var n=document.getElementById(x);return n?n.textContent.trim():''}).join(' | ')}})()`);
  check('S6-whitespace', 'SCH-004 AC1 / S6', 'Whitespace title blocked with linked error and alert; focus on title', {
    inv: 'true', err: S.titleEmpty, cls: 'field-error', linked: true, alert: S.formAlert, focus: 'event-title', open: true, raw: seed, writes: 0
  }, { inv: err.inv, err: err.err, cls: err.cls, linked: err.linked, alert: await waitText('#form-alert', S.formAlert), focus: await active(), open: await isOpen('event-dialog'), raw: await raw(), writes: await spyCount() });
  check('S6-describedby', 'SCH-007 AC3 / design §6.5', 'aria-describedby resolves to error text and counter', true, err.resolved.includes(S.titleEmpty) && err.resolved.includes('/100'));
  await shot('S6-validation-1280');
  await contrast('event-dialog-errors-1280', '#event-dialog');
  // Error clears on input.
  await fill('#event-title', '유효');
  check('S6-clear', 'design S6 recovery', 'Typing a valid title clears the error and the form alert', { inv: 'false', err: null, alertHidden: true },
    await evaluate(`({inv:document.getElementById('event-title').getAttribute('aria-invalid'),err:(document.getElementById('event-title-error')&&!document.getElementById('event-title-error').hidden)?document.getElementById('event-title-error').textContent:null,alertHidden:document.getElementById('form-alert').hidden||document.getElementById('form-alert').textContent.trim()===''})`));
  // Title 101 ASCII / 101 emoji blocked; counters.
  for (const [label, t101] of [['ascii', 'a'.repeat(101)], ['emoji', '😀'.repeat(101)]]) {
    await fill('#event-title', t101);
    const cnt = await text('#title-count');
    const color = await evaluate(`getComputedStyle(document.getElementById('title-count')).color`);
    await click('#save-event');
    check('S6-title101-' + label, 'SCH-004 AC2', 'Title of 101 code points (' + label + ') blocked; counter 101/100 in red', { err: S.titleLong, cnt: '101/100', color: 'rgb(185, 28, 28)', raw: seed, writes: 0, open: true },
      { err: await waitText('#event-title-error', S.titleLong), cnt, color, raw: await raw(), writes: await spyCount(), open: await isOpen('event-dialog') });
  }
  // End equal to start (other fields valid).
  await fill('#event-title', 'x');
  await setValue('#event-start', '10:00'); await setValue('#event-end', '10:00');
  await click('#save-event');
  check('S6-end-eq-start', 'SCH-004 AC1', 'End equal to start blocked with error next to end field', { err: S.endOrder, focus: 'event-end', raw: seed, writes: 0 }, { err: await waitText('#event-end-error', S.endOrder), focus: await active(), raw: await raw(), writes: await spyCount() });
  await setValue('#event-end', '09:00');
  await click('#save-event');
  check('S6-end-before', 'SCH-004 AC1', 'End before start blocked', S.endOrder, await waitText('#event-end-error', S.endOrder));
  await setValue('#event-start', ''); await setValue('#event-end', '10:00');
  await click('#save-event');
  check('S6-start-empty', 'SCH-004 AC1', 'Missing start time blocked', { err: S.startEmpty, focus: 'event-start' }, { err: await waitText('#event-start-error', S.startEmpty), focus: await active() });
  await setValue('#event-start', '09:00'); await setValue('#event-end', '');
  await click('#save-event');
  check('S6-end-empty', 'SCH-004 AC1', 'Missing end time blocked', S.endEmpty, await waitText('#event-end-error', S.endEmpty));
  await setValue('#event-end', '10:00');
  // Missing date.
  await setValue('#event-date', '');
  await click('#save-event');
  check('S6-date-missing', 'SCH-004 AC1', 'Missing date blocked with error; focus on date', { err: S.dateBad, focus: 'event-date', raw: seed, writes: 0 }, { err: await waitText('#event-date-error', S.dateBad), focus: await active(), raw: await raw(), writes: await spyCount() });
  await setValue('#event-date', '2026-11-14');
  // Notes 1001 ascii/emoji blocked.
  for (const [label, n1001] of [['ascii', 'n'.repeat(1001)], ['emoji', '🎉'.repeat(1001)]]) {
    await fill('#event-notes', n1001);
    const cnt = await text('#notes-count');
    await click('#save-event');
    check('S6-notes1001-' + label, 'SCH-004 AC2', 'Notes of 1001 code points (' + label + ') blocked', { err: S.notesLong, cnt: '1001/1000', raw: seed, writes: 0 }, { err: await waitText('#event-notes-error', S.notesLong), cnt, raw: await raw(), writes: await spyCount() });
  }
  // Multiple errors: focus goes to the first invalid field in form order.
  await fill('#event-title', ' ');
  await setValue('#event-end', '08:00');
  await click('#save-event');
  check('S6-first-invalid', 'design S6', 'With several errors, focus goes to the first invalid field (title)', { focus: 'event-title', errs: [S.titleEmpty, S.endOrder, S.notesLong] },
    { focus: await active(), errs: await evaluate(`['event-title-error','event-end-error','event-notes-error'].map(function(i){var e=document.getElementById(i);return e?e.textContent.trim():null})`) });
  // Boundary values save: 100 emoji title and 1000 emoji notes.
  await fill('#event-title', '😀'.repeat(100));
  await setValue('#event-end', '10:00');
  await fill('#event-notes', '🎉'.repeat(1000));
  check('S6-counters-at-limit', 'design §3.5', 'Counters show code-point counts at the limit', ['100/100', '1000/1000'], [await text('#title-count'), await text('#notes-count')]);
  await click('#save-event');
  const st = await waitText('#status', S.added);
  const rec = (await stored()).find(e => e.id !== 'keep') || {};
  check('S6-boundary-save', 'SCH-004 AC2', '100-code-point title and 1000-code-point notes save', { status: S.added, t: 100, n: 1000, writes: 1 }, { status: st, t: Array.from(rec.title || '').length, n: Array.from(rec.notes || '').length, writes: await spyCount() });
  // 100 ASCII with surrounding spaces is trimmed and saves.
  await click('#new-event');
  await fill('#event-title', '  ' + 'z'.repeat(100) + '  ');
  await click('#save-event');
  await waitText('#status', S.added);
  check('S6-trim-save', 'design §3.5', 'Title trimmed before counting and saving', true, (await stored()).some(e => e.title === 'z'.repeat(100)));
});

scenario('SCH-005-unreadable-S15-S16-S17', async () => {
  for (const [w, h] of [[1280, 800], [375, 800]]) {
    await viewport(w, h);
    const bad = '{not json';
    await fresh(bad);
    const ban = await waitText('#storage-banner', S.bannerText + S.bannerBtn) ;
    const b = await evaluate(`(function(){var b=document.getElementById('storage-banner');var btn=b.querySelector('button');return {hidden:b.hidden,text:b.textContent.replace(btn?btn.textContent:'','').trim(),btn:btn?btn.textContent.trim():null}})()`);
    check('S15-banner-' + w, 'SCH-005 AC2 / S15', 'Banner text and reset button shown', { hidden: false, text: S.bannerText, btn: S.bannerBtn }, b);
    check('S15-state-' + w, 'S15', '새 일정 disabled, no chips, empty day text, raw unchanged', { disabled: true, chips: 0, empty: S.dayEmpty, raw: bad },
      { disabled: await evaluate(`document.getElementById('new-event').disabled`), chips: await evaluate(`document.querySelectorAll('#calendar .chip').length`), empty: await text('#day-empty'), raw: await raw() });
    await shot('S15-banner-' + w);
    await contrast('banner-' + w);
    const nh = await noHScroll();
    check('S15-hscroll-' + w, 'SCH-007 AC1', 'No horizontal scroll with banner', true, nh.scrollWidth <= nh.clientWidth);
    await click('#next-month'); await click('#prev-month');
    await fill('#search', 'abc');
    await setValue('#category-filter', 'work');
    check('S15-nav-' + w, 'S15', 'Month nav, search and filter still work; raw unchanged', { m: '2026년 11월', raw: bad, summary: S.summaryNone }, { m: await text('#month-heading'), raw: await raw(), summary: await text('#filter-summary') });
    check('W-S15-load-nav-' + w, 'SCH-005 AC2 / S15 (F3)', 'No setItem call to the key during load, month navigation, search and filter', [], await writes());
    await click('#clear-filters');
    // S16 reset confirm, cancel.
    await click('#storage-banner button');
    check('S16-open-' + w, 'S16', 'Reset confirm strings and focus on 취소', { open: true, t: S.resetTitle, m: S.resetMsg, c: '취소', a: '초기화', focus: 'confirm-cancel' },
      { open: await isOpen('confirm-dialog'), t: await text('#confirm-title'), m: await text('#confirm-message'), c: await text('#confirm-cancel'), a: await text('#confirm-action'), focus: await active() });
    await click('#confirm-cancel');
    const focusAfter = await evaluate(`document.activeElement&&document.activeElement.closest('#storage-banner')?'banner-button':(document.activeElement&&document.activeElement.id)`);
    check('S16-cancel-' + w, 'S16 / SCH-005 AC2', 'Cancel keeps raw byte-identical and returns focus to 데이터 초기화', { open: false, focus: 'banner-button', raw: bad }, { open: await isOpen('confirm-dialog'), focus: focusAfter, raw: await raw() });
    await click('#storage-banner button');
    await press('Escape');
    check('S16-escape-' + w, 'S16', 'Escape closes reset confirm; raw unchanged', { open: false, raw: bad }, { open: await isOpen('confirm-dialog'), raw: await raw() });
    check('W-S16-cancel-' + w, 'SCH-005 AC2 / S16 (F3)', 'No setItem call after reset cancel and Escape', [], await writes());
    await reload();
    await waitFor(`!document.getElementById('storage-banner').hidden`);
    check('S15-reload-' + w, 'SCH-005 AC2', 'Reload keeps raw byte-identical', bad, await raw());
    // S17.
    await waitFor(`!!document.querySelector('#storage-banner button')`);
    check('W-S15-reload-' + w, 'SCH-005 AC2 (F3)', 'No setItem call after reload with unreadable data', [], await writes());
    await click('#storage-banner button');
    await click('#confirm-action');
    const st = await waitText('#status', S.resetDone);
    check('W-S17-' + w, 'S17 (F3)', 'A confirmed reset makes exactly one write of []', ['[]'], await writes());
    check('S17-' + w, 'S17', 'Reset writes [], removes banner, enables 새 일정, focus to #new-event', { raw: '[]', banner: false, disabled: false, focus: 'new-event', status: S.resetDone, confirm: false },
      { raw: await raw(), banner: await visible('#storage-banner'), disabled: await evaluate(`document.getElementById('new-event').disabled`), focus: await active(), status: st, confirm: await isOpen('confirm-dialog') });
  }
  await viewport(1280, 800);
  // Other unreadable shapes; raw byte-identical (including odd formatting).
  seq = 0;
  const shapes = {
    'non-array': '{"a":1}',
    'unknown-category': JSON.stringify([ev({ category: 'travel' })]),
    'duplicate-ids': JSON.stringify([ev({ id: 'dup' }), ev({ id: 'dup' })]),
    'bad-record-pretty': '[\n  {"id": 1, "title": "x"}\n]\r\n  ',
    'untrimmed-title': JSON.stringify([ev({ title: ' 공백' })])
  };
  for (const [name, val] of Object.entries(shapes)) {
    await fresh(val);
    await waitText('#storage-banner', S.bannerText + S.bannerBtn);
    await click('#next-month');
    await click('#prev-month');
    await fill('#search', 'x');
    await setValue('#category-filter', 'health');
    await click('#clear-filters');
    check('S15-' + name, 'SCH-005 AC2 / brief decision 3', name + ' shows the exact banner and leaves raw byte-identical with no writes', { banner: { hidden: false, text: S.bannerText, btn: S.bannerBtn }, raw: val, disabled: true, writes: [] },
      { banner: await bannerState(), raw: await raw(), disabled: await evaluate(`document.getElementById('new-event').disabled`), writes: await writes() });
  }
  // Valid record with an unknown extra field loads fine.
  const extra = JSON.stringify([ev({ title: '확장', extraX: 1 })]);
  await fresh(extra);
  await delay(200);
  check('S15-extra-ok', 'storage contract', 'Unknown extra fields are allowed (no banner)', { banner: false, chips: ['09:00 확장'], raw: extra }, { banner: await visible('#storage-banner'), chips: await chipTexts('2026-11-14'), raw: await raw() });
});

scenario('SCH-005-blocked-storage', async () => {
  await viewport(1280, 800);
  seq = 0;
  const seed = JSON.stringify([ev({ title: '보존' })]);
  await fresh(seed);
  const { identifier } = await cdp.send('Page.addScriptToEvaluateOnNewDocument', { source: `Object.defineProperty(window,'localStorage',{configurable:true,get:function(){throw new DOMException('Access is denied for this document (T1 stub)','SecurityError')}});` });
  try {
    await reload();
    const blocked = await evaluate(`(function(){try{window.localStorage;return false}catch(e){return e.name}})()`);
    check('BLK-stub', 'harness', 'window.localStorage getter throws SecurityError', 'SecurityError', blocked);
    const shown = await waitText('#storage-banner', S.bannerText + S.bannerBtn);
    check('S15-blocked', 'SCH-005 / design open issue 2', 'Blocked storage shows S15 banner and disables 새 일정', { banner: S.bannerText + S.bannerBtn, disabled: true, chips: 0 },
      { banner: shown, disabled: await evaluate(`document.getElementById('new-event').disabled`), chips: await evaluate(`document.querySelectorAll('#calendar .chip').length`) });
    await shot('S15-blocked-1280');
    check('W-blocked-load', 'SCH-005 (F3)', 'No setItem call to the key while storage is blocked', [], await writes());
    await click('#storage-banner button');
    await click('#confirm-cancel');
    await click('#storage-banner button');
    await press('Escape');
    check('W-blocked-cancel', 'SCH-005 (F3)', 'No setItem call after reset cancel and Escape while blocked', [], await writes());
    await click('#storage-banner button');
    await click('#confirm-action');
    const alert = await waitText('#confirm-alert', S.resetFail);
    check('W-blocked-reset', 'S18 (F3)', 'Blocked reset reaches no Storage object, so no write is recorded', [], await writes());
    check('S18-blocked', 'design open issue 2 / S18', 'Reset with blocked storage ends in S18: confirm stays, alert, banner stays, focus on 초기화', { open: true, alert: S.resetFail, banner: true, focus: 'confirm-action' },
      { open: await isOpen('confirm-dialog'), alert, banner: await visible('#storage-banner'), focus: await active() });
    await shot('S18-blocked-1280');
  } finally {
    await cdp.send('Page.removeScriptToEvaluateOnNewDocument', { identifier });
  }
  await reload();
  check('BLK-raw', 'SCH-005 AC2', 'After unblocking, the stored raw value is byte-identical', seed, await raw());
  check('W-blocked-after', 'SCH-005 AC2 (F3)', 'No setItem call after unblocking and reloading valid data', [], await writes());
});

scenario('SCH-005-S18-quota-reset', async () => {
  await viewport(1280, 800);
  const bad = '{x';
  await fresh(bad);
  await waitFor(`!!document.querySelector('#storage-banner button')`);
  await click('#storage-banner button');
  await stubQuota();
  await click('#confirm-action');
  const alert = await waitText('#confirm-alert', S.resetFail);
  check('S18-quota', 'S18', 'setItem throws on reset: confirm stays open with alert; banner stays; raw unchanged; focus on 초기화', { open: true, alert: S.resetFail, banner: true, raw: bad, focus: 'confirm-action' },
    { open: await isOpen('confirm-dialog'), alert, banner: await visible('#storage-banner'), raw: (await unstubQuota(), await raw()), focus: await active() });
  await shot('S18-quota-1280');
  await contrast('confirm-alert-1280', '#confirm-dialog');
  await click('#confirm-action');
  check('S18-retry', 'S18 recovery', 'Retry after restoring setItem succeeds (S17)', { raw: '[]', status: S.resetDone }, { raw: await raw(), status: await waitText('#status', S.resetDone) });
});

scenario('SCH-005-S8-S11-write-failures', async () => {
  await viewport(1280, 800);
  seq = 0;
  const A = ev({ id: 'evt-A', title: '원래 제목' });
  const seed = JSON.stringify([A]);
  await fresh(seed);
  // S8 on add.
  await click('#new-event');
  await fill('#event-title', 'S8 추가');
  await setValue('#event-category', 'other');
  await fill('#event-notes', '메모 유지');
  const formBefore = await formValues();
  await stubQuota();
  await click('#save-event');
  const alert = await waitText('#form-alert', S.saveFail);
  await delay(300);
  const st8 = await evaluate(`document.getElementById('status').textContent`);
  await unstubQuota();
  check('S8-add', 'SCH-005 AC3 / S8', 'Quota failure: dialog open with input kept, alert, no status, no new chip, focus on 저장, raw unchanged', {
    open: true, form: formBefore, alert: S.saveFail, status: '', chips: ['09:00 원래 제목'], list: ['원래 제목'], focus: 'save-event', raw: seed
  }, { open: await isOpen('event-dialog'), form: await formValues(), alert, status: st8, chips: await chipTexts('2026-11-14'), list: await listTitles(), focus: await active(), raw: await raw() });
  await shot('S8-save-failure-1280');
  await contrast('form-alert-1280', '#event-dialog');
  await click('#save-event');
  check('S8-retry', 'S8 recovery', 'Retry after restoring setItem saves', { status: S.added, n: 2 }, { status: await waitText('#status', S.added), n: (await stored()).length });
  // S8 on edit.
  const seed2 = await raw();
  await click('#day-list .event-item[data-id="evt-A"]');
  await fill('#event-title', '바뀐 제목');
  await stubQuota();
  await click('#save-event');
  const alertE = await waitText('#form-alert', S.saveFail);
  await unstubQuota();
  check('S8-edit', 'SCH-005 AC3 / S8', 'Quota failure on edit leaves list and storage unchanged', { open: true, title: '바뀐 제목', alert: S.saveFail, list: true, raw: seed2, focus: 'save-event' },
    { open: await isOpen('event-dialog'), title: (await formValues()).title, alert: alertE, list: (await listTitles()).includes('원래 제목') && !(await listTitles()).includes('바뀐 제목'), raw: await raw(), focus: await active() });
  // S11 delete failure.
  await click('#delete-event');
  await stubQuota();
  await click('#confirm-action');
  const alertD = await waitText('#confirm-alert', S.delFail);
  await unstubQuota();
  check('S11', 'S11', 'Quota failure on delete: confirm stays with alert, event kept, focus on confirm 삭제', { confirm: true, edit: true, alert: S.delFail, list: true, raw: seed2, focus: 'confirm-action' },
    { confirm: await isOpen('confirm-dialog'), edit: await isOpen('event-dialog'), alert: alertD, list: (await listTitles()).includes('원래 제목'), raw: await raw(), focus: await active() });
  await shot('S11-delete-failure-1280');
  await click('#confirm-cancel');
  check('S11-cancel', 'S11 recovery', '취소 returns to the event dialog', { confirm: false, edit: true }, { confirm: await isOpen('confirm-dialog'), edit: await isOpen('event-dialog') });
});

scenario('SCH-005-S20-S21-concurrency', async () => {
  await viewport(1280, 800);
  seq = 0;
  const A = ev({ id: 'evt-A', title: 'A 일정', start: '09:00', end: '10:00' });
  const C = ev({ id: 'evt-C', title: 'C 일정', start: '13:00', end: '14:00' });
  const D = ev({ id: 'evt-D', title: 'D 다른탭', start: '15:00', end: '16:00' });
  // S20 on add.
  await fresh(JSON.stringify([A, C]));
  await click('#new-event');
  await fill('#event-title', 'keep me');
  const f0 = await formValues();
  await otherTab('{bad');
  await click('#save-event');
  const a20 = await waitText('#form-alert', S.s20);
  const ban = await waitText('#storage-banner', S.bannerText + S.bannerBtn);
  check('S20-add', 'S20', 'Unreadable at write time: nothing written, input kept, alert, banner, 새 일정 disabled, focus on 저장', { alert: S.s20, open: true, form: f0, raw: '{bad', banner: S.bannerText + S.bannerBtn, disabled: true, focus: 'save-event', chips: 0 },
    { alert: a20, open: await isOpen('event-dialog'), form: await formValues(), raw: await raw(), banner: ban, disabled: await evaluate(`document.getElementById('new-event').disabled`), focus: await active(), chips: await evaluate(`document.querySelectorAll('#calendar .chip').length`) });
  await shot('S20-add-1280');
  await press('Escape');
  const fEsc = await evaluate(`document.activeElement&&document.activeElement.closest('#storage-banner')?'banner-button':(document.activeElement&&document.activeElement.id)`);
  check('S20-escape', 'S20 recovery', 'Escape closes; focus to 데이터 초기화', { open: false, focus: 'banner-button' }, { open: await isOpen('event-dialog'), focus: fEsc });
  await click('#storage-banner button');
  await click('#confirm-action');
  check('S20-reset', 'S20 -> S17', 'Reset against the S20 baseline writes []', { raw: '[]', status: S.resetDone }, { raw: await raw(), status: await waitText('#status', S.resetDone) });
  // S20 on edit.
  await fresh(JSON.stringify([A, C]));
  await click('#day-list .event-item[data-id="evt-A"]');
  await fill('#event-title', '수정 중');
  await otherTab('{bad');
  await click('#save-event');
  check('S20-edit', 'S20', 'Edit save with unreadable storage writes nothing and keeps input', { alert: S.s20, title: '수정 중', raw: '{bad', open: true, focus: 'save-event' },
    { alert: await waitText('#form-alert', S.s20), title: (await formValues()).title, raw: await raw(), open: await isOpen('event-dialog'), focus: await active() });
  // S20 on delete.
  await fresh(JSON.stringify([A, C]));
  await click('#day-list .event-item[data-id="evt-A"]');
  await click('#delete-event');
  await otherTab('{bad');
  await click('#confirm-action');
  check('S20-delete', 'S20', 'Delete with unreadable storage: both dialogs open, confirm alert, raw unchanged, focus on 삭제', { alert: S.s20, confirm: true, edit: true, raw: '{bad', focus: 'confirm-action', disabled: true },
    { alert: await waitText('#confirm-alert', S.s20), confirm: await isOpen('confirm-dialog'), edit: await isOpen('event-dialog'), raw: await raw(), focus: await active(), disabled: await evaluate(`document.getElementById('new-event').disabled`) });
  // S21a.
  await fresh(JSON.stringify([A, C]));
  await click('#day-list .event-item[data-id="evt-A"]');
  await fill('#event-title', 'B');
  const other = JSON.stringify([C, D]);
  await otherTab(other);
  await click('#save-event');
  const a21 = await waitText('#form-alert', S.s21a);
  check('S21a', 'S21a / SCH-003', 'Edited event removed elsewhere: no write, input kept, add mode, list re-rendered, focus on 저장', {
    alert: S.s21a, open: true, title: 'B', dlgTitle: '새 일정', delHidden: true, raw: other, list: ['C 일정', 'D 다른탭'], focus: 'save-event', status: ''
  }, { alert: a21, open: await isOpen('event-dialog'), title: (await formValues()).title, dlgTitle: await text('#event-dialog-title'), delHidden: await evaluate(`document.getElementById('delete-event').hidden`), raw: await raw(), list: await listTitles(), focus: await active(), status: await evaluate(`document.getElementById('status').textContent`) });
  await shot('S21a-1280');
  await click('#save-event');
  const st21 = await waitText('#status', S.added);
  const after = await stored();
  const b = after.filter(e => e.title === 'B');
  check('S21a-resave', 'S21a', 'Second 저장 creates a new record B with a new id; others kept; focus #new-event', { status: S.added, nB: 1, newId: true, others: ['evt-C', 'evt-D'], focus: 'new-event' },
    { status: st21, nB: b.length, newId: b.length === 1 && b[0].id !== 'evt-A', others: after.filter(e => e.title !== 'B').map(e => e.id), focus: await active() });
  // S21a Escape path: focus goes to #day-heading.
  await fresh(JSON.stringify([A, C]));
  await click('#day-list .event-item[data-id="evt-A"]');
  await otherTab(JSON.stringify([C]));
  await click('#save-event');
  await waitText('#form-alert', S.s21a);
  await press('Escape');
  check('S21a-escape', 'S21a recovery', 'Escape after S21a writes nothing and focuses #day-heading', { open: false, focus: 'day-heading', raw: JSON.stringify([C]) }, { open: await isOpen('event-dialog'), focus: await active(), raw: await raw() });
  // S21b.
  await fresh(JSON.stringify([A, C]));
  await click('#day-list .event-item[data-id="evt-A"]');
  await click('#delete-event');
  await otherTab(other);
  await click('#confirm-action');
  const st21b = await waitText('#status', S.goneOnDelete);
  check('S21b', 'S21b', 'Delete of event removed elsewhere: both close, no write, re-render, status, focus #day-heading', { confirm: false, edit: false, raw: other, list: ['C 일정', 'D 다른탭'], status: S.goneOnDelete, focus: 'day-heading' },
    { confirm: await isOpen('confirm-dialog'), edit: await isOpen('event-dialog'), raw: await raw(), list: await listTitles(), status: st21b, focus: await active() });
  // Create while another tab added an event: nothing lost.
  await fresh(JSON.stringify([A]));
  await click('#new-event');
  await fill('#event-title', '새것');
  await otherTab(JSON.stringify([A, C, D]));
  await click('#save-event');
  await waitText('#status', S.added);
  const cr = await stored();
  check('CONC-create', 'brief F2 (re-read before write)', 'Create after another tab wrote keeps that tab\'s events and shows them', { ids: ['evt-A', 'evt-C', 'evt-D'], newCount: 4, list: ['A 일정', 'C 일정', 'D 다른탭', '새것'] },
    { ids: cr.map(e => e.id).filter(i => i.startsWith('evt-')), newCount: cr.length, list: (await listTitles()).sort() });
  // Edit preserves fields another tab added to the same record.
  await fresh(JSON.stringify([A, C]));
  await click('#day-list .event-item[data-id="evt-A"]');
  await fill('#event-title', 'A 수정');
  await otherTab(JSON.stringify([Object.assign({}, A, { otherTabField: 'x' }), C]));
  await click('#save-event');
  await waitText('#status', S.updated);
  const ed = (await stored()).find(e => e.id === 'evt-A') || {};
  check('CONC-edit', 'brief (edit spreads fresh record)', 'Edit keeps a field another tab added', { title: 'A 수정', otherTabField: 'x' }, { title: ed.title, otherTabField: ed.otherTabField });
});

scenario('SCH-005-S22', async () => {
  await viewport(1280, 800);
  seq = 0;
  // S22a.
  await fresh('{a');
  await waitFor(`!!document.querySelector('#storage-banner button')`);
  await click('#storage-banner button');
  const valid = JSON.stringify([ev({ id: 'evt-new', title: '다른 탭 일정' })]);
  await otherTab(valid);
  await click('#confirm-action');
  const st = await waitText('#status', S.reloaded);
  check('S22a', 'S22 (a)', 'Reset target became readable: no write, banner removed, event renders, focus #new-event', { raw: valid, confirm: false, banner: false, disabled: false, chips: ['09:00 다른 탭 일정'], status: S.reloaded, focus: 'new-event', writes: [] },
    { writes: await writes(), raw: await raw(), confirm: await isOpen('confirm-dialog'), banner: await visible('#storage-banner'), disabled: await evaluate(`document.getElementById('new-event').disabled`), chips: await chipTexts('2026-11-14'), status: st, focus: await active() });
  // S22b.
  await fresh('{a');
  await waitFor(`!!document.querySelector('#storage-banner button')`);
  await click('#storage-banner button');
  await otherTab('{b');
  await click('#confirm-action');
  const al = await waitText('#confirm-alert', S.s22b);
  check('S22b', 'S22 (b)', 'Reset target changed and still unreadable: no write, alert, banner stays, focus on 초기화', { raw: '{b', alert: S.s22b, open: true, banner: true, focus: 'confirm-action', writes: [] },
    { raw: await raw(), alert: al, open: await isOpen('confirm-dialog'), banner: await visible('#storage-banner'), focus: await active(), writes: await writes() });
  await shot('S22b-1280');
  await click('#confirm-action');
  check('S22b-second', 'S22 (b) recovery', 'Second 초기화 resets against the new baseline', { raw: '[]', status: S.resetDone, writes: ['[]'] }, { raw: await raw(), status: await waitText('#status', S.resetDone), writes: await writes() });
});

scenario('SCH-006-search-filter', async () => {
  for (const [w, h] of [[1280, 800], [375, 800]]) {
    await viewport(w, h);
    seq = 0;
    const evs = [
      ev({ title: '주간 Meeting', date: '2026-11-14', category: 'work' }),
      ev({ title: '등산', date: '2026-11-14', category: 'health', notes: 'after meeting', allDay: true, start: null, end: null }),
      ev({ title: '독서', date: '2026-11-20', category: 'personal' }),
      ev({ title: '치과', date: '2026-11-03', category: 'health' }),
      ev({ title: 'meeting outside', date: '2026-12-01', category: 'work' })
    ];
    const seed = JSON.stringify(evs);
    await fresh(seed);
    check('S12-summary-hidden-' + w, 'design §3.2', 'Summary hidden with no search and filter all', false, await visible('#filter-summary'));
    await fill('#search', 'MEETING');
    check('S12-search-' + w, 'SCH-006 AC1 / S12', 'Case-insensitive search of title and notes; summary counts visible month only', {
      c14: ['등산', '09:00 주간 Meeting'], c20: [], c03: [], c1201: ['09:00 meeting outside'], list: ['등산', '주간 Meeting'], summary: S.summaryN(2)
    }, { c14: await chipTexts('2026-11-14'), c20: await chipTexts('2026-11-20'), c03: await chipTexts('2026-11-03'), c1201: await chipTexts('2026-12-01'), list: await listTitles(), summary: await text('#filter-summary') });
    check('S12-status-' + w, 'S12 / design §6.3', '#status announces summary after the 500 ms pause', S.summaryN(2), await waitText('#status', S.summaryN(2), 2000));
    await setValue('#category-filter', 'health');
    check('S12-combined-' + w, 'SCH-006 AC3', 'Search and filter combine', { c14: ['등산'], list: ['등산'], summary: S.summaryN(1) }, { c14: await chipTexts('2026-11-14'), list: await listTitles(), summary: await text('#filter-summary') });
    await fill('#search', '');
    check('S12-filter-' + w, 'SCH-006 AC2', 'Category filter alone limits calendar and list', { c14: ['등산'], c03: ['09:00 치과'], c20: [], summary: S.summaryN(2) }, { c14: await chipTexts('2026-11-14'), c03: await chipTexts('2026-11-03'), c20: await chipTexts('2026-11-20'), summary: await text('#filter-summary') });
    await setValue('#category-filter', 'personal');
    check('S14-' + w, 'S14', 'Selected day has events but none match', S.dayNoMatch, await text('#day-empty'));
    await setValue('#category-filter', 'all');
    await fill('#search', 'zzzz');
    check('S13-' + w, 'SCH-006 AC4 / S13', 'No results: no chips, both empty texts', { chips: 0, summary: S.summaryNone, day: S.dayNoMatch, clear: '검색 조건 지우기' },
      { chips: await evaluate(`document.querySelectorAll('#calendar .chip').length`), summary: await text('#filter-summary'), day: await text('#day-empty'), clear: await visible('#clear-filters') ? await text('#clear-filters') : 'hidden' });
    check('S13-status-' + w, 'S13', '#status announces the no-match summary', S.summaryNone, await waitText('#status', S.summaryNone, 2000));
    await shot('S13-no-results-' + w);
    await setValue('#category-filter', 'work');
    await click('#clear-filters');
    check('S13-clear-' + w, 'SCH-006 AC3', 'Clearing restores all events, resets controls, hides summary, focuses search', { search: '', filter: 'all', summary: false, focus: 'search', chips: 5, list: ['등산', '주간 Meeting'], raw: seed },
      { search: await evaluate(`document.getElementById('search').value`), filter: await evaluate(`document.getElementById('category-filter').value`), summary: await visible('#filter-summary'), focus: await active(), chips: await evaluate(`document.querySelectorAll('#calendar .chip').length`), list: await listTitles(), raw: await raw() });
  }
  // +N counts only matches.
  await viewport(1280, 800);
  seq = 0;
  const five = [ev({ category: 'work', title: 'w1' }), ev({ category: 'work', title: 'w2', start: '10:00', end: '11:00' }), ev({ category: 'work', title: 'w3', start: '11:00', end: '12:00' }), ev({ category: 'health', title: 'h1', start: '12:00', end: '13:00' }), ev({ category: 'health', title: 'h2', start: '13:00', end: '14:00' })];
  await fresh(JSON.stringify(five));
  const allOverflow = await overflowText('2026-11-14');
  await setValue('#category-filter', 'health');
  check('S12-overflow', 'S12 / SCH-006 AC2', '+N counts only matching events', { all: '+2', health: null, chips: ['12:00 h1', '13:00 h2'] }, { all: allOverflow, health: await overflowText('2026-11-14'), chips: await chipTexts('2026-11-14') });
});

scenario('SCH-007-layout', async () => {
  seq = 0;
  const long = ev({ title: 'W'.repeat(100), notes: 'N'.repeat(1000), category: 'other' });
  const evs = [long, ev({ title: '짧은 일정', allDay: true, start: null, end: null }), ev({ title: '세번째' }), ev({ title: '네번째', start: '18:00', end: '19:00' })];
  for (const [w, h] of [[1280, 800], [375, 800]]) {
    await viewport(w, h);
    await fresh(JSON.stringify(evs));
    let m = await noHScroll();
    check('L-' + w, 'SCH-007 AC1', 'No horizontal page scroll at ' + w + ' (scrollWidth <= clientWidth) with 100-char unbroken title', { noScroll: true, innerOk: true }, { noScroll: m.scrollWidth <= m.clientWidth, innerOk: m.scrollWidth <= m.innerWidth, measured: m }, m.scrollWidth <= m.clientWidth && m.scrollWidth <= m.innerWidth);
    const cols = await evaluate(`(function(){var c=document.querySelector('.calendar-wrap').getBoundingClientRect();var d=document.querySelector('.day-panel').getBoundingClientRect();return {stacked:d.top>=c.bottom-1,side:d.left>=c.right-1,panelW:Math.round(d.width)}})()`);
    if (w === 375) check('L-375-column', 'design §2.2', 'Single column at 375: day panel below the calendar', true, cols.stacked);
    else check('L-1280-columns', 'design §2.1', 'Two columns at 1280: day panel beside calendar, 360 px wide', { side: true, panelW: 360 }, { side: cols.side, panelW: cols.panelW });
    await shot('L-page-' + w);
    await click('#day-list .event-item');
    m = await noHScroll();
    check('L-dialog-' + w, 'SCH-007 AC1', 'No horizontal scroll with the edit dialog open (1000-char notes)', true, m.scrollWidth <= m.clientWidth);
    // Design §2.3 (T2, F1): width = min(560px, 100vw - 32px), so at 375 px with no scrollbar the
    // gutters are 16 px each. The expectation uses only the viewport width (window.innerWidth = 100vw),
    // never the rendered dialog. At 1280 a desktop scrollbar shifts the visual centre; gutters are not asserted there.
    for (const id of ['event-dialog', 'confirm-dialog']) {
      if (id === 'confirm-dialog') await click('#delete-event');
      const d = await evaluate(`(function(){var e=document.getElementById(${q(id)});var r=e.getBoundingClientRect();return {open:e.open,innerWidth:window.innerWidth,clientWidth:document.documentElement.clientWidth,left:r.left,right:window.innerWidth-r.right,width:r.width}})()`);
      const expW = Math.min(560, d.innerWidth - 32);
      const within = (v, e) => Math.abs(v - e) <= 1;
      if (w === 375) {
        check('L-' + id + '-width-375', 'design §2.3 / SCH-007 AC1', id + ' at 375 (mobile emulation, no scrollbar): width min(560, 100vw - 32) ±1 and 16 px ±1 gutters',
          { open: true, noScrollbar: true, width: expW + ' ±1', left: '16 ±1', right: '16 ±1' }, d,
          d.open && d.innerWidth === d.clientWidth && within(d.width, expW) && within(d.left, 16) && within(d.right, 16));
      } else {
        check('L-' + id + '-width-1280', 'design §2.3', id + ' at 1280: width min(560, 100vw - 32) ±1', { open: true, width: expW + ' ±1' }, d, d.open && within(d.width, expW));
      }
    }
    await press('Escape');
    await shot('L-dialog-' + w);
    await contrast('edit-dialog-' + w, '#event-dialog');
    await press('Escape');
  }
  await viewport(1280, 800);
});

scenario('SCH-007-keyboard-focus', async () => {
  await viewport(1280, 800);
  seq = 0;
  const evs = [ev({ id: 'k1', title: '하나' }), ev({ id: 'k2', title: '둘', start: '11:00', end: '12:00' })];
  await fresh(JSON.stringify(evs));
  // Tab order from a freshly loaded page (design §6.1), with focus-visible ring.
  const order = [];
  const rings = [];
  for (let i = 0; i < 9; i++) {
    await press('Tab');
    order.push(await active());
    rings.push(await evaluate(`(function(){var a=document.activeElement;var cs=getComputedStyle(a);return {id:a.id||a.dataset.date||a.dataset.id,fv:a.matches(':focus-visible'),style:cs.outlineStyle,width:cs.outlineWidth,color:cs.outlineColor}})()`));
  }
  check('K-taborder', 'SCH-007 AC2 / design §6.1', 'Tab order: nav, search, filter, new, grid (one stop), list items', ['prev-month', 'next-month', 'today', 'search', 'category-filter', 'new-event', '2026-11-14', 'item:k1', 'item:k2'], order);
  const badRings = rings.filter(r => !(r.fv && r.style === 'solid' && r.width === '3px' && r.color === 'rgb(29, 78, 216)'));
  check('K-focus-visible', 'SCH-007 AC2 / design §7', 'Each focused element shows a 3px solid #1D4ED8 outline', [], badRings);
  // Tab order with search active and with banner.
  await fill('#search', '하');
  await evaluate(`document.activeElement.blur()`);
  await click('#search');
  const o2 = [];
  for (let i = 0; i < 4; i++) { await press('Tab'); o2.push(await active()); }
  check('K-taborder-filter', 'design §6.1', 'Clear-filters button follows 새 일정 when shown', ['category-filter', 'new-event', 'clear-filters', '2026-11-14'], o2);
  // Keyboard-only create: focus new-event, Enter, type, Enter submits.
  await click('#clear-filters');
  await press('Tab'); await press('Tab'); // search -> filter -> new-event
  check('K-at-new', 'harness', 'Focus reached #new-event by Tab', 'new-event', await active());
  await press('Enter');
  check('K-open', 'SCH-007 AC2', 'Enter opens the add dialog and focuses title', { open: true, focus: 'event-title' }, { open: await isOpen('event-dialog'), focus: await active() });
  // Focus trap: 20 Tab and 20 Shift+Tab stay inside.
  let outside = 0;
  for (let i = 0; i < 20; i++) { await press('Tab'); if (!(await evaluate(`!!document.activeElement.closest('#event-dialog')`))) outside++; }
  for (let i = 0; i < 20; i++) { await press('Tab', { shift: true }); if (!(await evaluate(`!!document.activeElement.closest('#event-dialog')`))) outside++; }
  check('K-trap', 'SCH-007 AC2 / design §10.4', '40 Tab/Shift+Tab presses never leave the dialog', 0, outside);
  await click('#event-title');
  await cdp.send('Input.insertText', { text: '키보드 일정' });
  await press('Enter');
  check('K-create', 'SCH-007 AC2', 'Enter in title submits; event added; focus returns to #new-event', { status: S.added, focus: 'new-event', has: true },
    { status: await waitText('#status', S.added), focus: await active(), has: (await listTitles()).includes('키보드 일정') });
  // Keyboard edit open via Enter on a list item, Escape returns focus to it.
  await evaluate(`document.querySelector('#day-list .event-item[data-id="k1"]').focus()`);
  await press('Enter');
  check('K-edit-open', 'SCH-007 AC2', 'Enter on a list item opens edit dialog', { open: true, title: '일정 수정' }, { open: await isOpen('event-dialog'), title: await text('#event-dialog-title') });
  await press('Escape');
  check('K-escape-return', 'SCH-007 AC2', 'Escape closes and returns focus to the opener item', { open: false, focus: 'item:k1' }, { open: await isOpen('event-dialog'), focus: await active() });
  // Keyboard delete: Enter on item, Shift+Tab x3 from title -> 삭제, Enter, Tab to confirm 삭제, Enter.
  await press('Enter');
  await press('Tab', { shift: true }); await press('Tab', { shift: true }); await press('Tab', { shift: true });
  check('K-at-delete', 'SCH-007 AC2 / design §6.4', 'Shift+Tab from title wraps to the last control and reaches 삭제', 'delete-event', await active());
  await press('Enter');
  check('K-confirm-focus', 'S9', 'Confirm opens with focus on 취소', 'confirm-cancel', await active());
  let outC = 0;
  for (let i = 0; i < 6; i++) { await press('Tab'); if (!(await evaluate(`!!document.activeElement.closest('#confirm-dialog')`))) outC++; }
  check('K-confirm-trap', 'SCH-007 AC2', 'Tab stays inside the stacked confirm dialog', 0, outC);
  if ((await active()) !== 'confirm-action') await press('Tab');
  await press('Enter');
  check('K-delete', 'SCH-007 AC2 / S10', 'Keyboard delete succeeds', { status: S.deleted, ids: ['k2'] }, { status: await waitText('#status', S.deleted), ids: (await stored()).filter(e => e.id.startsWith('k')).map(e => e.id) });
  // Keyboard month navigation: buttons keep focus.
  await evaluate(`document.getElementById('next-month').focus()`);
  await press('Enter');
  check('K-month', 'SCH-007 AC2', 'Enter on 다음 달 changes month and keeps focus', { m: '2026년 12월', f: 'next-month' }, { m: await text('#month-heading'), f: await active() });
  // Placeholder contrast (::placeholder).
  const ph = await evaluate(`getComputedStyle(document.getElementById('search'),'::placeholder').color`);
  check('C-placeholder', 'SCH-007 AC4 / design §4.1', 'Search placeholder color is #6B7280 (4.83:1 on white)', 'rgb(107, 114, 128)', ph);
  // Banner state tab order: 새 일정 disabled is skipped, 데이터 초기화 reachable.
  await fresh('{nope');
  await waitFor(`!!document.querySelector('#storage-banner button')`);
  const o3 = [];
  for (let i = 0; i < 7; i++) { await press('Tab'); o3.push(await evaluate(`document.activeElement.closest('#storage-banner')?'banner-button':(document.activeElement.id||document.activeElement.dataset.date)`)); }
  check('K-taborder-banner', 'design §6.1', 'Banner state: 데이터 초기화 follows filter (새 일정 disabled), then grid', ['prev-month', 'next-month', 'today', 'search', 'category-filter', 'banner-button', '2026-11-14'], o3);
  await contrast('disabled-banner-1280');
});

// ================= Runner =================
(async () => {
  const started = new Date().toISOString();
  let server = null;
  if (MODE === 'http') {
    server = await startServer();
    APP_URL = 'http://127.0.0.1:' + server.address().port + '/index.html';
  } else {
    APP_URL = pathToFileURL(path.join(APP_DIR, 'index.html')).href;
  }
  const port = 9300 + Math.floor(Math.random() * 500);
  const chrome = await launchChrome(port);
  cdp = new Cdp(chrome.pageWs);
  await cdp.open();
  await cdp.send('Page.enable');
  await cdp.send('Runtime.enable');
  await cdp.send('Emulation.setFocusEmulationEnabled', { enabled: true });
  await cdp.send('Emulation.setTimezoneOverride', { timezoneId: 'Asia/Seoul' });
  cdp.on('Runtime.exceptionThrown', p => exceptions.push({ scenario: current.scenario, text: p.exceptionDetails && (p.exceptionDetails.exception && p.exceptionDetails.exception.description || p.exceptionDetails.text) }));
  // setItem spy (T2, F3): records every write to the app key before any page script runs. Harness writes use __origSetItem.
  await cdp.send('Page.addScriptToEvaluateOnNewDocument', { source: `(function(){var o=Storage.prototype.setItem;window.__origSetItem=o;window.__lsWrites=[];Storage.prototype.setItem=function(k,v){if(String(k)===${q(KEY)})window.__lsWrites.push(String(v));return o.apply(this,arguments)};})();` });
  // Fixed clock: local 2026-11-14 10:00 (Asia/Seoul), advancing in real time.
  await cdp.send('Page.addScriptToEvaluateOnNewDocument', { source: `(function(){var R=Date;var base=new R(2026,10,14,10,0,0).getTime();var t0=R.now();function now(){return base+(R.now()-t0)}
    function F(){var a=Array.prototype.slice.call(arguments);if(!(this instanceof F))return new R(now()).toString();return a.length===0?new R(now()):new (Function.prototype.bind.apply(R,[null].concat(a)))()}
    F.prototype=R.prototype;F.now=now;F.UTC=R.UTC;F.parse=R.parse;Object.defineProperty(F,'name',{value:'Date'});globalThis.Date=F;})();` });
  const only = args.only ? new RegExp(args.only) : null;
  for (const sc of scenarios) {
    if (only && !only.test(sc.name)) continue;
    current = { scenario: sc.name, viewport: '' };
    console.log('scenario', sc.name);
    try { await sc.fn(); } catch (e) {
      check('ERR-' + sc.name, 'harness', 'Scenario completed without harness error', 'no error', String(e && e.stack || e), false);
      try { await unstubQuota(); } catch (x) { /* ignore */ }
    }
  }
  current = { scenario: 'global', viewport: '' };
  check('EXC', 'regression', 'No uncaught page exceptions during the run', [], exceptions);
  const clockCheck = await evaluate(`new Date().getFullYear()+'-'+(new Date().getMonth()+1)+'-'+new Date().getDate()`).catch(() => null);
  const hashes = {};
  for (const f of ['index.html', 'styles.css', 'src/model.js', 'src/storage.js', 'src/app.js', 'README.md', 'tests/unit/index.js', 'tests/unit/model.test.js', 'tests/unit/storage.test.js', 'tests/e2e/cdp.js', 'tests/e2e/run.js', 'tests/regression/check.js']) {
    try { hashes[f] = execFileSync('git', ['hash-object', path.join(APP_DIR, f)], { cwd: REPO }).toString().trim(); } catch (e) { hashes[f] = null; }
  }
  const summary = { total: checks.length, pass: checks.filter(c => c.verdict === 'pass').length, fail: checks.filter(c => c.verdict === 'fail').length };
  const out = {
    task: 'CL01-SCHED', run: 'T1', mode: MODE, url: APP_URL, started, finished: new Date().toISOString(),
    chrome: chrome.version.Browser, protocol: chrome.version['Protocol-Version'], userAgent: chrome.version['User-Agent'], node: process.version,
    clock: 'Date overridden to local 2026-11-14T10:00 (advancing), timezone Asia/Seoul; page clock read ' + clockCheck,
    hashes, summary, checks, contrast: contrastLog
  };
  fs.writeFileSync(path.join(OUT, 'e2e-results-' + MODE + '.json'), JSON.stringify(out, null, 2));
  console.log(JSON.stringify(summary));
  cdp.close();
  await chrome.close();
  if (server) server.close();
  process.exit(summary.fail ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
