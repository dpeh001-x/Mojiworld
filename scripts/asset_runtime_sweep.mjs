// Static auditing proves paths RESOLVE; it cannot prove the running game never
// asks for a dead one. This drives the real render paths and records every
// asset request the browser actually makes.
//
//   node serve.js 8870 && node scripts/asset_runtime_sweep.mjs 8870 [page]
import { chromium } from 'playwright-core';
import { existsSync } from 'node:fs';
const PORT = process.argv[2] || '8870';
const PAGE = process.argv[3] || 'mojiworld_game.html';
const EXE = ['C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].find(existsSync);
const results = []; const ok = (n, c, x) => results.push({ n, pass: !!c, x });

const b = await chromium.launch({ executablePath: EXE, headless: true, args: ['--no-sandbox','--disable-gpu','--mute-audio'] });
const page = await (await b.newContext({ serviceWorkers: 'block' })).newPage();
const errs = []; page.on('pageerror', e => errs.push(String(e).slice(0, 160)));
const asset = /\.(png|webp|jpg|jpeg|gif|svg|mp3|ogg|wav|mp4|webm)(\?|$)/i;
const reqs = [];
page.on('response', r => { const u = r.url(); if (asset.test(u)) reqs.push({ s: r.status(), u: u.replace(/^https?:\/\/[^/]+\//, '') }); });
page.on('requestfailed', r => { const u = r.url(); if (asset.test(u)) reqs.push({ s: 'FAILED', u: u.replace(/^https?:\/\/[^/]+\//, '') }); });

await page.goto(`http://localhost:${PORT}/${PAGE}`, { waitUntil: 'domcontentloaded', timeout: 180000 });
await page.waitForFunction(() => { try { return typeof eval('renderSkillBar') === 'function'; } catch { return false; } }, null, { timeout: 180000 });

// Exercise the surfaces that build asset paths by concatenation — the shape
// the WebP conversion could not see and therefore broke five times.
const probe = await page.evaluate(async () => {
  const p = eval('player');
  const out = {};
  const wait = (ms) => new Promise(r => setTimeout(r, ms));
  const tryCall = (fn) => { try { return fn(); } catch (e) { return null; } };

  // every class, so the Block-icon repointer and the HUD crest run for each
  for (const cls of ['warrior', 'rogue', 'mage', 'archer']) {
    p.cls = cls;
    tryCall(() => eval('renderSkillBar')());
    tryCall(() => eval('_lxRefreshBlockIcon')());
    await wait(120);
  }
  out.blockSrc = tryCall(() => eval('_lxBlockIconSrc')());

  // boon icons: resolve every id the powerup table knows
  const P = tryCall(() => eval('POWERUPS')) || {};
  const boonIds = Array.isArray(P) ? P.map(x => x && x.id).filter(Boolean) : Object.keys(P);
  boonIds.forEach(id => tryCall(() => eval('_boonIconUrl')(id)));
  await wait(1500);
  out.boons = { total: boonIds.length, resolved: boonIds.filter(id => tryCall(() => eval('_boonIconUrl')(id))).length };

  // class crests, injected so the browser really fetches them
  const host = document.createElement('div');
  host.style.cssText = 'position:absolute;left:-9999px;top:0';
  document.body.appendChild(host);
  const crests = ['warrior','mage','rogue','archer','knight','berserker','ninja','assassin','priest','archmage','ranger','sniper','warlock'];
  host.innerHTML = crests.map(c => tryCall(() => eval('_crestImgHTML')(c, '?', 32)) || '').join('');
  await wait(1500);

  // skill icons across every id the bar can show
  const SK = tryCall(() => eval('SKILLS')) || {};
  const skillIds = Object.keys(SK);
  skillIds.forEach(id => tryCall(() => eval('_skillIconUrl')(id)));
  await wait(2000);
  out.skills = { total: skillIds.length, resolved: skillIds.filter(id => tryCall(() => eval('_skillIconUrl')(id))).length };
  return out;
});

await page.waitForTimeout(1200);
await b.close();

const bad = reqs.filter(r => r.s === 404 || r.s === 'FAILED' || (typeof r.s === 'number' && r.s >= 400));
const pngs = reqs.filter(r => /\.png(\?|$)/i.test(r.u));
const uniq = (a) => [...new Set(a.map(x => x.u))];

console.log(`asset requests observed: ${reqs.length}  (unique ${uniq(reqs).length})`);
console.log(`boon icons resolved:  ${probe.boons.resolved}/${probe.boons.total}`);
console.log(`skill icons resolved: ${probe.skills.resolved}/${probe.skills.total}  (not every skill has authored art)`);
console.log(`block icon src: ${probe.blockSrc}`);

ok('no asset request 404s or fails at runtime', bad.length === 0, uniq(bad).slice(0, 8));
ok('boon icons resolve (they were 0 before v0.29.516)', probe.boons.resolved > 0,
   { resolved: probe.boons.resolved, of: probe.boons.total });
ok('skill icons resolve (they were 0 before v0.29.512)', probe.skills.resolved > 0,
   { resolved: probe.skills.resolved, of: probe.skills.total });
ok('the block icon points at .webp', /\.webp$/.test(String(probe.blockSrc)), { src: probe.blockSrc });
ok('nothing requested a .png at all', pngs.length === 0, uniq(pngs).slice(0, 8));
ok('no page errors', errs.length === 0, errs.slice(0, 3));

let pass = 0, fail = 0;
for (const x of results) { (x.pass ? pass++ : fail++); console.log((x.pass ? 'PASS  ' : 'FAIL  ') + x.n + (x.x != null ? '  ' + JSON.stringify(x.x) : '')); }
console.log(`\n${pass}/${pass + fail} checks passed`);
process.exit(fail ? 1 : 0);
