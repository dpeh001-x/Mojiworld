// The star forms (gravitos2star / gravitos3star) are an ATTACK-ONLY sprite swap
// — they exist to be drawn during the singularity / collapseRain OHKO. They
// also shipped idle and walk sets that nothing could ever reach, because the
// star key is only assigned while the boss is attacking, and idle/walk lookups
// are skipped in that state. Those 36 files were deleted; the base form-2/3
// idle and walk sets cover it.
//
// This proves the removal is inert: nothing requests the deleted art, the base
// forms still animate, and the star ATTACK set still resolves.
//   node scripts/gravitos_star_idle_removal_test.mjs [port]
import { chromium } from 'playwright-core';
import { existsSync, readFileSync } from 'node:fs';
const EXE = ['C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].find(existsSync);
const results = []; const ok = (n, c, x) => results.push({ n, pass: !!c, x });

// --- 1. static: the star key can only be assigned during the OHKO casts ------
const src = readFileSync('mojiworld_game.html', 'utf8');
const assigns = [...src.matchAll(/_gravStarKey\s*=\s*'gravitos([23])star'/g)];
ok('the star key is still assigned for both forms', assigns.length === 2, { found: assigns.length });
let guarded = 0;
for (const a of assigns) {
  const before = src.slice(Math.max(0, a.index - 900), a.index);
  if (/patternState === 'singularity' \|\| m\.patternState === 'collapseRain'/.test(before)) guarded++;
}
ok('every star-key assignment sits inside the singularity/collapseRain guard',
   guarded === assigns.length, { guarded, of: assigns.length });
// idle/walk are only consulted when NOT attacking, and those patterns attack.
ok('idle/walk lookups are skipped while attacking (so a star key can never reach them)',
   /_bossWalking = !_bossAttacking/.test(src) && /_bossIdleImg = \(!_bossAttacking && !_bossWalking\)/.test(src), {});

// --- 2. the generated frame index no longer advertises the deleted sets ------
const idx = JSON.parse(readFileSync('data/sprite_frame_index.js', 'utf8')
  .replace(/^[\s\S]*?window\.LX_SPRITE_FRAME_INDEX = /, '').replace(/;\s*$/, ''));
for (const dir of ['bosses/idle', 'bosses/walk']) {
  for (const k of ['gravitos2star', 'gravitos3star']) {
    ok(`${dir} no longer indexes ${k}`, !(idx.frames[dir] || {})[k], { got: (idx.frames[dir] || {})[k] });
  }
  for (const k of ['gravitos2', 'gravitos3']) {
    ok(`${dir} still indexes the base form ${k}`, (idx.frames[dir] || {})[k] === 9, { got: (idx.frames[dir] || {})[k] });
  }
}
for (const k of ['gravitos2star', 'gravitos3star']) {
  ok(`bosses/attack still indexes ${k} (the star swap must survive)`,
     (idx.frames['bosses/attack'] || {})[k] === 9, { got: (idx.frames['bosses/attack'] || {})[k] });
}

// --- 3. the deleted files really are gone ------------------------------------
let onDisk = 0;
for (const d of ['idle', 'walk']) for (const k of ['gravitos2star', 'gravitos3star'])
  for (let i = 0; i < 9; i++) if (existsSync(`Sprites/bosses/${d}/${k}_${i}.webp`)) onDisk++;
ok('all 36 star idle/walk files are removed from disk', onDisk === 0, { stillThere: onDisk });

// --- 4. runtime: nothing requests them, base forms animate, star attack works -
const net = await import('node:net');
let PORT = process.argv[2];
if (!PORT) {
  const free = (p) => new Promise((r) => { const s = net.createServer();
    s.once('error', () => r(false)); s.once('listening', () => s.close(() => r(true))); s.listen(p, '127.0.0.1'); });
  for (let p = 8767; p <= 8999 && !PORT; p++) if (await free(p)) PORT = String(p);
}
const { spawn } = await import('node:child_process');
const srv = spawn(process.execPath, ['serve.js', PORT], { stdio: 'ignore' });
await new Promise(r => setTimeout(r, 2000));

const b = await chromium.launch({ executablePath: EXE, headless: true, args: ['--no-sandbox', '--mute-audio'] });
const page = await (await b.newContext()).newPage();
const asked = [], bad = [];
page.on('request', r => { const u = r.url(); if (/gravitos[23]star_\d\.webp/.test(u) && /\/(idle|walk)\//.test(u)) asked.push(u.split('/').slice(-3).join('/')); });
page.on('response', r => { if (r.status() >= 400) bad.push(r.status() + ' ' + r.url().split('/').slice(-3).join('/')); });
await page.goto(`http://localhost:${PORT}/mojiworld_game.html`, { waitUntil: 'domcontentloaded', timeout: 180000 });
await page.waitForFunction(() => typeof BOSS_IDLE_FRAMES === 'object' && typeof BOSS_ATTACK_FRAMES === 'object', { timeout: 120000 });
await page.waitForTimeout(12000);

const r = await page.evaluate(async () => {
  const dec = (set) => { const f = set || []; let n = 0; for (const im of f) if (im && im.complete && im.naturalWidth > 0) n++; return n; };
  const t0 = Date.now();
  while (Date.now() - t0 < 15000 && dec(BOSS_IDLE_FRAMES['gravitos2']) < 9) await new Promise(z => setTimeout(z, 250));
  const t1 = Date.now();
  while (Date.now() - t1 < 15000 && dec(BOSS_ATTACK_FRAMES['gravitos2star']) < 9) await new Promise(z => setTimeout(z, 250));
  return {
    idle2: dec(BOSS_IDLE_FRAMES['gravitos2']), idle3: dec(BOSS_IDLE_FRAMES['gravitos3']),
    walk2: dec(BOSS_WALK_FRAMES['gravitos2']), walk3: dec(BOSS_WALK_FRAMES['gravitos3']),
    starIdle2: (BOSS_IDLE_FRAMES['gravitos2star'] || []).length,
    starWalk3: (BOSS_WALK_FRAMES['gravitos3star'] || []).length,
    starAtk2: dec(BOSS_ATTACK_FRAMES['gravitos2star']), starAtk3: dec(BOSS_ATTACK_FRAMES['gravitos3star']),
    starStatic: !!(BOSS_SPRITES['gravitos2star'] || BOSS_ATTACK_SPRITES['gravitos2star']),
  };
});
await b.close(); try { srv.kill(); } catch (e) {}

ok('NOTHING requests a deleted star idle/walk frame', asked.length === 0, asked.slice(0, 4));
ok('base form-2 idle still animates (9 frames)', r.idle2 === 9, { decoded: r.idle2 });
ok('base form-3 idle still animates (9 frames)', r.idle3 === 9, { decoded: r.idle3 });
ok('base form-2 walk still animates (9 frames)', r.walk2 === 9, { decoded: r.walk2 });
ok('base form-3 walk still animates (9 frames)', r.walk3 === 9, { decoded: r.walk3 });
ok('no star idle set is even allocated now', !r.starIdle2 && !r.starWalk3, { idle2: r.starIdle2, walk3: r.starWalk3 });
ok('star ATTACK set still decodes for form 2 (the OHKO swap survives)', r.starAtk2 === 9, { decoded: r.starAtk2 });
ok('star ATTACK set still decodes for form 3', r.starAtk3 === 9, { decoded: r.starAtk3 });
ok('the star static pose is still available as a fallback', r.starStatic === true, {});
ok('no 404s anywhere in boot', bad.length === 0, bad.slice(0, 6));

let pass = 0, fail = 0;
for (const x of results) { (x.pass ? pass++ : fail++); console.log((x.pass ? 'PASS  ' : 'FAIL  ') + x.n + (!x.pass && x.x != null ? '  ' + JSON.stringify(x.x) : '')); }
console.log(`\n${pass}/${pass + fail} checks passed`);
process.exit(fail ? 1 : 0);
