// RELEASE 28c (boss-fairness fix set) stays fixed. Desktop 960x560 (+ 844x390 for the cards), real keys (Up at a door, N to talk, A to block,
// arrows to walk in, Z to swing) and clicks:
//   [1] the Sundered Smith's pillars are heavy, not lethal: a Lv 45 archer and a Lv 50 mage in T6 shop gear standing in a Forge Pillar / the
//       White-Hot Ruin lose 30-85% of the bar (was 99.9%, every time); a Lv 45 warrior still loses >= 15%
//   [2] the Singularity's door recommends Lv 90 (Gravitos Lv 100, q_boss_gravitos Lv 90; was 70); every other arena keeps its number
//   [3] Elder Arlen (an Elder: isMiniBoss) takes the boss miss rules at his level: >= 38% of basics land (was ~13%), real Z swings (each basic that reaches him) agree; an
//       ordinary (unflagged) Path's Bane / Grave Reaver keeps the old evasion roll
//   [4] Sagitta's Point-Blank Volley winds up >= 15 sim steps after the hero comes within 200 px (was the same tick), Block (A) cuts it to
//       <= 45% of the unblocked loss (was ignored), its number is the HP it took; Marked Shot and Tidal Crush take the same path (source)
//   [5] Bravo's Expedition cards (main, first-run loot card, a friend's code) name the tower bosses' level for a Lv 30 hero (Lv 60, the spawn's
//       own formula) and warn it will not be easy; the gate stays at Lv 30
//   [6] a boss-arena card names the boss's level beside the hero's: at the recommended level it says "this will not be easy", over the boss's
//       level it does not; the card fits 960x560 and 844x390
//   node release28c_test.mjs   PORT (default 15830) / MOJI_GAME_FILE / SERVE_ROOT / ONLY=1,..,6 / SHOT_DIR + SHOT_TAG (screenshots)
import { createRequire } from 'node:module'; import path from 'node:path'; import { fileURLToPath } from 'node:url'; import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
const ROOT = process.env.SERVE_ROOT || path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(path.join(ROOT, 'package.json'));
const { chromium } = require('playwright-core');
const PORT = Number(process.env.PORT || 15830), FILE = process.env.MOJI_GAME_FILE ? path.basename(process.env.MOJI_GAME_FILE) : 'mojiworld_game.html';
const URL = `http://localhost:${PORT}/${FILE}?dev=1&lxhold=0`;
const SHOT = process.env.SHOT_DIR || '', TAG = process.env.SHOT_TAG || 'run';
let pass = 0, fail = 0; const ok = (n, c, x) => { if (c) pass++; else fail++; console.log((c ? 'PASS ' : 'FAIL ') + n + (x !== undefined ? '  [' + JSON.stringify(x).slice(0, 700) + ']' : '')); };
const on = (k) => !process.env.ONLY || process.env.ONLY.split(',').includes(k);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const server = spawn(process.execPath, [path.join(ROOT, 'serve.js'), String(PORT)], { stdio: 'ignore', cwd: ROOT, env: { ...process.env } });
console.log('server pid ' + server.pid);
await sleep(1500);
const EXE = ['C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', '/usr/bin/google-chrome'].find((p) => existsSync(p));
const browser = await chromium.launch({ executablePath: EXE, headless: true, args: ['--no-sandbox', '--mute-audio'] });
try { console.log('browser pid ' + browser.process().pid); } catch (e) {}
const errs = [];
const install = (page) => page.evaluate(() => {
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const clear = () => { try { if (typeof _dismissBossIntro === 'function') _dismissBossIntro(); } catch (e) {} try { closeAllModals(); } catch (e) {} try { closeDialog(); } catch (e) {}
    for (const id of ['story-beat-overlay', 'boss-intro-overlay']) { const e = document.getElementById(id); if (e) e.classList.remove('on'); }
    { const w = document.getElementById('everdawn-welcome-overlay'); if (w) { try { w.remove(); } catch (e) {} } } game.paused = false; };
  window.__r = (el) => { if (typeof el === 'string') el = document.querySelector(el); if (!el || !el.getClientRects().length) return null; const b = el.getBoundingClientRect(); return { x: b.left + b.width / 2, y: b.top + b.height / 2 }; };
  // per-sim-step HP log: every drop with its source, and the taken-damage numbers pushed that step
  window.__hl = { ev: [], last: null, nums: [] };
  if (!window.__hlOn) { window.__hlOn = 1; const _up = window.updatePlayer; window.updatePlayer = function () { try { const H = window.__hl, hp = player.hp;
      if (H.last != null && hp < H.last - 0.5) H.ev.push({ t: game.time | 0, loss: Math.round(H.last - hp), pct: +(100 * (H.last - hp) / getMaxHp()).toFixed(1), src: String(player._lastDamageSource || ''), blk: player.blockTimer > 0, nums: H.nums.slice() });
      H.nums = []; H.last = player.hp;
      const dn = game.damageNumbers; if (dn && !dn.__h) { dn.__h = 1; const _push = dn.push; dn.push = function (o) { try { if (o && o.taken) window.__hl.nums.push(String(o.text)); } catch (e) {} return _push.apply(this, arguments); }; }
    } catch (e) {} return _up.apply(this, arguments); }; }
  try { window.openTalentPick = function () {}; } catch (e) {}
  window._r28c = { sleep, clear,
    // a Lv N hero of the current class: job, master, the best non-set shop gear of the level's shop tier (the boss sweep's recipe)
    hero: (lv) => { const cls = player.cls;
      devSetLevel(lv); let job = null;
      if (lv >= 20) { job = Object.keys(JOBS).find((j) => JOBS[j].cls === cls); if (job) devSetJob(job); }
      if (lv >= 40 && job) { const ms = Object.keys(MASTERS).find((k) => MASTERS[k].from === job); if (ms) devSetMaster(ms); }
      const shopTier = (l) => l >= 88 ? 10 : l >= 78 ? 9 : l >= 68 ? 8 : l >= 55 ? 7 : l >= 40 ? 6 : l >= 20 ? 4 : l >= 10 ? 3 : l >= 6 ? 2 : 1;
      for (const cat of ['weapons', 'armors', 'accessories']) {
        const pool = ITEM_POOL[cat].filter((it) => !it.setId && (it.tier | 0) <= shopTier(lv) && (!it.cls || it.cls === 'any' || it.cls === cls)); if (!pool.length) continue;
        const top = Math.max(...pool.map((p) => p.tier | 0)); const best = pool.filter((it) => (it.tier | 0) === top); const mine = best.filter((it) => it.cls === cls);
        player.equipped[_catToSlot(cat)] = { ...(mine.length ? mine : best).sort((a, b) => itemScore(b) - itemScore(a))[0], slot: _catToSlot(cat) }; }
      player._equipBonusCache = null; try { invalidateEquipBonusCache(); } catch (e) {}
      player._storyBeatsSeen = {}; for (const k in STORY_BEATS) player._storyBeatsSeen[k] = true;
      player._tutorialSeen = true; player._gravitosCineSeen = true; player._god = false; window._god = false; player.invulnerable = 0; },
    go: async (map, x) => { clear(); loadMap(map, x || 300); await sleep(1500); clear(); },
    fill: () => { player.hp = getMaxHp(); player.mp = getMaxMp(); window.__hl.last = player.hp; } };
});
const boot = async (cls, vp) => {
  const ctx = await browser.newContext({ serviceWorkers: 'block', viewport: vp || { width: 960, height: 560 } });
  await ctx.addInitScript(() => { try { localStorage.setItem('mojiworld_prologue_seen', '1'); localStorage.setItem('mojiworld_tutorial_seen', '1'); } catch (e) {} });
  const page = await ctx.newPage(); page.on('pageerror', (e) => errs.push(String(e.message).slice(0, 140)));
  await page.goto(URL, { waitUntil: 'domcontentloaded', timeout: 180000 });
  await page.waitForFunction(() => window._lxBootMenuSeen && typeof loadMap === 'function', null, { timeout: 240000 });
  console.log('  build', await page.evaluate(() => (typeof GAME_VERSION !== 'undefined' ? GAME_VERSION : '?')), cls);
  await page.evaluate((c) => {
    try { _lxBootGateDone = true; _prologueActive = false; } catch (e) {}
    { const ov = document.getElementById('loading-overlay'); if (ov) ov.classList.add('fade'); }
    for (const id of ['loading-overlay', 'lo-auth', 'class-select-modal', 'lo-menu']) { const el = document.getElementById(id); if (el) el.style.display = 'none'; }
    try { _lxBootHold.release('menu'); } catch (e) {}
    if (player.cls !== c) { try { applyClass(c); } catch (e) {} player.cls = c; }
  }, cls);
  await page.waitForTimeout(1500);
  await install(page); return { ctx, page };
};
const press = async (page, key, hold = 90) => { await page.keyboard.down(key); await page.waitForTimeout(hold); await page.keyboard.up(key); await page.waitForTimeout(120); };
const shot = async (page, name) => { if (!SHOT) return; try { await page.screenshot({ path: path.join(SHOT, name) }); console.log('  shot ' + name); } catch (e) { console.log('  shot failed ' + e.message); } };
try {
// [1] stand in a pillar wave: quench the Smith, re-arm his pillars, stand the hero in the column farthest from him (no contact), full HP
const pillars = async (page, reps) => {
  const out = [];
  for (let r = 0; r < reps; r++) {
    await page.evaluate(() => { const { clear, fill } = window._r28c; clear(); const m = game.monsters.find((x) => x.type === 'sundered_smith' && x.currentHp > 0);
      if (!m) return; m._smithHeat = 'quenched'; m._smithHeatAt = (game.time | 0) + 2000; m._smithPillarsAt = 0; m.currentHp = m.maxHp; player.invulnerable = 0; fill(); });
    let hz = null;
    for (let i = 0; i < 60 && !hz; i++) { await sleep(50); hz = await page.evaluate(() => { const h = (game.hazards || []).filter((x) => x && x.type === 'meteor_warn' && x._pctCap && x.life > 20); if (!h.length) return null;
      const bm = game.monsters.find((x) => x.type === 'sundered_smith' && x.currentHp > 0); const bc = bm ? bm.x + bm.w / 2 : 0; const pk = h.slice().sort((p, q) => Math.abs(q.cx - bc) - Math.abs(p.cx - bc))[0];
      player.x = pk.cx - player.w / 2; player.vx = 0; player.blockTimer = 0; player.invulnerable = 0; window._r28c.fill(); window.__hl.ev = []; return pk._sourceLabel; }); }
    await sleep(2200);
    const ev = await page.evaluate(() => window.__hl.ev.filter((e) => /Forge Pillar|White-Hot Ruin/.test(e.src)));
    if (hz && ev.length) out.push({ label: hz, pct: Math.max(...ev.map((e) => e.pct)), alive: true });
    await sleep(900);
  }
  return out;
};
if (on('1')) {
  for (const [cls, lv] of [['archer', 45], ['mage', 50], ['warrior', 45]]) {
    const { ctx, page } = await boot(cls);
    await page.evaluate(async (lv) => { const R = window._r28c; R.hero(lv); await R.go('sundered_forge', 200); R.fill(); }, lv);
    const hits = await pillars(page, 7);
    const by = {}; for (const h of hits) (by[h.label] = by[h.label] || []).push(h.pct);
    const all = hits.map((h) => h.pct), mx = await page.evaluate(() => getMaxHp());
    console.log(`  ${cls} Lv ${lv} (${mx} HP): ` + JSON.stringify(by));
    if (cls === 'warrior') ok(`[1c] a Lv ${lv} warrior still feels every pillar: >= 15% of the bar`, all.length >= 3 && Math.min(...all) >= 15, by);
    else ok(`[1${cls === 'archer' ? 'a' : 'b'}] a Lv ${lv} ${cls} in T6 shop gear standing in a Forge Pillar / the White-Hot Ruin loses 30-85% of the bar (was 99.9% every time)`,
      all.length >= 3 && Math.max(...all) <= 85 && Math.min(...all) >= 30, by);
    await ctx.close();
  }
}
// [3] the miss rules: N real hitMonster basics against a type spawned as an Elder / as an ordinary mob, a hero of its level
const hitRate = (page, tp, mini, N) => page.evaluate(async ([tp, mini, N]) => { const R = window._r28c;
  game.monsters = []; game._lxRareSpawn = !mini;   // an ordinary spawn must not roll the 15% Elder promotion
  const m = spawnMonster(player.x + 300, player.y - 40, tp, false, mini); game._lxRareSpawn = false;
  if (!m || m._suppressed) return null; const L = _mobLevel(m); R.hero(L); await R.sleep(80);
  const skill = player.cls === 'archer' ? 'arrow' : player.cls === 'mage' ? 'bolt' : 'melee'; let hit = 0;
  for (let i = 0; i < N; i++) { m.currentHp = m.maxHp; m._dirGhostT = 0; m._dirGuardT = 0; game.comboMult = 1; game.combo = 0; const n0 = game.damageNumbers.length;
    hitMonster(m, 1000, false, skill); if (!game.damageNumbers.slice(n0).some((d) => d && d.text === 'MISS')) hit++; }
  const r = { lv: L, eva: m.evasion | 0, acc: Math.round(getAccuracy()), mini: !!m.isMiniBoss, hit: +(100 * hit / N).toFixed(1) }; game.monsters = []; return r; }, [tp, mini, N]);
if (on('3')) {
  const { ctx, page } = await boot('warrior');
  await page.evaluate(async () => { const R = window._r28c; R.hero(47); await R.go('forest', 300); game.monsters = []; player._god = true; });
  const A = await hitRate(page, 'vigil_vermillion', true, 500);
  console.log('  Elder Arlen as an Elder: ' + JSON.stringify(A));
  ok('[3a] Elder Arlen (isMiniBoss, Lv 47) at his own level: >= 38% of basics land (boss rules: no level-gap roll, 0.45 floor; was ~13%)', A && A.mini && A.hit >= 38 && A.hit <= 56, A);
  // real Z swings at him (he stands still: atk 0, his clocks parked). Each basic that reaches hitMonster is recorded with its own MISS / land
  // outcome (an HP drop alone would also count bleed / burn ticks, which never roll the miss)
  const Z = await page.evaluate(async () => { const R = window._r28c; game.monsters = []; const m = spawnMonster(player.x + 120, player.y - 40, 'vigil_vermillion', false, true); R.hero(47); player._god = true;
    m.atk = 0; m.speed = 0; m.shoot = null; await R.sleep(300); window.__arl = m; window.__zs = [];
    if (!window.__zsHook) { window.__zsHook = 1; const _hm = window.hitMonster; window.hitMonster = function (mm, d, c, sk) { const n0 = game.damageNumbers.length; const r = _hm.apply(this, arguments);
      try { if (mm === window.__arl && BASIC_HIT_SKILLS.has(sk)) window.__zs.push(game.damageNumbers.slice(n0).some((x) => x && x.text === 'MISS')); } catch (e) {} return r; }; }
    return !!m; });
  for (let k = 0; k < 60 && Z; k++) {
    await page.evaluate(() => { const m = window.__arl; m.currentHp = m.maxHp; m.vx = 0; m._dirGhostT = 0; const bx = _atkMonBox(m); player.x = bx.x - player.w - 6; player.y = bx.y + bx.h - player.h; player.vx = 0; player.vy = 0; player.facing = 1; game.paused = false; });
    await press(page, 'z', 80); await page.waitForTimeout(200);
    if (k > 20 && (await page.evaluate(() => window.__zs.length)) >= 30) break;
  }
  const zs = await page.evaluate(() => window.__zs.slice()); const swings = zs.length, misses = zs.filter(Boolean).length, hits = swings - misses;
  ok('[3b] real Z swings at Elder Arlen agree: >= 30% of the basics that reach him land (was ~13%)', swings >= 15 && hits / swings >= 0.30, { swings, hits, misses });
  const P = await hitRate(page, 'pathsBane', false, 500), G = await hitRate(page, 'graveReaver', false, 500);
  const want = (r) => 100 * Math.max(0.15, Math.min(1, 1 - (r.eva - r.acc) / 150));
  ok('[3c] an ordinary (unflagged) Path\'s Bane and Grave Reaver keep the old evasion roll (0.15 floor, no boss rules)', P && G && !P.mini && !G.mini && Math.abs(P.hit - want(P)) <= 7 && Math.abs(G.hit - want(G)) <= 7, { P, G, wantP: want(P).toFixed(1), wantG: want(G).toFixed(1) });
  await ctx.close();
}
// [4] walk into Sagitta (real ArrowRight) from 330 px out until her Point-Blank Volley lands; the step the hero first came within 200 px is
// logged per sim step; her rain / beam / arrows are parked and the hero's i-frames cleared until the draw starts (a touch or an arrow would
// otherwise swallow the volley's hit, which needs no i-frames). block=true presses A once she has started the draw (or, with no draw to see, when the hero is inside 200 px)
const volley = async (page, block) => {
  for (let att = 0; att < 6; att++) {
    await page.evaluate(() => { const R = window._r28c; const m = game.monsters.find((x) => x && x.zodiacBoss && x.currentHp > 0); if (!m) return;
      m.patternState = 'idle'; m.patternTimer = 0; m._sagKickAt = 0; m._sagKickWind = 0; m.vx = 0; m.currentHp = m.maxHp;
      player.x = m.x - 330 - player.w / 2 + m.w / 2; player.y = m.y + m.h - player.h; player.vx = 0; player.vy = 0; player.facing = 1; player.invulnerable = 0; player.blockTimer = 0;
      R.fill(); window.__hl.ev = []; window.__sagIn = null; window.__sagWind = null; window.__sagWK = 0;
      if (!window.__sagHook) { window.__sagHook = 1; const _up = window.updatePlayer; window.updatePlayer = function () { try { const b = game.monsters.find((x) => x && x.zodiacBoss && x.currentHp > 0);
        if (b) { const dx = (player.x + player.w / 2) - (b.x + b.w / 2); if (window.__sagIn == null && Math.abs(dx) < 200) window.__sagIn = game.time | 0;
          if (b._sagKickWind && b._sagKickWind !== window.__sagWK) { window.__sagWK = b._sagKickWind; window.__sagWind = game.time | 0; } } } catch (e) {} return _up.apply(this, arguments); }; } });
    await page.keyboard.down('ArrowRight'); let pressed = false, ev = null;
    for (let i = 0; i < 90 && !ev; i++) {
      await sleep(40);
      const s = await page.evaluate(() => { const b = game.monsters.find((x) => x && x.zodiacBoss && x.currentHp > 0);
        if (b) { if (b.patternState !== 'idle') { b.patternState = 'idle'; } b.patternTimer = 0; game.projectiles = (game.projectiles || []).filter((p) => p && p.owner !== 'enemy'); if (!(b._sagKickWind > 0)) player.invulnerable = 0; }
        return { wind: window.__sagWind != null, inn: window.__sagIn != null, ev: window.__hl.ev.find((e) => /Point-Blank/.test(e.src)) || null, dbg: b ? { d: Math.round(Math.abs((player.x + player.w / 2) - (b.x + b.w / 2))), w: b._sagKickWind | 0, at: b._sagKickAt | 0, t: game.time | 0, inv: player.invulnerable | 0, bt: Math.round(player.blockTimer || 0), ps: b.patternState, evs: window.__hl.ev.map((e) => e.src + ':' + e.pct).slice(-3) } : null }; }); if (process.env.DBG4 && i % 4 === 0) console.log('    dbg', block, att, i, JSON.stringify(s.dbg));
      if (block && !pressed && (s.wind || s.inn)) { pressed = true; await page.keyboard.press('a'); if (process.env.DBG4) console.log('    pressed A', JSON.stringify(s.dbg), JSON.stringify(await page.evaluate(() => ({ bt: player.blockTimer, t: game.time | 0, held: (typeof _lxPlayerHeld === 'function') && _lxPlayerHeld() })))); }
      if (block && pressed && (s.inn || s.wind)) await page.keyboard.up('ArrowRight');
      if (s.inn && !block) await page.keyboard.up('ArrowRight');
      ev = s.ev;
    }
    await page.keyboard.up('ArrowRight');
    const meta = await page.evaluate(() => ({ inT: window.__sagIn, windT: window.__sagWind, mx: getMaxHp() }));
    if (ev) return { ...ev, delay: ev.t - meta.windT, inDelay: ev.t - meta.inT, wind: meta.windT != null, mx: meta.mx, att };
    await sleep(1600);
  }
  return null;
};
if (on('4')) {
  const { ctx, page } = await boot('warrior');
  await page.evaluate(async () => { const R = window._r28c; R.hero(86); await R.go('zod_sagittarius', 300); R.fill(); });
  await page.waitForFunction(() => (game.monsters || []).some((m) => m && m.zodiacBoss && m.currentHp > 0), null, { timeout: 30000 }).catch(() => {});
  await sleep(1500); await page.evaluate(() => window._r28c.clear());
  const U = await volley(page, false);
  console.log('  unblocked volley: ' + JSON.stringify(U));
  ok('[4a] the Point-Blank Volley winds up: it lands >= 15 sim steps after the hero comes within 200 px (was the same tick)', U && U.delay >= 15 && U.wind, U && { delay: U.delay, wind: U.wind });
  ok('[4b] its number is the HP it took (_lxShownLost), and it is the zodiac anti-hug size (0.5-20% of a Lv 86 warrior\'s bar: 9% of max HP through Block / DR / DEF / the at-level punish)', U && U.nums.some((t) => t === '-' + U.loss) && U.pct >= 0.5 && U.pct <= 20, U && { loss: U.loss, nums: U.nums, pct: U.pct });
  await sleep(1800);
  const Bk = await volley(page, true);
  console.log('  blocked volley: ' + JSON.stringify(Bk));
  ok('[4c] Block (A, pressed when she starts to draw) cuts it to <= 45% of the unblocked loss (was ignored)', U && Bk && Bk.blk && Bk.loss <= U.loss * 0.45, { u: U && U.loss, b: Bk && Bk.loss, blk: Bk && Bk.blk });
  const src = await page.evaluate(async () => { const t = await (await fetch(location.pathname)).text(); const c = (a) => t.split(a).length - 1;
    return { sd: c('player.hp -= (player._god ? 0 : _sd);'), td: c('player.hp -= (player._god ? 0 : _td);'), kd: c('player.hp -= (player._god ? 0 : _kd);'), mk: c("_lxShownLost() + ' MARKED'"), cr: c("_lxShownLost() + ' CRUSH'") }; });
  ok('[4d] Sagitta\'s Marked Shot and Pisces\'s Tidal Crush take the same path (no direct player.hp -= left, numbers from _lxShownLost)', src.sd === 0 && src.td === 0 && src.kd === 0 && src.mk === 1 && src.cr === 1, src);
  await ctx.close();
}
// [5] Bravo, for a Lv 30 hero: N beside her, then the first-run loot card (Begin), then a friend's code (Join a friend's descent) - the whole
// walk once per screen size, each card opened fresh at that size. "seen" = the warning sits inside the text box's visible rows once typed.
const bravoText = async (page) => { await page.waitForFunction(() => { const d = document.getElementById('dialog'); return !d || !d.classList.contains('typing'); }, null, { timeout: 15000 }).catch(() => {}); await page.waitForTimeout(300); return page.evaluate(() => {
  const t = document.getElementById('dialog-text'), d = document.getElementById('dialog'), b = d && d.getBoundingClientRect(), w = t && t.querySelector('.lx-exp-bosswarn');
  const tb = t && t.getBoundingClientRect(), wb = w && w.getBoundingClientRect();
  return { text: t ? t.textContent.replace(/\s+/g, ' ') : '', opts: [...document.querySelectorAll('#dialog-options button')].map((x) => x.textContent.trim()),
    sc: t ? { st: Math.round(t.scrollTop), sh: t.scrollHeight, ch: t.clientHeight, tb: tb && Math.round(tb.bottom), wb: wb && Math.round(wb.bottom), ov: getComputedStyle(t).overflowY } : null, box: b ? { top: Math.round(b.top), bot: Math.round(b.bottom), h: innerHeight } : null, seen: !!(tb && wb && wb.top >= tb.top - 1 && wb.bottom <= tb.bottom + 1) }; }); };
const pick = async (page, re) => { const r = await page.evaluate((src) => { const rx = new RegExp(src); const b = [...document.querySelectorAll('#dialog-options button')].find((x) => rx.test(x.textContent)); return b ? __r(b) : null; }, re.source);
  if (!r) return false; await page.mouse.click(r.x, r.y); await page.waitForTimeout(700); return true; };
const talkBravo = async (page) => { for (let k = 0; k < 4; k++) { await press(page, 'n'); await page.waitForTimeout(900);
    if (await page.evaluate(() => [...document.querySelectorAll('#dialog-options button')].some((b) => /Begin Expedition|Join a friend|loot is removed/.test(b.textContent)))) return true; await page.evaluate(() => window._r28c.clear()); } return false; };
if (on('5')) {
  const { ctx, page } = await boot('warrior');
  const at = await page.evaluate(async () => { const R = window._r28c; R.hero(30);
    let map = null; for (const id in MAPS) if ((MAPS[id].npcs || []).some((n) => n && n.role === 'expedition')) { map = id; break; }
    if (!map) return null; await R.go(map, 300); const n = (game.npcs || []).find((x) => x && x.role === 'expedition'); if (!n) return null; window.__bravo = n;
    return { map, lv: player.level, gate: EXPEDITION_LEVEL_GATE, boss: _lxExpeditionMobLevel(player.level) + 10 }; });
  console.log('  Bravo: ' + JSON.stringify(at));
  const want = (t) => /The Arbiter and the Sovereign wait for you at Lv 60\. They will not go easy on you\./.test(t);
  const fits = (b) => !!(b && b.top >= 0 && b.bot <= b.h);
  for (const [W, H] of [[960, 560], [844, 390]]) {
    const sz = W + 'x' + H; await page.setViewportSize({ width: W, height: H }); await page.waitForTimeout(500);
    await page.evaluate(() => { const R = window._r28c; R.clear(); player._expLootAck = false; game._expInfo = null; const n = window.__bravo; player.x = n.x + (n.w || 40) / 2 - player.w / 2; player.y = n.y + (n.h || 60) - player.h; player.vx = 0; player.vy = 0; });
    await page.waitForTimeout(500); await talkBravo(page);
    const M = await bravoText(page); await shot(page, `r28c_expgate_${TAG}_main_${sz}.png`);
    ok(`[5a ${sz}] Lv 30: Bravo's card (N) names the tower bosses' level for this hero - Lv 60, the spawn's own formula - warns it will not be easy (in view once typed, card on screen); the gate stays Lv 30`,
      !!at && at.gate === 30 && at.boss === 60 && want(M.text) && M.seen && fits(M.box) && M.opts.some((o) => /Begin Expedition/.test(o)), { at, seen: M.seen, sc: M.sc, box: M.box, tail: M.text.slice(-160) });
    await pick(page, /Begin Expedition/);
    const A = await bravoText(page); await shot(page, `r28c_expgate_${TAG}_ack_${sz}.png`);
    ok(`[5b ${sz}] the first-run loot card (Begin) repeats it, in view`, want(A.text) && A.seen && fits(A.box) && /LOOT IN THE TOWER IS REMOVED/.test(A.text), { seen: A.seen, box: A.box, tail: A.text.slice(-160) });
    await page.evaluate(() => { player._expLootAck = true; game._expInfo = null; window._r28c.clear(); });
    await talkBravo(page); await pick(page, /Join a friend/); await page.waitForTimeout(600);
    const S = await page.evaluate(() => { const m = document.getElementById('exp-seed-modal'), c = m && m.firstElementChild, b = c && c.getBoundingClientRect(); return { open: !!m, text: m ? m.textContent.replace(/\s+/g, ' ') : '', box: b ? { top: Math.round(b.top), bot: Math.round(b.bottom), h: innerHeight } : null }; });
    await shot(page, `r28c_expgate_${TAG}_friend_${sz}.png`);
    ok(`[5c ${sz}] a friend's code card says it too, and fits`, S.open && want(S.text) && fits(S.box), { text: S.text.slice(0, 200), box: S.box });
    await press(page, 'Escape');
    const st = await page.evaluate(() => !!(game.expedition && game.expedition.active));
    ok(`[5d ${sz}] cancelling the code card starts no run`, !st, st);
  }
  await ctx.close();
}
// [2] + [6] the boss doors: every arena's recommended level, then the Singularity's card at Lv 70 and Lv 105, the Smith's at Lv 45
const REC = { slimeCave: 9, confusedVigil: 40, octopusGrotto: 50, sundered_forge: 45, lastStep: 50, krookThrone: 40, innerDimension: 20, sanctum: 60, gravitosArena: 90, boss: 10, blockland_apex: 55,
  zod_aries: 70, zod_taurus: 72, zod_gemini: 74, zod_cancer: 76, zod_leo: 78, zod_virgo: 80, zod_libra: 82, zod_scorpio: 84, zod_sagittarius: 86, zod_capricorn: 88, zod_aquarius: 90, zod_pisces: 92, tower_b5: 30, tower_b10: 30 };
const door = async (page, from, dest, lv) => {
  await page.evaluate(async ([from, lv]) => { const R = window._r28c; devSetLevel(lv); await R.go(from, 300); game.monsters = []; }, [from, lv]);
  const at = await page.evaluate((dest) => { const p = (game.portals || []).find((q) => q && q.dest === dest); if (!p) return null;
    player.x = p.x + (p.w || 40) / 2 - player.w / 2; player.y = (p.y || 300) - player.h; player.vx = 0; player.vy = 0; return { x: p.x, y: p.y }; }, dest);
  if (!at) return { at: null };
  await page.waitForTimeout(700); await press(page, 'ArrowUp', 140); await page.waitForTimeout(700);
  return page.evaluate(() => { const d = document.getElementById('dialog'), t = document.getElementById('dialog-text'), b = d && d.getBoundingClientRect();
    return { open: !!(d && d.style.display !== 'none' && d.getClientRects().length), text: t ? t.textContent : '', map: game.currentMap, tx: t ? { sh: t.scrollHeight, ch: t.clientHeight } : null, box: b ? { top: Math.round(b.top), bot: Math.round(b.bottom), h: innerHeight } : null }; });
};
if (on('2') || on('6')) {
  const { ctx, page } = await boot('warrior');
  await page.evaluate(() => window._r28c.hero(70));
  if (on('2')) {
    const got = await page.evaluate((ids) => { const o = {}; for (const id of ids) o[id] = MAPS[id] ? _lxArenaRecLevel(MAPS[id]) : null; return o; }, Object.keys(REC));
    const diff = Object.keys(REC).filter((k) => got[k] !== REC[k]).map((k) => k + ' ' + got[k] + ' (want ' + REC[k] + ')');
    ok('[2a] the Singularity\'s door recommends Lv 90 (Gravitos Lv 100, q_boss_gravitos Lv 90; was 70)', got.gravitosArena === 90, got.gravitosArena);
    ok('[2b] every other arena keeps its recommended level (Krook 40, Gelwater 9, the twelve stars 70-92, ...)', diff.filter((d) => !/^gravitosArena/.test(d)).length === 0, diff);
  }
  if (on('6')) {
    const D70 = await door(page, 'weightbearerStair', 'gravitosArena', 70);
    await shot(page, `r28c_arena_${TAG}_960x560.png`);
    await page.setViewportSize({ width: 844, height: 390 }); await page.waitForTimeout(500); await page.evaluate(() => window._r28c.clear());
    const D70s = await door(page, 'weightbearerStair', 'gravitosArena', 70);
    await shot(page, `r28c_arena_${TAG}_844x390.png`);
    await page.setViewportSize({ width: 960, height: 560 }); await page.waitForTimeout(400);
    console.log('  Singularity card at Lv 70: ' + JSON.stringify(D70.text));
    ok('[6a] at Lv 70 the Singularity\'s card (Up at its door) names Gravitos\'s level beside the hero\'s and says it will not be easy', D70.open && /Recommended level: 90\+/.test(D70.text) && /Lv 100 Gravitos · you're Lv 70 - this will not be easy\./.test(D70.text), D70);
    const fitsAll = (D) => !!(D && D.open && D.box && D.box.top >= 0 && D.box.bot <= D.box.h && D.tx && D.tx.sh <= D.tx.ch + 2);
    ok('[6b] the card (opened at each size) fits the screen at 960x560 and 844x390 with its warning line in view (nothing scrolled under the text box)', fitsAll(D70) && fitsAll(D70s) && /this will not be easy/.test(D70s.text), { big: [D70.box, D70.tx], small: [D70s.box, D70s.tx] });
    const D99 = await door(page, 'weightbearerStair', 'gravitosArena', 99);
    ok('[6c] over the recommended level but under the boss\'s (Lv 99 at Gravitos\'s door) it still warns, softer', D99.open && /Lv 100 Gravitos \u00b7 you're Lv 99 - still a hard fight\./.test(D99.text), D99.text);
    const D60 = await door(page, 'confusedVigil', 'sundered_forge', 60);
    ok('[6e] over the boss\'s level (Lv 60 at the Smith\'s door, he is Lv 48) the card reads the two levels, calmly (no warning)', D60.open && /Lv 48 The Sundered Smith \u00b7 you're Lv 60\./.test(D60.text) && !/not be easy|hard fight/.test(D60.text), D60.text);
    const D45 = await door(page, 'confusedVigil', 'sundered_forge', 45);
    ok('[6d] the Sundered Smith\'s card at Lv 45 (his door\'s level; he is Lv 48) warns too', D45.open && /Lv 48 The Sundered Smith · you're Lv 45 - this will not be easy\./.test(D45.text), D45.text);
  }
  await ctx.close();
}
} finally {
  await browser.close().catch(() => {});
  try { server.kill(); } catch (e) {}
}
if (errs.length) console.log('page errors: ' + JSON.stringify([...new Set(errs)].slice(0, 6)));
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
