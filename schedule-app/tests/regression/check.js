// CL01-SCHED T1 regression checks 1-3 from the brief's verification plan.
// Run from the repository root: node schedule-app/tests/regression/check.js [--out=schedule-app/tests/T1]
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const BASE = '0a432183dc5c6c866dedccf1ddd53e499b5c49b1';
const REPO = process.cwd();
const outArg = process.argv.find(a => a.startsWith('--out='));
const OUT = path.resolve(REPO, outArg ? outArg.slice(6) : 'schedule-app/tests/T1');
const git = (...a) => execFileSync('git', a, { cwd: REPO, maxBuffer: 1 << 26 }).toString();
const lines = s => s.split(/\r?\n/).filter(Boolean);

const results = [];
function rec(id, desc, command, expected, actual, pass) { results.push({ id, desc, command, expected, actual, verdict: pass ? 'pass' : 'fail' }); }

const top = git('rev-parse', '--show-toplevel').trim();
rec('R0', 'Run from the repository root', 'git rev-parse --show-toplevel', 'cwd is the top level', { top, cwd: REPO }, path.resolve(top) === path.resolve(REPO));

const c1 = lines(git('diff', '--name-only', BASE, '--', '.', ':!schedule-app'));
rec('R1', 'Tracked changes outside schedule-app list at most README.md', `git diff --name-only ${BASE} -- . ':!schedule-app'`, 'subset of [README.md]', c1, c1.every(f => f === 'README.md'));

const c2 = lines(git('status', '--porcelain', '--untracked-files=all', '--', '.', ':!schedule-app'));
rec('R2', 'Working tree status outside schedule-app lists at most README.md', `git status --porcelain --untracked-files=all -- . ':!schedule-app'`, 'subset of [ M README.md]', c2, c2.every(l => l.slice(3) === 'README.md'));

const norm = s => s.replace(/\r\n/g, '\n');
const baseReadme = norm(git('show', BASE + ':README.md'));
const curReadme = norm(fs.readFileSync(path.join(REPO, 'README.md'), 'utf8'));
const isSuffix = curReadme.endsWith(baseReadme);
const inserted = isSuffix ? curReadme.slice(0, curReadme.length - baseReadme.length) : null;
const firstLineOk = baseReadme.startsWith('# French Toast · AX Architecture');
const insertedOk = inserted === '' || (inserted !== null && inserted.endsWith('\n') && !/^# /m.test(inserted));
rec('R3', 'Normalized base README is an exact suffix of the current README; inserted report ends with a newline and has no top-level heading',
  'git show BASE:README.md vs README.md, CRLF->LF', 'suffix true, inserted block valid',
  { suffix: isSuffix, insertedLength: inserted === null ? null : inserted.length, baseFirstLine: firstLineOk, insertedValid: insertedOk, reportWritten: inserted !== null && inserted.length > 0 },
  isSuffix && firstLineOk && insertedOk);

fs.mkdirSync(OUT, { recursive: true });
fs.writeFileSync(path.join(OUT, 'regression-results.json'), JSON.stringify({ base: BASE, ran: new Date().toISOString(), results }, null, 2));
for (const r of results) console.log(r.verdict.toUpperCase(), r.id, r.desc, JSON.stringify(r.actual));
process.exit(results.every(r => r.verdict === 'pass') ? 0 : 1);
