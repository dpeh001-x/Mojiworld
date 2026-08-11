// Boot the STAGED package exactly as the tester will: its own bundled node, its
// own serve.js, its own files. Asserts the shipped build is the COMMITTED one
// (the first attempt packaged a stale working copy) and that nothing 404s.
//   node scripts/verify_playtest_build.mjs [dir] [port]
import { chromium } from 'playwright-core';
import { existsSync } from 'node:fs';
import { spawn, execFileSync } from 'node:child_process';
const DIR = process.argv[2] || '_playtest';
// Omit the port and one is chosen for you. This repo routinely has a dozen
// parallel-session servers running (8080, 8090, 8099, 8766, 8791, 8800, 8811,
// 8822, 8844, 8866 were ALL held at once), so a fixed default is a coin flip.
const PORT_ARG = process.argv[3] || '';
const EXE = ['C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].find(existsSync);
const results = []; const ok = (n, c, x) => results.push({ n, pass: !!c, x });

// PRE-FLIGHT: refuse to run if the port is already taken. Parallel sessions
// leave servers behind, and spawn() below reports a failed bind nowhere — so
// without this the whole suite silently grades SOMEONE ELSE'S build. Observed:
// a stale server on 8766 served v0.29.590 while _playtest held v0.29.591.
const net = await import('node:net');
const isFree = (p) => new Promise((res) => {
  const probe = net.createServer();
  probe.once('error', () => res(false));
  probe.once('listening', () => probe.close(() => res(true)));
  probe.listen(p, '127.0.0.1');
});
let PORT;
if (PORT_ARG) {
  // Explicitly requested: if it is taken, ABORT. Never fall through to whatever
  // is already there — spawn() reports a failed bind nowhere, so the whole
  // suite would silently grade someone else's build.
  if (!(await isFree(Number(PORT_ARG)))) {
    console.error(`ABORT: port ${PORT_ARG} is already in use. Something else is serving there;`);
    console.error(`       this suite would test THAT build, not ${DIR}. Omit the port to auto-pick.`);
    process.exit(2);
  }
  PORT = PORT_ARG;
} else {
  for (let p = 8767; p <= 8999 && !PORT; p += 1) if (await isFree(p)) PORT = String(p);
  if (!PORT) { console.error('ABORT: no free port in 8767-8999'); process.exit(2); }
  console.log(`(auto-selected free port ${PORT})`);
}

// The version actually staged, read from the staged file itself.
const { readFileSync: _rf } = await import('node:fs');
const stagedVer = (_rf(`${DIR}/mojiworld_game.html`, 'utf8')
  .match(/GAME_VERSION = '(v[\d.]+)'/) || [])[1];
// Provenance: the staged game file must be byte-identical to a real commit, not
// to a working copy. Compared by blob hash against recent history rather than
// against HEAD alone — HEAD legitimately moves while a 900 MB package builds,
// and that is not a reason to fail.
const stagedBlob = execFileSync('git', ['hash-object', `${DIR}/mojiworld_game.html`], { encoding: 'utf8' }).trim();
const recentBlobs = new Map();
for (const c of execFileSync('git', ['rev-list', '-25', 'HEAD', '--', 'mojiworld_game.html'], { encoding: 'utf8' })
  .split('\n').map(s => s.trim()).filter(Boolean)) {
  try { recentBlobs.set(execFileSync('git', ['rev-parse', `${c}:mojiworld_game.html`], { encoding: 'utf8' }).trim(), c); } catch (e) {}
}
const fromCommit = recentBlobs.get(stagedBlob);

// Absolute: cwd is already the package dir, so a relative binary path would
// resolve inside it a second time.
const { resolve } = await import('node:path');
const bundled = resolve(DIR, 'node', 'node.exe');
const nodeBin = existsSync(bundled) ? bundled : process.execPath;
const srv = spawn(nodeBin, ['serve.js', PORT], { cwd: resolve(DIR), stdio: 'ignore' });
await new Promise(r => setTimeout(r, 2500));

const b = await chromium.launch({ executablePath: EXE, headless: true, args: ['--no-sandbox','--mute-audio'] });
const page = await (await b.newContext()).newPage();
const errs = [], bad = [];
page.on('pageerror', e => errs.push(String(e).slice(0, 140)));
page.on('response', r => { if (r.status() >= 400) bad.push(r.status() + ' ' + r.url().split('/').pop()); });
await page.goto(`http://localhost:${PORT}/mojiworld_game.html`, { waitUntil: 'domcontentloaded', timeout: 180000 });
await page.waitForFunction(() => { try { return typeof game === 'object' && typeof MAPS === 'object'; } catch { return false; } }, null, { timeout: 120000 });
await page.waitForTimeout(14000);

const r = await page.evaluate(async () => {
  const o = { ver: (typeof GAME_VERSION !== 'undefined') ? GAME_VERSION : null };
  try { o.maps = Object.keys(MAPS).length; } catch (e) {}
  try { o.tiles = Object.keys(LX_TILES || {}).length; } catch (e) {}
  try { o.questKey = _questKeyLabel(); } catch (e) { o.questKey = 'ERR'; }
  try { o.gearEditorGone = !Object.prototype.hasOwnProperty.call(ACTION_KEY_DEFAULT, 'gearEditor'); } catch (e) {}
  try { o.binds = Object.assign({}, ACTION_KEY_DEFAULT); } catch (e) { o.binds = null; }
  try {
    const f = BOSS_ATTACK_FRAMES.gravitoslaser;
    const t0 = Date.now();
    while (Date.now() - t0 < 12000 && f && !f.every(x => x && x.complete)) await new Promise(z => setTimeout(z, 250));
    o.laserFrames = f ? f.filter(x => x && x.complete && x.naturalWidth > 0).length : 0;
  } catch (e) { o.laserFrames = 'ERR'; }
  try { o.audio = typeof audio === 'object'; } catch (e) {}
  return o;
});
await b.close();
try { srv.kill(); } catch (e) {}

ok('the package boots from its own bundled server', (r.maps | 0) > 0, { maps: r.maps });
// Served vs staged: proves the page under test came from the server this
// script started, over the files it was pointed at.
ok('the page tested IS the staged build (not another server)', r.ver === stagedVer,
   { served: r.ver, staged: stagedVer });
ok('the staged build is a real COMMIT, not a working copy', !!fromCommit,
   { blob: stagedBlob.slice(0, 10), matchedCommit: fromCommit ? fromCommit.slice(0, 10) : null });
ok('floor/platform tiles load (the thing file:// breaks)', (r.tiles | 0) > 0, { tiles: r.tiles });
ok('tutorial key fix present (quest key resolves to Q)', r.questKey === 'Q', { questKey: r.questKey });
ok('the dev weapon editor is gone', r.gearEditorGone === true, {});
ok('Gravitos laser art is wired and decodes', r.laserFrames === 9, { laserFrames: r.laserFrames });
ok('audio initialised', r.audio === true, {});
ok('NO 404s across the whole boot', bad.length === 0, bad.slice(0, 8));
ok('no page errors', errs.length === 0, errs.slice(0, 3));
ok('README ships with it', existsSync(`${DIR}/README.txt`), {});

// The README teaches keys in prose, so it drifts the way the tutorial did:
// silently, because nothing reads it. Compare the CONTROLS block against the
// bindings the shipped build actually declares.
{
  const { readFileSync } = await import('node:fs');
  let drift = [], taught = new Set(), verOk = false;
  try {
    const txt = readFileSync(`${DIR}/README.txt`, 'utf8');
    verOk = stagedVer != null && txt.includes(stagedVer);
    const block = (txt.split(/^CONTROLS\s*$/m)[1] || '').split(/\n\s*\n\s*\n/)[0] || '';
    for (const line of block.split(/\r?\n/)) {
      // A controls row is "KEY<2+ spaces>description". Prose wraps with single
      // spaces, so this gate keeps sentences out of the taught-keys set — they
      // would otherwise mask real drift by "teaching" every word they contain.
      if (!/\S\s{2,}\S/.test(line)) continue;
      const key = line.split(/\s{2,}/)[0];
      if (!key.trim() || /^-+$/.test(key)) continue;
      for (const t of key.trim().split(/\s+/)) taught.add(t.toLowerCase());
    }
    const MAP = { questJournal: 'quest journal', worldMap: 'world map', codex: 'codex',
      mojidex: 'Mojidex', attributesU: 'character panel', characterK: 'rebind keys',
      talkNpc: 'talk to NPC', block: 'block/parry', dodge: 'dodge', mute: 'mute',
      hpPotion: 'health potion', mpPotion: 'mana potion' };
    for (const [action, label] of Object.entries(MAP)) {
      const live = (r.binds || {})[action];
      if (typeof live !== 'string' || !live.trim()) continue;   // unbound by design
      if (!taught.has(live.toLowerCase())) drift.push(`${label}: build says "${live}", README never teaches it`);
    }
  } catch (e) { drift.push('unreadable: ' + e.message); }
  ok('README teaches the keys this build actually binds', drift.length === 0 && taught.size > 0,
     drift.length ? drift.slice(0, 5) : { keysTaught: taught.size });
  ok('README states the packaged version', verOk, { want: stagedVer });
}
ok('launcher ships with it', existsSync(`${DIR}/Mojiworld.cmd`), {});
ok('bundled node ships (tester installs nothing)', existsSync(`${DIR}/node/node.exe`), {});

let pass = 0, fail = 0;
for (const x of results) { (x.pass ? pass++ : fail++); console.log((x.pass ? 'PASS  ' : 'FAIL  ') + x.n + (!x.pass && x.x != null ? '  ' + JSON.stringify(x.x) : '')); }
console.log(`\n${pass}/${pass + fail} checks passed`);
process.exit(fail ? 1 : 0);
