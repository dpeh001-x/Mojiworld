// boonfx8: the eight boons that had no effect art (Storm Chain, Frostbite, Burning Touch, Thorns, Lifesteal, Quickening, Hyper
// Teleport, Diagonal Slash) each play their sprite at their moment - in the running game, through the real code paths:
//   - Storm Chain: hitMonster with the chain proc pinned -> a chain_bolt burst centred between the two foes, turned toward the second
//     and sized so the art spans the gap (size = d x 1024 / 978 / 2); the five-dot particle line is not drawn
//   - Frostbite / Burning Touch: the freeze / burn taking hold -> frost_lock / burn_ignite once; not again on a foe already frozen or
//     burning; no frost_lock on a boss (freeze-immune)
//   - Thorns: a real contact hit on the player with thorns -> thorn_burst on the attacker
//   - Lifesteal: a healing hit -> drain_wisp riding the player; a second within 30 frames plays nothing
//   - Quickening: castSkill with the refund pinned -> quicken_burst; Hyper Teleport: _dashBoonBegin -> blink_warp now and again on landing
//   - Diagonal Slash: a basic performMelee -> diag_slash across the widened box, flipped when facing left
//   - ART: the eight files decode; chain_bolt is 1024x512, the rest 768x768
//   node scripts/boon_fx8_test.mjs   (PORT / MOJI_SERVE_ROOT / MOJI_GAME_FILE override the served tree)
import { createRequire } from 'node:module'; import path from 'node:path'; import { fileURLToPath } from 'node:url'; import { spawn } from 'node:child_process';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'); const require = createRequire(import.meta.url);
const { chromium } = require('playwright-core');
const PORT = Number(process.env.PORT || 10241); const SERVE_ROOT = process.env.MOJI_SERVE_ROOT || ROOT;
let pass = 0, fail = 0; const ok = (n, c, x) => { if (c) pass++; else fail++; console.log((c ? 'PASS ' : 'FAIL ') + n + (x ? '  [' + x + ']' : '')); };
const server = spawn(process.execPath, [path.join(SERVE_ROOT, 'serve.js'), String(PORT)], { stdio: 'ignore', cwd: SERVE_ROOT }); await new Promise((r) => setTimeout(r, 1200));
const browser = await chromium.launch({ channel: 'chrome', headless: true, args: ['--mute-audio'] }); const page = await browser.newPage();
const errs = []; page.on('pageerror', (e) => errs.push(String(e.message).slice(0, 120)));
await page.addInitScript(() => { try { localStorage.setItem('mojiworld_prologue_seen', '1'); } catch (e) {} });
try {
  await page.goto(`http://localhost:${PORT}/${process.env.MOJI_GAME_FILE || 'mojiworld_game.html'}?dev=1`, { waitUntil: 'domcontentloaded', timeout: 180000 });
  await page.waitForFunction(() => typeof hitMonster === 'function' && typeof LX_FX === 'object', null, { timeout: 180000 }); await page.waitForTimeout(4000);
  const R = await page.evaluate(async () => {
    for (const id of ['loading-overlay', 'lo-auth', 'class-select-modal', 'lo-menu']) { const o = document.getElementById(id); if (o) o.style.display = 'none'; }
    window._lxBootGateDone = true; window._prologueActive = false; player._storyBeatsSeen = new Proxy({}, { get: () => true });
    loadMap('forest', 300); await new Promise((r) => setTimeout(r, 600));
    const keys = ['chain_bolt', 'frost_lock', 'burn_ignite', 'thorn_burst', 'drain_wisp', 'quicken_burst', 'blink_warp', 'diag_slash'];
    const t0 = performance.now(); while (typeof _lxBoonFx === 'function' && performance.now() - t0 < 30000 && !keys.every((k) => LX_FX[k] && LX_FX[k].complete && LX_FX[k].naturalWidth > 0)) await new Promise((r) => setTimeout(r, 200));
    const out = { art: Object.fromEntries(keys.map((k) => [k, LX_FX[k] && LX_FX[k].naturalWidth ? LX_FX[k].naturalWidth + 'x' + LX_FX[k].naturalHeight : 'missing'])) };
    const hold = () => { game.paused = true; game.hitStop = 1e9; }; hold(); const _iv = setInterval(hold, 1);
    const fx = (k) => (game.smoothFx || []).filter((f) => f && f.type === 'spriteBurst' && f.spriteKey === k);
    const clear = () => { game.smoothFx = []; game.particles = []; };
    const _rnd = Math.random; const pin = (v) => { Math.random = () => v; };
    const groundY = player.y + player.h; const mob = Object.keys(monsterTypes).find((t) => !monsterTypes[t].boss && !monsterTypes[t].isBoss && /slime/i.test(t)) || 'slime';
    const spawn = (x, boss) => { const m = spawnMonster(x, groundY - 60, boss ? 'king' : mob, !!boss); m.x = x; m.y = groundY - m.h; m.currentHp = m.maxHp = 9e8; return m; };
    const reset = () => { game.monsters.length = 0; clear(); for (const k of Object.keys(player.mods)) if (typeof player.mods[k] === 'number') player.mods[k] = 0; player.hp = player.maxHp = 9e6; player.invulnerable = 0; };
    try {
      // Storm Chain
      reset(); player.mods.chainChance = 1; pin(0.001);
      const a = spawn(player.x + 120), b = spawn(player.x + 300);
      hitMonster(a, 10, false, 'melee'); Math.random = _rnd;
      const cb = fx('chain_bolt')[0], ax = a.x + a.w / 2, ay = a.y + a.h / 2, bx = b.x + b.w / 2, by = b.y + b.h / 2, d = Math.hypot(bx - ax, by - ay);
      out.chain = { n: fx('chain_bolt').length, cx: cb && Math.round(cb.x - (ax + bx) / 2), ang: cb && +(cb.angle - Math.atan2(by - ay, bx - ax)).toFixed(3), size: cb && Math.round(cb.size), want: Math.round(d * 1024 / 978 / 2), dots: game.particles.filter((p) => p && p.color === '#ffff99').length };
      // Frostbite: once on a normal foe, not on a re-freeze, none on a boss
      reset(); player.mods.freezeChance = 1; pin(0.001);
      const f1 = spawn(player.x + 140); hitMonster(f1, 10, false, 'melee'); const fA = fx('frost_lock').length; hitMonster(f1, 10, false, 'melee'); const fB = fx('frost_lock').length;
      const fb = spawn(player.x + 400, true); clear(); hitMonster(fb, 10, false, 'melee'); Math.random = _rnd;
      out.freeze = { first: fA, again: fB - fA, boss: fx('frost_lock').length, frozen: f1.freezeTimer > 0 };
      // Burning Touch: once as it takes hold, not on a foe already burning
      reset(); player.mods.burn = 3; pin(0.001);
      const u1 = spawn(player.x + 140); hitMonster(u1, 50, false, 'melee'); const bA = fx('burn_ignite').length; hitMonster(u1, 50, false, 'melee'); Math.random = _rnd;
      out.burn = { first: bA, again: fx('burn_ignite').length - bA, burning: u1.burnTimer > 0 };
      // Lifesteal: a heal plays it once; a second heal inside 30 frames does not
      reset(); player.mods.lifesteal = 0.2; player.hp = player.maxHp - 1e5; player._lxLsFxAt = -999;
      const l1 = spawn(player.x + 140); pin(0.001); hitMonster(l1, 5000, false, 'melee'); const lA = fx('drain_wisp').length; hitMonster(l1, 5000, false, 'melee'); Math.random = _rnd;   // pinned: an unpinned roll can MISS, and a miss heals nothing
      const lw = fx('drain_wisp')[0]; out.lifesteal = { first: lA, again: fx('drain_wisp').length - lA, follows: !!(lw && lw.follow === player) };
      // Quickening
      reset(); player.cls = 'warrior'; player.mp = player.maxMp = 9999; player.skillCooldowns = player.skillCooldowns || {}; player.skillCooldowns.slash = 0; player.mods.cdrChance = 1; pin(0.001);
      try { castSkill('slash'); } catch (e) {} Math.random = _rnd;
      out.quicken = { n: fx('quicken_burst').length, cd: player.skillCooldowns.slash | 0 };
      // Hyper Teleport: now, and again on landing
      reset(); player.mods.dashBlink = 1; _dashBoonBegin(1); const hA = fx('blink_warp').length;
      clearInterval(_iv); game.paused = false; game.hitStop = 0; await new Promise((r) => setTimeout(r, 450)); hold(); const _iv2 = setInterval(hold, 1);
      out.blink = { start: hA, landed: fx('blink_warp').length - hA };
      // Diagonal Slash: across the widened box, mirrored when facing left
      reset(); player.mods.diagSlash = 0.5; player.facing = 1; performMelee(60, 1, { basic: true }); const dR = fx('diag_slash')[0];
      clear(); player.facing = -1; performMelee(60, 1, { basic: true }); const dL = fx('diag_slash')[0];
      clear(); player.mods.diagSlash = 0; performMelee(60, 1, { basic: true });
      out.diag = { right: !!dR && !dR.flipX, left: !!dL && dL.flipX === true, rightOfPlayer: dR && dR.x > player.x + player.w / 2, without: fx('diag_slash').length };
      clearInterval(_iv2);
      // Thorns: a real contact hit (monster AI + touch) with thorns on
      reset(); player.mods.thorns = 0.5; player.facing = 1; game.paused = false; game.hitStop = 0;
      const t1 = spawn(player.x + 4); t1.x = player.x; t1.attackCooldown = 0; let thorn = 0;
      for (let i = 0; i < 240 && !thorn; i++) { game.time++; player.invulnerable = 0; try { updateMonsters(16.667); } catch (e) {} t1.x = player.x; t1.y = player.y + player.h - t1.h; thorn = fx('thorn_burst').length; }
      out.thorns = { n: thorn, onAttacker: thorn ? Math.abs(fx('thorn_burst')[0].x - (t1.x + t1.w / 2)) < 60 : false };
    } finally { Math.random = _rnd; clearInterval(_iv); game.paused = false; game.hitStop = 0; }
    return out;
  });
  const A = R.art; ok('the eight effects decode at their canvases (chain_bolt 1024x512, the rest 768x768)', A.chain_bolt === '1024x512' && Object.entries(A).every(([k, v]) => k === 'chain_bolt' || v === '768x768'), JSON.stringify(A));
  const c = R.chain; ok('Storm Chain: one bolt between the two foes, turned toward the second, spanning the gap; no dot line', c.n === 1 && Math.abs(c.cx) <= 1 && Math.abs(c.ang) < 0.01 && Math.abs(c.size - c.want) <= 1 && c.dots === 0, JSON.stringify(c));
  const f = R.freeze; ok('Frostbite: frost_lock once as the freeze lands, not on a re-freeze, never on a boss', f.first === 1 && f.again === 0 && f.boss === 0 && f.frozen, JSON.stringify(f));
  const b = R.burn; ok('Burning Touch: burn_ignite once as the burn takes hold, not again while burning', b.first === 1 && b.again === 0 && b.burning, JSON.stringify(b));
  const l = R.lifesteal; ok('Lifesteal: drain_wisp rides the player on a heal, at most once per 30 frames', l.first === 1 && l.again === 0 && l.follows, JSON.stringify(l));
  ok('Quickening: quicken_burst when a cooldown resets', R.quicken.n === 1 && R.quicken.cd === 0, JSON.stringify(R.quicken));
  ok('Hyper Teleport: blink_warp where the dash leaves and again where it lands', R.blink.start === 1 && R.blink.landed === 1, JSON.stringify(R.blink));
  const d = R.diag; ok('Diagonal Slash: diag_slash on the swing side, mirrored facing left, none without the boon', d.right && d.left && d.rightOfPlayer && d.without === 0, JSON.stringify(d));
  ok('Thorns: thorn_burst on the attacker when a contact hit reflects', R.thorns.n >= 1 && R.thorns.onAttacker, JSON.stringify(R.thorns));
  ok('no page errors', errs.length === 0, errs.slice(0, 3).join(' | '));
} catch (e) { fail++; console.log('FAIL harness: ' + (e && e.message)); }
await browser.close(); server.kill();
console.log(`\n${pass}/${pass + fail} passed`); process.exit(fail ? 1 : 0);
