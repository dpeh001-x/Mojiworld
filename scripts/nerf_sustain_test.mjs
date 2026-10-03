#!/usr/bin/env node
// v0.30.1527 - OVERPOWERED SKILLS, PART 3: SUSTAIN (per user: "Fix all that you have suggested", after the audit of "skills that might
// be too overpowered, especially the buffs and those with miscellaneous effects").
//   AURORA - a second Celestial Aurora replaces the first field; a tick heals 4% HP and 3% MP; the partner frame carries the
//            field's rect, and a partner heals inside it and not outside it
//   VORTEX - a Soul Vortex drain heals 7% of the damage it dealt (it was 30% of the raw drain), and with a big lifesteal on
//            top the two together still stay inside the 7% cap
//   HOLY   - Holy Light heals 35% at high ATK (it was a full heal), and shares 35% with partners
//   Simulation steps drive updateMonsters / updateProjectiles directly (no regen, no frame timing).
//   [PORT=n] [MOJI_GAME_FILE=x.html] node scripts/nerf_sustain_test.mjs
import { createRequire } from 'node:module'; import path from 'node:path';
import { fileURLToPath } from 'node:url'; import { spawn } from 'node:child_process';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const { chromium } = createRequire(import.meta.url)('playwright-core');
const FILE = process.env.MOJI_GAME_FILE ? path.basename(process.env.MOJI_GAME_FILE) : 'mojiworld_game.html';
const PORT = Number(process.env.PORT || 11791);
let pass = 0, fail = 0; const ok = (n, c, x) => { if (c) pass++; else fail++; console.log((c ? 'PASS ' : 'FAIL ') + n + (x !== undefined ? '  [' + x + ']' : '')); };
const server = spawn(process.execPath, [path.join(ROOT, 'serve.js'), String(PORT)], { stdio: 'ignore', cwd: ROOT, env: { ...process.env } });
await new Promise((r) => setTimeout(r, 1500));
const browser = await chromium.launch({ channel: 'chrome', headless: true, args: ['--mute-audio'] });
const ctx = await browser.newContext({ serviceWorkers: 'block', viewport: { width: 1280, height: 760 } });
await ctx.addInitScript(() => { try { localStorage.mojiworld_prologue_seen = '1'; } catch (e) {} });
const page = await ctx.newPage();
const errs = []; page.on('pageerror', (e) => errs.push(String(e).slice(0, 140)));
try {
  await page.goto(`http://localhost:${PORT}/${FILE}`, { waitUntil: 'domcontentloaded', timeout: 180000 });
  await page.waitForFunction(() => { const m = document.getElementById('lo-menu'); return !!(m && m.offsetParent !== null && m.getClientRects().length); }, null, { timeout: 180000 });
  await page.waitForTimeout(800);
  const R = await page.evaluate(async () => {
    const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
    const step = (n) => { game.paused = false; try { for (let i = 0; i < n; i++) { game.time += 1; try { updateMonsters(16.667); } catch (e) {} try { updateProjectiles(16.667); } catch (e) {} } } finally { game.paused = true; } };   // synchronous: the real loop can not interleave
    try { _lxBootGateDone = true; window._prologueActive = false; } catch (e) {}
    for (const id of ['loading-overlay', 'lo-auth', 'class-select-modal', 'lo-menu']) { const el = document.getElementById(id); if (el) el.style.display = 'none'; }
    applyClass('mage'); player._storyBeatsSeen = new Proxy({}, { get: () => true }); player._gravitosCineSeen = true;
    loadMap('forest', 300); await sleep(1500); game.paused = true;
    const hero = (job, master) => { player.job = job; player.master = master; player.masteries = master ? { [master]: true } : {}; player.level = 99; player._god = false;
      player.invulnerable = 0; player.skillCooldowns = {}; player.skillRanks = {}; player._castLockUntil = 0; player.mods.lifesteal = 0; };
    const clear = () => { game.monsters.length = 0; game.projectiles.length = 0; game.hazards.length = 0; };
    const out = {};
    // AURORA - a fake socket reads the partner frames
    const sent = []; const _ca = window._coopActive, _ws = net.ws;
    window._coopActive = () => true; net.ws = { readyState: 1, send: (s) => sent.push(JSON.parse(s)) }; net._lastPhealAt = 0; net._phealHeld = null;
    try {
      clear(); hero('priest', null); player._prismCharges = 0;
      SKILL_FNS.celestialAurora(); SKILL_FNS.celestialAurora();
      const fields = game.hazards.filter((h) => h && h.type === 'aurora_field'), f = fields[0];
      out.aurora = { fields: fields.length, healPct: f && f.healPct, mpPct: f && f.mpPct };
      player.x = f.cx - player.w / 2; player.y = f.cy - player.h / 2; player.vx = player.vy = 0;
      player.hp = 1; player.mp = 0; const x0 = player.x, y0 = player.y;
      step(61); player.x = x0; player.y = y0;
      out.aurora.healHp = player.hp - 1; out.aurora.healMp = player.mp; out.aurora.wantHp = Math.floor(getMaxHp() * 0.04); out.aurora.wantMp = Math.floor(getMaxMp() * 0.03);
      const fr = sent.find((x) => x.phl && x.sl === 'Celestial Aurora'); out.aurora.frame = fr ? { hp: fr.hp, mpp: fr.mpp, ar: fr.ar } : null;
      // the partner side: a peer on this map sends that frame; we stand inside, then outside
      net.peers = net.peers || {}; net.peers[77] = { id: 77, map: game.currentMap, hp: 100, _last: performance.now() };
      const recv = (inside) => { player.x = inside ? f.cx - player.w / 2 : f.x + f.w + 200; player.y = f.cy - player.h / 2; player.hp = 1;
        _coopApplyPartyHeal({ t: 'ping', id: 77, phl: 1, hm: game.currentMap, hp: 0.04, mpp: 0.03, sl: 'Celestial Aurora', ar: fr ? fr.ar : [f.x, f.y, f.w, f.h] }); return player.hp - 1; };
      out.aurora.partnerIn = recv(true); out.aurora.partnerOut = recv(false); player.x = x0; player.y = y0;
      delete net.peers[77]; clear();
    } finally { window._coopActive = _ca; net.ws = _ws; }
    // VORTEX - a necromancer's pool and one slime in it, two drain ticks; then the same with a 50% lifesteal
    const vortex = (ls) => { clear(); hero('warlock', 'necromancer'); player.mp = player.maxMp = 99999; player.mods.lifesteal = ls; player.invulnerable = 999999; player.baseAtk = 500;   // a drain worth measuring, 7% of it well under max HP (500: every ATK multiplier doubled in v0.30.1604)
      castSkill('necromancer_harvest'); const pool = game.hazards.find((h) => h && h.type === 'soul_vortex'); if (!pool) return { err: 'no pool' };
      const m = spawnMonster(player.x + 90, player.y - 10, 'slime', false); Object.assign(m, { maxHp: 1e9, currentHp: 1e9, atk: 0, speed: 0, evasion: 0, traits: null });
      player.hp = 1; const mh0 = m.currentHp; step(61); const r = { healed: player.hp - 1, dealt: mh0 - m.currentHp, maxHp: getMaxHp() }; player.mods.lifesteal = 0; clear(); return r; };
    out.vortex = vortex(0); out.vortexLs = vortex(0.5);
    // HOLY LIGHT - high ATK, a partner share read off the socket
    { const sent2 = []; window._coopActive = () => true; net.ws = { readyState: 1, send: (s) => sent2.push(JSON.parse(s)) }; net._lastPhealAt = 0; net._phealHeld = null;
      try { clear(); hero('priest', null); player.baseAtk = 5000; player.hp = 1; SKILL_FNS.holyLight();
        const fr = sent2.find((x) => x.phl && /Holy Light/.test(x.sl || ''));
        out.holy = { healed: player.hp - 1, want: Math.floor(getMaxHp() * 0.35), partner: fr && fr.hp }; }
      finally { window._coopActive = _ca; net.ws = _ws; } }
    return out;
  });
  const A = R.aurora, V = R.vortex, L = R.vortexLs, H = R.holy;
  ok('AURORA: a second cast replaces the field (one at a time)', A.fields === 1, JSON.stringify({ fields: A.fields }));
  ok('AURORA: the field heals 4% HP and 3% MP a second', A.healPct === 0.04 && A.mpPct === 0.03 && A.healHp === A.wantHp && A.healMp === A.wantMp, JSON.stringify(A));
  ok('AURORA: the partner frame carries 4% / 3% and the field rect', !!A.frame && A.frame.hp === 0.04 && A.frame.mpp === 0.03 && Array.isArray(A.frame.ar) && A.frame.ar.length === 4, JSON.stringify(A.frame));
  ok('AURORA: a partner inside the field is healed, one outside it is not', A.partnerIn > 0 && A.partnerOut === 0, JSON.stringify({ inside: A.partnerIn, outside: A.partnerOut }));
  const v7 = Math.floor(V.dealt * 0.07);
  ok('VORTEX: the drain heals 7% of the damage it dealt (was 30% of the raw drain)', !V.err && V.dealt > 0 && V.healed > 0 && V.healed < V.maxHp - 1 && Math.abs(V.healed - v7) <= 2, JSON.stringify({ ...V, want: v7 }));
  ok('VORTEX: with a 50% lifesteal on top, the two together stay inside the 7% cap', !L.err && L.dealt > 0 && L.healed <= Math.floor(L.dealt * 0.07) + 2, JSON.stringify({ ...L, cap: Math.floor(L.dealt * 0.07) }));
  ok('HOLY: Holy Light heals 35% at high ATK, and partners get 35%', H.healed === H.want && H.partner === 0.35, JSON.stringify(H));
  ok('no page errors', errs.length === 0, errs.slice(0, 2).join(' | '));
} catch (e) { ok('harness ran', false, String(e).slice(0, 200)); }
console.log(`\n${pass} passed, ${fail} failed`);
await browser.close(); server.kill();
process.exit(fail ? 1 : 0);
