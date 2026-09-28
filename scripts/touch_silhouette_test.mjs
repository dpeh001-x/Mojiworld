// Touching a monster's SILHOUETTE hurts, from any side (per user: touching the silhouette hitbox of a monster damages the
// player regardless of where the monster or boss is facing). The touch box is the authored box united with the silhouette
// box - the region the player's attacks hit, the orange box the animator draws - for every monster and boss (it was fliers
// only), and a normal monster's touch no longer needs it to face you (its proximity SWING still does).
// One monster step (updateMonsters) per placement, the player placed against a held monster:
//   - from behind, on its authored box: hurts (the previous build: no, for normal monsters)
//   - on the silhouette only (its drawn head above the authored box), facing you or away: hurts (previous build: no)
//   - a box the editor shifts with the facing (the Tower Sovereign) is followed as the boss turns
//   - clear of both boxes: never; a small boss's arrow lift (air above its head) is in its attack box, not its touch box
//   node scripts/touch_silhouette_test.mjs [page.html] [port]
import { createRequire } from 'node:module'; import path from 'node:path';
import { fileURLToPath } from 'node:url'; import { spawn } from 'node:child_process';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const { chromium } = createRequire(import.meta.url)('playwright-core');
const args = process.argv.slice(2).filter((a) => !a.startsWith('--'));
const FILE = (args[0] && /\.html$/i.test(args[0])) ? args[0] : 'mojiworld_game.html';
const PORT = Number(args.find((a) => /^\d+$/.test(a)) || process.env.PORT || 11813);
let bad = 0, total = 0; const check = (ok, label, d) => { total++; console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}${d !== undefined ? '  ' + JSON.stringify(d) : ''}`); if (!ok) bad++; };
const env = { ...process.env }; if (FILE !== 'mojiworld_game.html') env.MOJI_GAME_FILE = FILE; else delete env.MOJI_GAME_FILE;
const server = spawn(process.execPath, [path.join(ROOT, 'serve.js'), String(PORT)], { stdio: 'ignore', cwd: ROOT, env });
await new Promise((r) => setTimeout(r, 1500));
const browser = await chromium.launch({ channel: 'chrome', headless: true, args: ['--mute-audio'] });
try {
  const page = await (await browser.newContext({ serviceWorkers: 'block', viewport: { width: 1280, height: 720 } })).newPage();
  const errs = []; page.on('pageerror', (e) => errs.push(String(e).slice(0, 200)));
  await page.addInitScript(() => { try { localStorage.setItem('mojiworld_prologue_seen', '1'); } catch (e) {} });
  await page.goto(`http://localhost:${PORT}/mojiworld_game.html?dev=1`, { waitUntil: 'domcontentloaded', timeout: 180000 });
  await page.waitForFunction(() => typeof loadMap === 'function' && typeof updateMonsters === 'function' && typeof _mobTouchBox === 'function', null, { timeout: 180000 });
  await page.waitForTimeout(3000);
  const R = await page.evaluate(async () => {
    const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
    for (const id of ['loading-overlay', 'lo-auth', 'class-select-modal', 'lo-menu']) { const e = document.getElementById(id); if (e) { e.style.display = 'none'; e.classList.add('fade'); } }
    window._lxBootGateDone = true; window._prologueActive = false; player.cls = 'mage'; player.level = 60; player._storyBeatsSeen = new Proxy({}, { get: () => true });
    player._gravitosCineSeen = true; loadMap('stardustAtrium'); await sleep(3500);
    const hold = () => { game.paused = true; game.hitStop = 1e9; }; hold(); window.__tsHold = setInterval(hold, 1);
    const GY = 480; game.camera.x = 300; game.camera.y = 0;
    const mk = async (type) => {
      game.monsters.length = 0; const d = monsterTypes[type] || {};
      const m = spawnMonster(900, GY - 200, type, !!d.boss, false) || game.monsters[game.monsters.length - 1];
      m.x = 900; m.y = (m.flies ? GY - 160 - m.h : GY - m.h); m.vx = 0; m.vy = 0; m.onGround = !m.flies;
      for (let i = 0; i < 80 && !(m._visW > 0); i++) { try { ctx.save(); drawMonster(m); ctx.restore(); } catch (e) {} if (!(m._visW > 0)) await sleep(40); }
      return m; };
    const hpKey = ('hp' in player) ? 'hp' : 'currentHp', oEv = window.getEvasion; window.getEvasion = () => 0;
    // one monster step with the player at (px, py) and the monster facing `facing`; did a touch land?
    const step = (m, px, py, facing) => {
      m._facingHoldT = 1e9; m.facing = facing; m.speed = 0; m.vx = 0; m.vy = 0; const mx = m.x, my = m.y;
      m._swStrikeAt = 0; m._swHitDone = false; m.atkAnimUntil = 0;
      player.x = px; player.y = py; player.vx = 0; player.vy = 0; player.invulnerable = 0; player.parryWindow = 0; player._god = false;
      player.maxHp = Math.max(player.maxHp || 0, 1e7); player[hpKey] = player.maxHp; const hp0 = player[hpKey];
      game.paused = false; game.hitStop = 0;
      try { updateMonsters(16); } finally { game.paused = true; game.hitStop = 1e9; }
      const hit = player.invulnerable > 0 || player[hpKey] < hp0; m.x = mx; m.y = my; return hit; };
    const sil = (m, f) => { m.facing = f; const s = _atkMonBox(m, true); return { x: s.x, y: s.y, w: s.w, h: s.h }; };
    const out = { cases: {}, rule: [] }, pw = player.w, ph = player.h;
    for (const type of ['skeleton', 'elderbark', 'seraph', 'towerSovereign', 'kingKrook']) {
      const m = await mk(type), feet = m.y + m.h - ph, c = { drawn: m._visW > 0 };
      c.front = step(m, m.x - pw + 12, feet, -1);                          // left of it, on its authored box, it faces you
      c.behind = step(m, m.x - pw + 12, feet, 1);                          // the same spot, it faces away
      const s = sil(m, 1);
      c.headRoom = Math.round(m.y - s.y);
      if (c.headRoom >= 22) {                                               // on its drawn head only: above the authored box
        const py = Math.max(m.y - 10 - ph, s.y - ph + 10), px = m.x + m.w / 2 - pw / 2;
        c.headFacing = step(m, px, py, 1); c.headAway = step(m, px, py, -1); }
      c.clear = [step(m, Math.min(m.x, s.x) - pw - 30, feet, -1), step(m, Math.min(m.x, s.x) - pw - 30, feet, 1)];
      out.cases[type] = c;
    }
    // the Sovereign's silhouette box is shifted forward (an editor ox) - it follows the facing, and so does the touch
    { const m = await mk('towerSovereign'), feet = m.y + m.h - ph, R = sil(m, 1), L = sil(m, -1);
      const right = Math.round(R.x + R.w - (m.x + m.w)), left = Math.round(m.x - L.x), sv = { right, left };
      const atRight = m.x + m.w + 10, atLeft = m.x - 10 - pw;               // 10 px clear of the authored box, inside the overhang
      // the box itself, facing held (idle): it covers the overhang it faces and not the other side
      const on = (f, px) => { m.facing = f; m.atkAnimUntil = 0; return aabb({ x: px, y: feet, w: pw, h: ph }, _mobTouchBox(m)); };
      sv.box = { faceR: { right: on(1, atRight), left: on(1, atLeft) }, faceL: { right: on(-1, atRight), left: on(-1, atLeft) } };
      // end to end (the AI may turn it toward you or start a swing inside the step - the touch follows whatever it draws)
      sv.faceR = { right: step(m, atRight, feet, 1), left: step(m, atLeft, feet, 1) };
      sv.faceL = { right: step(m, atRight, feet, -1), left: step(m, atLeft, feet, -1) };
      out.sov = sv; }
    // a small boss: its attack box carries a 24 px arrow lift above its head; its touch box does not
    { const m = await mk('mirrorSelf'), a = _atkMonBox(m), t = _atkMonBox(m, true), tb = _mobTouchBox(m);
      const px = m.x + m.w / 2 - pw / 2, py = Math.round(Math.min(tb.y, m.y) - ph - 0.5 * (t.y - a.y));   // feet inside the lift band, 12 px clear of the body
      // geometry, not a step: Mirror Self casts your own skills back at you, so "any damage" cannot isolate a touch here
      const pb = { x: px, y: py, w: pw, h: ph };
      out.small = { h: m.h, isBoss: !!m.isBoss, lift: Math.round(t.y - a.y), tbTop: Math.round(tb.y), atkTop: Math.round(a.y), feet: py + ph,
        liftInAtk: aabb(pb, a), liftTouches: aabb(pb, tb), bodyTouches: aabb({ x: px, y: tb.y + 12 - ph, w: pw, h: ph }, tb) }; }
    // the rule itself, every drawn type: touch box = authored box + silhouette box
    for (const type of Object.keys(monsterTypes)) {
      if (/^zodiac_/.test(type)) continue;
      let m; try { m = await mk(type); } catch (e) { continue; } if (!m || !(m._visW > 0)) continue;
      const s = _atkMonBox(m, true), tb = _mobTouchBox(m), x0 = Math.min(m.x, s.x), y0 = Math.min(m.y, s.y);
      const ok = Math.abs(tb.x - x0) < 0.5 && Math.abs(tb.y - y0) < 0.5 && Math.abs(tb.x + tb.w - Math.max(m.x + m.w, s.x + s.w)) < 0.5 && Math.abs(tb.y + tb.h - Math.max(m.y + m.h, s.y + s.h)) < 0.5;
      out.rule.push({ type, ok, boss: !!(m.isBoss || m.boss), fly: _lxMobIsFloating(m) });
    }
    window.getEvasion = oEv; clearInterval(window.__tsHold); game.monsters.length = 0; return out;
  });
  const C = R.cases, nm = { skeleton: 'a skeleton', elderbark: 'an Elderbark', seraph: 'a seraph (flier)', towerSovereign: 'the Tower Sovereign', kingKrook: 'King Krook' };
  for (const [t, c] of Object.entries(C)) {
    check(c.drawn && c.front === true, `${nm[t]}: touching it from the front hurts`, c);
    check(c.behind === true, `${nm[t]}: touching it from BEHIND hurts too`, c);
    if (c.headRoom >= 22) check(c.headFacing === true && c.headAway === true, `${nm[t]}: touching only its drawn head (${c.headRoom} px above its old box) hurts, facing you or away`, c);
    check(c.clear.every((x) => x === false), `${nm[t]}: standing clear of it never hurts`, c.clear);
  }
  check(['elderbark', 'towerSovereign'].every((t) => C[t] && C[t].headRoom >= 22), 'the head cases ran (Elderbark and the Sovereign draw a head above their old box)', { elderbark: C.elderbark && C.elderbark.headRoom, sov: C.towerSovereign && C.towerSovereign.headRoom });
  const S = R.sov;
  check(S.right >= 20 && S.left >= 20, `the Sovereign's silhouette box sticks out ${S.right} px ahead when it faces right, ${S.left} px when it faces left`, S);
  check(S.faceR.right === true && S.faceL.left === true, 'standing in the side it sticks out on hurts, whichever way it faces', S);
  check(S.box.faceR.right && !S.box.faceR.left && S.box.faceL.left && !S.box.faceL.right, 'its touch box follows the turn: it covers the side it faces, not the side behind it', S.box);
  const M = R.small;
  check(M.isBoss && M.h <= 64 && M.lift === 24, `Mirror Self (a small boss): its attack box has the 24 px arrow lift, its touch box not (lift ${M.lift})`, M);
  check(M.liftInAtk === true && M.liftTouches === false && M.bodyTouches === true, 'a player in the lift band is inside its attack box but not its touch box; on its body, inside the touch box', M);
  const bad_ = R.rule.filter((r) => !r.ok);
  check(R.rule.length >= 100 && bad_.length === 0, `every drawn type's touch box is its authored box + its silhouette box (${R.rule.length} types: ${R.rule.filter((r) => r.boss).length} bosses, ${R.rule.filter((r) => r.fly).length} fliers)`, bad_.slice(0, 6));
  check(errs.length === 0, 'no page errors', errs.slice(0, 3));
} finally { await browser.close(); server.kill(); }
console.log(`\n${total - bad}/${total} checks passed`); process.exit(bad ? 1 : 0);
