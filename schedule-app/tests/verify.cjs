// No dependencies: real Chrome DevTools Protocol over pipes, plus Node model checks.
const { spawn } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const crypto = require('node:crypto');
const { pathToFileURL } = require('node:url');
const assert = require('node:assert/strict');
const M = require('../dist/model.js');
const root = path.resolve(__dirname, '..');
const results = [];
const errors = [];
const pause = ms => new Promise(r => setTimeout(r, ms));
function check(name, actual, expected = true) { assert.deepEqual(actual, expected, name); results.push({ name, expected, actual, verdict: 'PASS' }); }
function hashes() { return Object.fromEntries(['dist/index.html','dist/styles.css','dist/model.js','dist/app.js','tests/verify.cjs'].map(p => [p, crypto.createHash('sha256').update(fs.readFileSync(path.join(root,p))).digest('hex')])); }
const event = (id, extra={}) => ({ id, title:'회의', date:'2024-02-29', start:'09:00', end:'10:00', category:'work', notes:'design', ...extra });
let chrome;
let profile;
let session;
let sequence = 0;
const waiting = new Map();
let buffer = '';
function command(method, params={}, target=session) {
  const id=++sequence;
  return new Promise((resolve,reject) => {
    const timeout=setTimeout(()=>{waiting.delete(id);reject(new Error(`CDP timeout ${method}`));},15000);
    waiting.set(id,{resolve:r=>{clearTimeout(timeout);resolve(r)},reject:e=>{clearTimeout(timeout);reject(e)}});
    chrome.stdio[3].write(JSON.stringify({id,method,params,...(target?{sessionId:target}:{})})+'\0');
  });
}
async function evaluate(expression) {
  const r=await command('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});
  if(r.exceptionDetails) throw new Error(JSON.stringify(r.exceptionDetails));
  return r.result.value;
}
const click = selector => evaluate(`document.querySelector(${JSON.stringify(selector)}).click()`);
const value = (id,v) => evaluate(`document.getElementById(${JSON.stringify(id)}).value=${JSON.stringify(v)}`);
async function loaded() { for(let n=0;n<100;n++){if(await evaluate("document.querySelectorAll('#calendar .day').length===42"))return;await pause(50)}throw new Error('App did not render'); }
async function reload() { await command('Page.reload'); await pause(100); await loaded(); }
async function key(key,code,virtual) { await command('Input.dispatchKeyEvent',{type:'keyDown',key,code,windowsVirtualKeyCode:virtual}); await command('Input.dispatchKeyEvent',{type:'keyUp',key,code,windowsVirtualKeyCode:virtual}); await pause(30); }
async function form(data) {
  await click('#new-event');
  for(const [k,v] of Object.entries(data))await value('event-'+k,v);
  await click('#event-form button[type=submit]'); await pause(35);
}
async function shot(name) { const r=await command('Page.captureScreenshot',{format:'png',captureBeyondViewport:true});fs.writeFileSync(path.join(__dirname,name+'.png'),Buffer.from(r.data,'base64')); }
async function run() {
  check('R1 valid leap day', M.validDate('2024-02-29'));
  check('R1 reject nonleap day', M.validDate('2023-02-29'),false);
  check('R1 reject rollover date', M.validDate('2024-04-31'),false);
  check('R1 six-week calendar and year rollover', M.monthDays(2026,11).length===42 && M.monthDays(2026,11).some(d=>M.dateKey(d)==='2027-01-01'));
  check('R2 blank title invalid', M.validate(event('a',{title:'   '})).field,'title');
  check('R2 equal time invalid', M.validate(event('a',{end:'09:00'})).field,'end');
  check('R2 reversed time invalid', M.validate(event('a',{end:'08:00'})).field,'end');
  check('R2 bad time invalid', M.validate(event('a',{start:'25:00'})).field,'start');
  check('R4 combined query/category', M.filterEvents([event('a'),event('b',{category:'personal'})],' DESIGN ',['work']).map(e=>e.id),['a']);
  check('R3 reject duplicate IDs', (()=>{try{M.decode(JSON.stringify({version:1,events:[event('a'),event('a')]}));return false}catch{return true}})());
  check('R3 reject unsupported version', (()=>{try{M.decode('{"version":2,"events":[]}');return false}catch{return true}})());
  let writes=0, failRead=true, raw=JSON.stringify({version:1,events:[event('old')]});
  const storage={getItem(){if(failRead)throw Error('denied');return raw},setItem(k,v){writes++;raw=v}};
  const store=M.createStore(()=>storage);
  check('R3 initial read locks',store.locked);
  store.replace([event('new')]);store.retry();check('R3 unread retry never writes',writes,0);
  failRead=false;store.retry();check('R3 retry recovers old records',store.events.map(e=>e.id),['old']);
  let failWrite=true;storage.setItem=(k,v)=>{if(failWrite)throw Error('quota');raw=v};
  store.replace([event('new')]);check('R3 write failure retains session',store.status==='write-error'&&store.events[0].id==='new');
  failWrite=false;store.retry();check('R3 write retry persists',JSON.parse(raw).events[0].id,'new');
  profile=fs.mkdtempSync(path.join(os.tmpdir(),'onyu-tests-'));
  chrome=spawn(process.env.CHROME_PATH||'C:/Program Files/Google/Chrome/Application/chrome.exe',['--headless=new','--no-sandbox','--disable-gpu','--no-first-run','--no-default-browser-check','--disable-background-networking','--remote-debugging-pipe','--user-data-dir='+profile],{stdio:['ignore','ignore','pipe','pipe','pipe']});
  chrome.on('error',e=>{for(const w of waiting.values())w.reject(e)});
  chrome.stderr.on('data',()=>{});
  chrome.stdio[4].on('data',chunk=>{buffer+=chunk.toString();let end;while((end=buffer.indexOf('\0'))>=0){const msg=JSON.parse(buffer.slice(0,end));buffer=buffer.slice(end+1);if(msg.id&&waiting.has(msg.id)){const w=waiting.get(msg.id);waiting.delete(msg.id);msg.error?w.reject(new Error(JSON.stringify(msg.error))):w.resolve(msg.result)}else if(msg.method==='Runtime.exceptionThrown')errors.push(msg.params.exceptionDetails)}});
  const browser=await command('Browser.getVersion',{},null);
  const target=await command('Target.createTarget',{url:'about:blank'},null);
  session=(await command('Target.attachToTarget',{targetId:target.targetId,flatten:true},null)).sessionId;
  await command('Page.enable');await command('Runtime.enable');
  await command('Emulation.setDeviceMetricsOverride',{width:1440,height:1000,deviceScaleFactor:1,mobile:false});
  await command('Page.navigate',{url:pathToFileURL(path.join(root,'dist/index.html')).href}); await loaded();
  check('R1 initial month is local current month',await evaluate("document.getElementById('month-label').textContent"),await evaluate("`${new Date().getFullYear()}년 ${new Date().getMonth()+1}월`"));
  check('R1 initial date selects today',await evaluate("document.querySelector('.day[aria-current=date]').getAttribute('aria-pressed')"),'true');
  check('R3 first run is empty, writable',await evaluate("document.querySelectorAll('.agenda-card').length===0&&!document.getElementById('new-event').disabled"));
  await shot('desktop-empty');
  await click('#new-event');
  check('R5 initial dialog focus',await evaluate('document.activeElement.id'),'event-title');
  await key('Escape','Escape',27);
  check('R5 Escape closes and restores focus',await evaluate("!document.getElementById('event-dialog').open&&document.activeElement.id==='new-event'"));
  await click('#new-event');await value('event-title',' ');await click('#event-form button[type=submit]');
  check('R2 blank title field error retains dialog',await evaluate("document.getElementById('event-dialog').open&&document.activeElement.id==='event-title'&&document.getElementById('event-title').getAttribute('aria-invalid')==='true'"));
  await value('event-title','검증');await value('event-end','08:00');await click('#event-form button[type=submit]');
  check('R2 reversed time field error',await evaluate("document.activeElement.id==='event-end'&&document.getElementById('event-dialog').open"));
  await value('event-end','09:00');await click('#event-form button[type=submit]');check('R2 equal time field error',await evaluate("document.activeElement.id==='event-end'"));
  await value('event-date','');await click('#event-form button[type=submit]');check('R2 invalid date field error',await evaluate("document.activeElement.id==='event-date'"));
  // Native Chrome can report BODY at its browser-chrome traversal boundary.
  // Require the following Tab to return inside; never permit an underlying control.
  for(let n=0;n<20;n++){await key('Tab','Tab',9);let focus=await evaluate("({tag:document.activeElement.tagName,inside:document.getElementById('event-dialog').contains(document.activeElement)})");if(!focus.inside&&focus.tag==='BODY'){await key('Tab','Tab',9);focus=await evaluate("({tag:document.activeElement.tagName,inside:document.getElementById('event-dialog').contains(document.activeElement)})");}check(`R5 modal Tab containment ${n+1}`,focus.inside);}
  await key('Escape','Escape',27);
  const today=await evaluate('Onyu.dateKey(new Date())');
  await form({title:'  Design 회의  ',date:today,start:'15:00',end:'16:00',category:'work',notes:'초안 검토'});
  check('R2 create trims title and renders',await evaluate("document.querySelector('.agenda-card h3').textContent"),'Design 회의');
  const id=await evaluate("JSON.parse(localStorage.getItem(Onyu.KEY)).events[0].id");
  await reload();check('R3 refresh retains actual event',await evaluate("document.querySelector('.agenda-card h3').textContent"),'Design 회의');
  await click('.agenda-card .card-actions button');await value('event-title','수정 회의');await click('#event-form button[type=submit]');await pause(40);
  check('R2 edit keeps ID and replaces title',await evaluate(`JSON.parse(localStorage.getItem(Onyu.KEY)).events[0].id===${JSON.stringify(id)}&&document.querySelector('.agenda-card h3').textContent==='수정 회의'`));
  await form({title:'산책',date:today,start:'08:00',end:'09:00',category:'personal',notes:'DESIGN 생각'});
  check('R1 agenda chronological order',await evaluate("[...document.querySelectorAll('.agenda-card h3')].map(e=>e.textContent)"),['산책','수정 회의']);
  const otherDate=await evaluate("document.querySelector('#calendar .day:not(.selected):not(.outside)').dataset.date");
  await click(`#calendar .day[data-date="${otherDate}"]`);
  const otherHeading=`${Number(otherDate.slice(5,7))}월 ${Number(otherDate.slice(8))}일`;
  check('R1 calendar day click changes selected aria state',await evaluate(`document.querySelector('#calendar .day[data-date="${otherDate}"]').getAttribute('aria-pressed')==='true'&&document.querySelectorAll('#calendar .day[aria-pressed=true]').length===1`));
  check('R1 calendar day click changes heading and agenda',await evaluate("({heading:document.getElementById('selected-date').textContent,count:document.querySelectorAll('.agenda-card').length})"),{heading:otherHeading,count:0});
  await click(`#calendar .day[data-date="${today}"]`);
  check('R1 calendar return click restores selected date',await evaluate("document.querySelector('#calendar .day[aria-pressed=true]').dataset.date"),today);
  check('R1 calendar return click restores saved agenda',await evaluate("({heading:document.getElementById('selected-date').textContent,titles:[...document.querySelectorAll('.agenda-card h3')].map(e=>e.textContent)})"),{heading:`${Number(today.slice(5,7))}월 ${Number(today.slice(8))}일`,titles:['산책','수정 회의']});
  await value('search',' design ');await evaluate("document.getElementById('search').dispatchEvent(new Event('input',{bubbles:true}))");
  check('R4 notes case-insensitive search',await evaluate("[...document.querySelectorAll('.agenda-card h3')].map(e=>e.textContent)"),['산책']);
  await click('#category-options input[value=personal]');
  check('R4 category AND search both views',await evaluate("document.querySelectorAll('.agenda-card').length===0&&document.querySelectorAll('.event-chip').length===0&&document.getElementById('agenda').textContent.includes('조건에 맞는')"));
  await click('#agenda .empty-agenda button');check('R4 filter reset restores results',await evaluate("document.querySelectorAll('.agenda-card').length===2&&document.getElementById('search').value===''"));
  await click('.agenda-card .card-actions button:last-child');check('R2 deletion confirmation defaults cancel',await evaluate("document.getElementById('confirm-dialog').open&&document.activeElement.id==='confirm-cancel'"));
  await click('#confirm-cancel');check('R2 cancel deletion preserves records',await evaluate("document.querySelectorAll('.agenda-card').length"),2);
  await click('.agenda-card .card-actions button:last-child');await click('#confirm-action');await pause(40);check('R2 confirm deletion removes one persisted record',await evaluate("document.querySelectorAll('.agenda-card').length===1&&JSON.parse(localStorage.getItem(Onyu.KEY)).events.length===1"));
  await form({title:'연말',date:'2026-12-31',start:'10:00',end:'11:00'});await click('#next-month');
  check('R1 December to January',await evaluate("document.getElementById('month-label').textContent"),'2027년 1월');await click('#prev-month');check('R1 January to December',await evaluate("document.getElementById('month-label').textContent"),'2026년 12월');
  await form({title:'윤일',date:'2024-02-29',start:'10:00',end:'11:00'});check('R1 leap date selection',await evaluate("document.querySelector('.day.selected').dataset.date"),'2024-02-29');
  await click('#today');check('R1 Today resets selection',await evaluate("document.querySelector('.day.selected').dataset.date"),today);
  await form({title:'<img src=x onerror=alert(1)>',date:today,start:'11:00',end:'12:00'});check('R2 input renders literal text',await evaluate("document.querySelectorAll('#agenda img').length===0&&document.getElementById('agenda').textContent.includes('<img src=x onerror=alert(1)>')"));
  await shot('desktop-populated');
  await command('Emulation.setDeviceMetricsOverride',{width:360,height:800,deviceScaleFactor:1,mobile:true});await pause(70);
  check('R5 360px page no horizontal overflow',await evaluate('document.documentElement.scrollWidth<=360'));
  await shot('mobile-populated');await click('#new-event');check('R5 mobile dialog fits viewport',await evaluate("(()=>{const r=document.getElementById('event-dialog').getBoundingClientRect();return r.left>=0&&r.right<=360&&r.height<=innerHeight})()"));await shot('mobile-dialog');await key('Escape','Escape',27);
  await command('Emulation.setDeviceMetricsOverride',{width:1440,height:1000,deviceScaleFactor:1,mobile:false});
  await click('.agenda-card .card-actions button');await value('event-title','나를 위한 독서 시간');await click('#event-form button[type=submit]');await pause(40);
  await shot('desktop-demo');
  await command('Emulation.setDeviceMetricsOverride',{width:360,height:800,deviceScaleFactor:1,mobile:true});await shot('mobile-demo');
  await command('Emulation.setDeviceMetricsOverride',{width:1440,height:1000,deviceScaleFactor:1,mobile:false});
  await evaluate("window.originalSet=Storage.prototype.setItem;Storage.prototype.setItem=function(k,v){if(k===Onyu.KEY)throw new DOMException('Quota','QuotaExceededError');return originalSet.call(this,k,v)}");
  await form({title:'저장 실패 세션',date:today,start:'17:00',end:'18:00'});
  check('R3 write failure keeps session and warning',await evaluate("document.getElementById('agenda').textContent.includes('저장 실패 세션')&&!document.getElementById('storage-warning').hidden&&!localStorage.getItem(Onyu.KEY).includes('저장 실패 세션')"));
  await evaluate('Storage.prototype.setItem=originalSet');await click('#retry-storage');check('R3 write retry persists session and clears warning',await evaluate("localStorage.getItem(Onyu.KEY).includes('저장 실패 세션')&&document.getElementById('storage-warning').hidden"));
  const injection=await command('Page.addScriptToEvaluateOnNewDocument',{source:"window.failReads=true;window.writeCalls=0;const originalGet=Storage.prototype.getItem,originalSet=Storage.prototype.setItem;Storage.prototype.getItem=function(k){if(k==='onyu.schedule.v1'&&window.failReads)throw Error('denied');return originalGet.call(this,k)};Storage.prototype.setItem=function(k,v){window.writeCalls++;return originalSet.call(this,k,v)};"});
  await reload();check('R3 failed initial read locks both add controls',await evaluate("document.getElementById('new-event').disabled&&document.getElementById('add-selected').disabled&&!document.getElementById('storage-warning').hidden"));
  await click('#retry-storage');check('R3 failed initial read retry has zero writes',await evaluate('window.writeCalls'),0);
  await evaluate('window.failReads=false');await click('#retry-storage');check('R3 read retry restores existing records without writes',await evaluate("!document.getElementById('new-event').disabled&&window.writeCalls===0&&document.getElementById('agenda').textContent.includes('저장 실패 세션')"));
  await command('Page.removeScriptToEvaluateOnNewDocument',{identifier:injection.identifier});
  await evaluate("localStorage.setItem(Onyu.KEY,'{broken')");await reload();check('R3 corrupt storage stays preserved and locks editor',await evaluate("localStorage.getItem(Onyu.KEY)==='{broken'&&document.getElementById('new-event').disabled"));
  await click('#retry-storage');check('R3 corrupt retry does not overwrite',await evaluate("localStorage.getItem(Onyu.KEY)"),'{broken');
  await click('#reset-storage');await click('#confirm-cancel');check('R3 canceled reset preserves original',await evaluate("localStorage.getItem(Onyu.KEY)"),'{broken');
  await click('#reset-storage');await click('#confirm-action');await pause(40);check('R3 confirmed reset initializes empty writable storage',await evaluate("JSON.parse(localStorage.getItem(Onyu.KEY)).events.length===0&&!document.getElementById('new-event').disabled"));
  check('R5 all form controls visibly labelled',await evaluate("[...document.querySelectorAll('#event-form input,#event-form select,#event-form textarea')].every(e=>document.querySelector('label[for='+e.id+']'))"));
  check('Browser uncaught exceptions',errors.length,0);
  const report={date:new Date().toISOString(),browser,environment:{node:process.version,platform:process.platform,transport:'Chrome DevTools pipe; file URL',http:'Local TCP denied; file URL tested'},hashes:hashes(),results,screenshots:['desktop-empty.png','desktop-populated.png','mobile-populated.png','mobile-dialog.png','desktop-demo.png','mobile-demo.png'],uncaughtExceptions:errors};
  fs.writeFileSync(path.join(__dirname,'results.json'),JSON.stringify(report,null,2)+'\n');
  console.log(JSON.stringify({verdict:'PASS',checks:results.length,browser:browser.product,report:'schedule-app/tests/results.json'}));
}
run().catch(e=>{fs.writeFileSync(path.join(__dirname,'failure.json'),JSON.stringify({error:e.stack,hashes:hashes(),results,errors},null,2));console.error(e.stack);process.exitCode=1}).finally(async()=>{if(chrome){try{await command('Browser.close',{},null)}catch{}chrome.kill();}if(profile){try{fs.rmSync(profile,{recursive:true,force:true})}catch{}}});
