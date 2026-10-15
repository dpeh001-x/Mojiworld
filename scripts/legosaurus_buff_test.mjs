// LEGOSAURUS, A LEVEL-70 THREAT (per user: "buff up legosaurus way more to be a tougher level 70 boss, let it occasionally deal near
// fatal damage especially on charging" + "Do not need to change his level, just bump his stats to reach level 70 standards").
// Drives the live boss in Block-land Apex against a geared Lv 59 rogue (32k HP / 831 DEF pinned - the build whose clips showed boss
// hits landing ~2% before the boss floors), one attack at a time with every other cooldown held off:
//   1. his row is the Lv-70 standard (zodiac_aries's HP / ATK / DEF) while his level stays 59
//   2. every hit lands at least a quarter of max HP: touch (his swing lands as one - his attack-pose body reaches past the swing's
//      262 px), column, fire spit, quake (they landed 2-4% before)
//   3. the brick-crusher: a column that rolls it lands 80% of max HP
//   4. the CRUSHING charge: a red lane and a warning at the brace; a connect from full HP leaves exactly 5% - near fatal, not fatal -
//      and from under that, 1 HP; an ordinary charge still gores through its old path
//   node scripts/legosaurus_buff_test.mjs [file.html] [port]
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);
const { chromium } = require('playwright-core');
const PAGE = process.argv[2] || process.env.MOJI_GAME_FILE || 'mojiworld_game.html';
const PORT = Number(process.argv[3] || 9819);
const HP = 32000, DEF = 831;
const server = spawn(process.execPath, [path.join(ROOT, 'serve.js'), String(PORT)], { stdio: 'ignore' });
await new Promise((r) => setTimeout(r, 1200));
const browser = await chromium.launch({ channel: 'msedge', headless: true, args: ['--no-sandbox', '--mute-audio'] });
const results = []; const ok = (n, c, x) => results.push({ n, pass: !!c, x });
try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  const errs = []; page.on('pageerror', (e) => errs.push(String(e.message).slice(0, 140)));
  await page.addInitScript(() => { try { localStorage.setItem('mojiworld_prologue_seen', '1'); } catch (e) {} });
  await page.goto(`http://localhost:${PORT}/${PAGE}`, { waitUntil: 'load', timeout: 90000 });
  await page.waitForTimeout(9000);
  await page.evaluate(() => { const lo = document.getElementById('loading-overlay'); if (lo) lo.classList.add('fade'); });
  await page.fill('#hero-name-input', 'Brick');
  await page.evaluate(() => { const m = document.getElementById('class-select-modal'); for (const el of m.querySelectorAll('button,div,li')) { if (el.children.length > 3) continue; if (getComputedStyle(el).display === 'none') continue; if (/rogue/i.test(el.textContent || '')) { el.click(); break; } } });
  await page.click('#cs-nav-next').catch(() => {});
  await page.waitForTimeout(2500);
  await page.evaluate(() => { player._storyBeatsSeen = player._storyBeatsSeen || {}; if (typeof STORY_BEATS === 'object') for (const k in STORY_BEATS) player._storyBeatsSeen[k] = true; player.level = 59; loadMap('blockland_apex', 300); });
  await page.waitForTimeout(9000);
  const R = await page.evaluate(async ({ HP, DEF }) => {
    const sleep = (ms) => new Promise((z) => setTimeout(z, ms));
    const frames = async (n) => { const t0 = game.time; const d = Date.now() + 30000; while (game.time - t0 < n && Date.now() < d) await sleep(4); };
    for (const id of ['story-beat-overlay', 'boss-intro', 'boss-intro-card']) { const e = document.getElementById(id); if (e) { e.classList.remove('on'); e.style.display = 'none'; } }
    try { _dismissBossIntro(); } catch (e) {}
    game.paused = false;
    let m = null; for (let i = 0; i < 600 && !m; i++) { m = game.monsters.find((x) => x && x.type === 'legosaurus' && x.currentHp > 0); if (!m) await frames(1); }
    if (!m) return { err: 'no legosaurus (' + game.currentMap + ')' };
    const row = LX_MONSTER_STATS.legosaurus, out = { row: { lv: row.lv, hp: row.hp, atk: row.atk, def: row.def }, lv: _mobLevel(m), atk: m.atk };
    window.getMaxHp = () => HP; window.getDef = () => DEF; player.maxHp = HP; player.hp = HP; player.level = 59;
    player._god = false; player.blockTimer = 0; player._aegis = false;
    const bd = m.traits.braceDash, bm = m.traits.bigMelee, cs = m.traits.columnStrike;
    // every cooldown but the one under test is held off EVERY frame (the AI re-arms its own timers mid-run)
    const HOLD = (keep) => { if (keep !== 'swing') m._bigMeleeCd = 1e9; if (keep !== 'column') m._columnCd = 1e9; if (keep !== 'spit') { m.shootTimer = 1e9; m._shootWindupT = 0; } if (keep !== 'charge') m._bdCd = 1e9; if (keep !== 'quake') m._legosaurusQuakeAt = game.time + 1e6; };
    const gy = (game.mapData.platforms.find((p) => p && p.type === 'ground') || { y: game.mapData.worldHeight - 60 }).y;
    const stand = (wx) => { player.x = Math.max(20, Math.min(game.mapData.worldWidth - 60, wx)); player.y = gy - player.h; player.vx = 0; player.vy = 0; };
    // one attack: park far off (clears i-frames), stand where it lands - OUTSIDE his body unless touch is the test (a touch's
    // i-frames would swallow the hit under test) - fire it, read every frame's HP loss (topped back up) with its source
    const run = async (key, dx, fire, ms, hpAt, iframes) => {
      game.projectiles = (game.projectiles || []).filter((p) => p && p.owner !== 'enemy');   // no shot still in flight from the last run
      HOLD(); m.currentHp = m.maxHp * 0.9; const mx = game.mapData.worldWidth / 2 - m.w / 2; m.x = mx; m.vx = 0;
      for (let i = 0; i < 50; i++) { HOLD(); m.x = mx; m.vx = 0; stand(game.mapData.worldWidth / 2 + 950); player.hp = HP; await frames(1); }   // he stays put while the hero parks
      m.x = mx; const wx = mx + m.w / 2 + dx - player.w / 2; player.invulnerable = 0;
      const hits = [], toasts = []; const _st = window.showToast; window.showToast = function (t) { toasts.push(String(t)); return _st.apply(this, arguments); };
      let zone = null; const swings = new Set();
      let touched = false; const _cl = window._lxContactLanding; window._lxContactLanding = function () { touched = true; return _cl.apply(this, arguments); };   // a TOUCH is what lands through here
      try {
        fire();
        for (let i = 0; i < Math.round(ms / 16.7); i++) {
          HOLD(key);
          if (key !== 'charge') { m.x = mx; m.vx = 0; }   // no creep into the hero (stickMul) while a non-charge attack is measured
          if (iframes) player.invulnerable = 1500;   // contact respects i-frames, the charge does not (by design): the crush alone is measured
          for (const p of (game.projectiles || [])) if (p && p.skill === 'swing' && p.owner === 'enemy') swings.add(p);
          stand(wx); const h0 = (hpAt != null) ? hpAt : HP; player.hp = h0; player._lastDamageSource = ''; player._radianceHit = null; touched = false; game.paused = false;
          await frames(1);
          if (!zone && m._braceDashing && m._bdPhase === 'brace' && typeof _lxAttackZones === 'function') { try { zone = (_lxAttackZones() || []).find((z) => z && z.kind === 'dash') || null; } catch (e) {} }
          if (player.hp < h0) hits.push({ pct: +(100 * (h0 - player.hp) / HP).toFixed(2), left: +(100 * player.hp / HP).toFixed(2), src: touched ? 'touch' : (player._radianceHit || player._lastDamageSource || '') });
          if (hpAt != null && player.hp < h0) break;
        }
      } finally { window.showToast = _st; window._lxContactLanding = _cl; }
      const body = hits.filter((h) => h.src === 'touch'), rest = hits.filter((h) => h.src !== 'touch');
      return { hits, touchMax: body.reduce((a, h) => Math.max(a, h.pct), 0), max: rest.reduce((a, h) => Math.max(a, h.pct), 0), toasts, zone: zone ? [zone.color, zone.hot ? 'hot' : 'cold', zone.tg].join('|') : null, crush: !!m._bdCrush,   /* v0.30.1771 krook-march: the colour never drew - hot + art do */ swings: swings.size, swingLabel: [...swings].map((p) => p._sourceLabel)[0] || null };
    };
    // just clear of what TOUCHES (his authored box + silhouette, _mobTouchBox - wider than m.w), and inside his 262 px swing reach
    m.x = game.mapData.worldWidth / 2 - m.w / 2;
    const _tb = (typeof _mobTouchBox === 'function') ? _mobTouchBox(m) : { x: m.x, w: m.w };
    const OUT = Math.min((bm.range || 262) - 4, (_tb.x + _tb.w) - (m.x + m.w / 2) + player.w / 2 + 6);
    out.reach = { out: Math.round(OUT), touchRight: Math.round((_tb.x + _tb.w) - (m.x + m.w / 2)), range: bm.range };
    const rad = cs.radiance, crush = bd.crush, rc = rad && rad.chance, cc = crush && crush.chance;
    try {
      if (rad) rad.chance = 0;
      if (crush) crush.chance = 0;
      out.touch = await run('touch', 0, () => {}, 1400);
      out.column = await run('column', 420, () => { m._columnCd = 0; }, 2600);
      out.spit = await run('spit', 520, () => { m.shootTimer = 0; }, 4000);
      out.quake = await run('quake', 245, () => { m._legosaurusQuakeAt = game.time; }, 2600);   // clear of his idle body (212), inside the 280 px band
      out.gore = await run('charge', 420, () => { m._bdCd = 0; }, 2600);
      if (rad) rad.chance = 1;
      out.crusher = await run('column', 420, () => { m._columnCd = 0; }, 2600);
      if (rad) rad.chance = 0;
      if (crush) crush.chance = 1;
      out.crush = await run('charge', 420, () => { m._bdCd = 0; }, 2600);
      out.crushLow = await run('charge', 420, () => { m._bdCd = 0; }, 2600, Math.floor(HP * 0.03), true);
    } finally { if (rad) rad.chance = rc; if (crush) crush.chance = cc; }
    out.cfg = { rad: rad ? { chance: rc, frac: rad.frac, flat: rad.flat } : null, crush: crush ? { chance: cc, leave: crush.leave } : null, floor: LX_BOSS_HIT_FLOOR.legosaurus, bm: bm.floorPct, cs: cs.floorPct };
    return out;
  }, { HP, DEF });
  if (R.reach) console.log('REACH ' + JSON.stringify(R.reach));
  if (R.err) ok('the fight ran', false, R.err);
  else {
    ok('his row is the Lv-70 standard - zodiac_aries\'s HP / ATK / DEF (8,931,450 / 13,342 / 918) - and his level stays 59',
      R.row.hp === 8931450 && R.row.atk === 13342 && R.row.def === 918 && R.row.lv === 59 && R.lv === 59, { row: R.row, lv: R.lv, atk: R.atk });
    ok('his touch lands at least a quarter of max HP on a geared Lv 59 hero (it landed 2.3%)', R.touch.touchMax >= 24.9, R.touch);
    for (const k of ['column', 'spit', 'quake'])
      ok(`his ${k} lands at least a quarter of max HP on a geared Lv 59 hero (it landed 2-4%)`, R[k].max >= 24.9, R[k]);
    ok('the brick-crusher: a column that rolls it lands 80% of max HP', R.crusher.hits.some((h) => /brick-crusher/i.test(h.src) && Math.abs(h.pct - 80) < 0.6), R.crusher);
    ok('the trait odds: one column in five may crush, about one charge in three is a crushing charge', R.cfg.rad && R.cfg.rad.chance === 0.2 && R.cfg.rad.flat === true && R.cfg.crush && R.cfg.crush.chance === 0.35 && R.cfg.crush.leave === 0.05, R.cfg);
    // v0.30.1771 krook-march: zones paint only their art, so the v0.30.1738 "red lane" never showed - a crushing charge's lane now BLAZES (hot), on his own lane art
    ok('a crushing charge is told: a warning at the brace and a blazing lane on his own lane art', R.crush.toasts.some((t) => /CRUSHING CHARGE/.test(t)) && R.crush.zone === '#ff3322|hot|tg_dash_legosaurus', { toasts: R.crush.toasts, zone: R.crush.zone });
    const cr = R.crush.hits.find((h) => /crushing/i.test(h.src));
    ok('a crushing charge from full HP leaves exactly 5% - near fatal, not fatal', !!cr && Math.abs(cr.left - 5) < 0.2, R.crush);
    const low = R.crushLow.hits.find((h) => /crushing/i.test(h.src));
    ok('...and from under 5% it leaves 1 HP, never a kill by itself', !!low && Math.abs(low.left - 100 / HP) < 0.01, R.crushLow);
    ok('an ordinary charge still gores (the old 50% path, no crush)', !R.gore.crush && R.gore.hits.some((h) => /goring/i.test(h.src)) && R.gore.toasts.every((t) => !/CRUSH/.test(t)), R.gore);
    ok('an ordinary charge draws his lane art without the blaze (per user: "redesign some of the other boss charge")', !!R.gore.zone && /\|cold\|tg_dash_legosaurus$/.test(R.gore.zone), { zone: R.gore.zone });
  }
  ok('no page errors', errs.length === 0, errs);
} finally { await browser.close(); server.kill(); }
let pass = 0;
console.log('\n=== LEGOSAURUS BUFF ===');
for (const t of results) { if (t.pass) pass++; console.log(`${t.pass ? 'PASS' : 'FAIL'}  ${t.n}  ${t.pass ? '' : String(JSON.stringify(t.x)).slice(0, 500)}`); }
console.log(`\n${pass}/${results.length} checks passed`);
process.exit(pass === results.length ? 0 : 1);
