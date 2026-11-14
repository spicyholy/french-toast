// Minimal Chrome DevTools Protocol client for the CL01-SCHED T1 harness.
// Uses only Node 22 built-ins (child_process, fs, WebSocket, fetch).
'use strict';

const { spawn } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';

function delay(ms) { return new Promise(r => setTimeout(r, ms)); }

async function launchChrome(port) {
  const userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'cl01-sched-chrome-'));
  const proc = spawn(CHROME, [
    '--headless=new',
    '--remote-debugging-port=' + port,
    '--user-data-dir=' + userDataDir,
    '--no-first-run', '--no-default-browser-check', '--disable-extensions',
    '--allow-file-access-from-files',
    'about:blank'
  ], { stdio: 'ignore' });
  let version = null;
  for (let i = 0; i < 100; i++) {
    try {
      const res = await fetch('http://127.0.0.1:' + port + '/json/version');
      version = await res.json();
      break;
    } catch (e) { await delay(100); }
  }
  if (!version) throw new Error('Chrome did not start on port ' + port);
  const list = await (await fetch('http://127.0.0.1:' + port + '/json/list')).json();
  const page = list.find(t => t.type === 'page');
  return {
    proc, userDataDir, version, pageWs: page.webSocketDebuggerUrl,
    async close() {
      try { proc.kill(); } catch (e) { /* ignore */ }
      await delay(500);
      try { fs.rmSync(userDataDir, { recursive: true, force: true }); } catch (e) { /* locked files are left for the OS */ }
    }
  };
}

class Cdp {
  constructor(url) {
    this.url = url;
    this.nextId = 1;
    this.pending = new Map();
    this.listeners = new Map();
  }
  open() {
    return new Promise((resolve, reject) => {
      this.ws = new WebSocket(this.url);
      this.ws.onopen = () => resolve();
      this.ws.onerror = (e) => reject(e);
      this.ws.onmessage = (msg) => {
        const data = JSON.parse(typeof msg.data === 'string' ? msg.data : msg.data.toString());
        if (data.id && this.pending.has(data.id)) {
          const { resolve: ok, reject: bad, method } = this.pending.get(data.id);
          this.pending.delete(data.id);
          if (data.error) bad(new Error(method + ': ' + data.error.message));
          else ok(data.result);
        } else if (data.method) {
          for (const fn of (this.listeners.get(data.method) || [])) fn(data.params);
        }
      };
    });
  }
  send(method, params) {
    const id = this.nextId++;
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject, method });
      this.ws.send(JSON.stringify({ id, method, params: params || {} }));
    });
  }
  on(method, fn) {
    if (!this.listeners.has(method)) this.listeners.set(method, []);
    this.listeners.get(method).push(fn);
  }
  once(method, timeout) {
    return new Promise((resolve, reject) => {
      const t = setTimeout(() => reject(new Error('timeout waiting for ' + method)), timeout || 10000);
      const fn = (p) => {
        clearTimeout(t);
        const arr = this.listeners.get(method);
        arr.splice(arr.indexOf(fn), 1);
        resolve(p);
      };
      this.on(method, fn);
    });
  }
  close() { try { this.ws.close(); } catch (e) { /* ignore */ } }
}

module.exports = { launchChrome, Cdp, delay, CHROME };
