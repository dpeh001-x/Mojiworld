#!/usr/bin/env node
// v0.30.1518 - SKILLS DO WHAT THEIR TEXT SAYS (per user: "Certain skill descriptions are not accurate for instance war cry is said to
// buff partners for 7 seconds but it does not, make sure it all tallies accurately"). The code half of the audit:
//   MERGE    - a party buff (or heal) cast inside the 150 ms flood guard is folded into the next frame, not dropped: War Cry
//              then Guardian then Bloodlust reach partners as two frames carrying all three (heals add up)
//   BANNERS  - Warlord's Banner and War of Banners never cut a longer War Cry / Bloodlust you already have running
//   BLINK    - a Mirror Shadow blink is judged at its 10 MP, not the summon's full cost
//   DEADEYE  - a press inside an open Deadeye window is free at the gate too (needs no MP on hand)
//   HEX      - a Pandemic Hex orb's SUPER POISON (0.9x ATK) survives the hex stack the same orb lands
//   SIEGE    - a Siege Volley cut short (staggered) frees the other skills at once, not 8 s later
//   GRAIL    - the Holy Grail's ascend keeps its 0.8 s cast guard only, not 2.5 s of untouchability
//   CRITS    - Shadow Strike, Voidrift Execution, Kage Rush, Mirror Shadow's clones and the Grail's pillars no longer flag
//              crits their damage never had
//   [PORT=n] [MOJI_GAME_FILE=x.html] node scripts/skill_tally_test.mjs
import { createRequire } from 'node:module'; import path from 'node:path'; import fs from 'node:fs';
import { fileURLToPath } from 'node:url'; import { spawn } from 'node:child_process';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const { chromium } = createRequire(import.meta.url)('playwright-core');
const FILE = process.env.MOJI_GAME_FILE ? path.basename(process.env.MOJI_GAME_FILE) : 'mojiworld_game.html';
const PORT = Number(process.env.PORT || 11785);
let pass = 0, fail = 0; const ok = (n, c, x) => { if (c) pass++; else fail++; console.log((c ? 'PASS ' : 'FAIL ') + n + (x !== undefined ? '  [' + x + ']' : '')); };
const src = fs.readFileSync(process.env.MOJI_GAME_FILE ? path.resolve(process.env.MOJI_GAME_FILE) : path.join(ROOT, 'mojiworld_game.html'), 'utf8');
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
    const frames = async (n) => { const t0 = game.time; for (let i = 0; i < 400 && game.time - t0 < n; i++) await sleep(25); };
    try { _lxBootGateDone = true; window._prologueActive = false; } catch (e) {}
    for (const id of ['loading-overlay', 'lo-auth', 'class-select-modal', 'lo-menu']) { const el = document.getElementById(id); if (el) el.style.display = 'none'; }
    applyClass('warrior'); player._storyBeatsSeen = new Proxy({}, { get: () => true });
    loadMap('forest', 300); await sleep(1500); game.paused = true; player.invulnerable = 9e9; player.level = 99;
    const out = {};
    // MERGE - a fake socket; the relay is not under test (coop_party_support_test covers receive + effect)
    { const _ca = window._coopActive, _ws = net.ws, sent = [];
      window._coopActive = () => true; net.ws = { readyState: 1, send: (s) => sent.push(JSON.parse(s)) };
      net._lastPbufAt = 0; net._pbufHeld = null; net._lastPhealAt = 0; net._phealHeld = null;
      _coopPartyBuff('warCry', 7000, 'War Cry'); _coopPartyBuff('guardian', 30000, 'Guardian'); _coopPartyBuff('bloodlust', 20000, 'Bloodlust');
      _coopPartyHeal(0.2, 0, 'Holy Light'); _coopPartyHeal(0.25, 0.1, "Warlord's Banner");
      await sleep(400);
      const b = sent.filter((f) => f.pbf), h = sent.filter((f) => f.phl);
      out.merge = { buffFrames: b.length, keys: b.flatMap((f) => f.bl.map((x) => x[0])).sort().join(','), label: b[1] && b[1].sl,
        healFrames: h.length, hp: h.map((f) => f.hp).join('+'), mp: h.map((f) => f.mpp).join('+') };
      window._coopActive = _ca; net.ws = _ws; }
    // BANNERS
    applyClass('warrior'); player.level = 99; player.buffs.warCry = 60000; player.buffs.bloodlust = 60000;
    try { SKILL_FNS.warlord_warcry(); } catch (e) { out.bannerErr = String(e).slice(0, 80); }
    out.banner = { warCry: player.buffs.warCry, bloodlust: player.buffs.bloodlust };
    player.buffs.bloodlust = 90000; player._warlordEnrageUntil = 0;
    try { SKILL_FNS.warlord_ult(); } catch (e) { out.bannerErr = String(e).slice(0, 80); }
    out.ult = player.buffs.bloodlust;
    // BLINK - a Shadowlord with the clones up, the summon on cooldown, 20 MP on hand
    applyClass('rogue'); player.level = 99; player.job = SKILLS.shadowlord_clones.job; player.master = 'shadowlord';
    player.skillCooldowns.shadowlord_clones = 9000; player._clones = [{ x: player.x + 120, y: player.y }]; player._mirrorGate = 0; player.mp = 20;
    out.blink = { ready: isReady('shadowlord_clones'), cost: (typeof _lxPressMpCost === 'function') ? _lxPressMpCost('shadowlord_clones', SKILLS.shadowlord_clones.mp) : null, full: SKILLS.shadowlord_clones.mp };
    player._clones = null; player.mp = 20;
    out.blink.summonAt20 = isReady('shadowlord_clones');
    // DEADEYE - a Marksman inside an open Focus Fire window with 10 MP on hand
    applyClass('archer'); player.level = 99; player.job = SKILLS.marksman_oneshot.job; player.master = 'marksman';
    player.skillCooldowns.marksman_oneshot = 0; player._deadeyeUntil = _lxDeNow() + 3000; player.mp = 10;
    out.deadeye = { ready: isReady('marksman_oneshot') };
    player._deadeyeUntil = 0; out.deadeye.closedAt10 = isReady('marksman_oneshot');
    // HEX - one Pandemic Hex orb (super poison + 1 hex stack) on a fresh foe
    applyClass('mage'); player.level = 99; player.x = 400;
    { const m = game.monsters.find((x) => x && x.currentHp > 0 && !x.isBoss && !x.boss);
      Object.assign(m, { maxHp: 1e9, currentHp: 1e9, burnDmg: 0, _hexStacks: 0, evasion: 0, traits: null, x: player.x + 80, y: player.y, speed: 0 });
      // the orb exactly as hexmaster_ult builds it (homing, no gravity, splash), started just short of the foe
      game.projectiles.push({ x: m.x - 30, y: m.y + (m.h || 40) / 2 - 14, vx: 6, vy: 0, w: 28, h: 28, life: 120, damage: getAtk() * LX_PANDEMIC_ORB_MUL + 20,
        hexStacks: 1, owner: 'player', skill: 'hexorb', homing: m, aoeOnHit: LX_PANDEMIC_ORB_AOE, noGravity: true, _msHandled: true, superPoison: 1, color: '#aa33ff' });
      game.paused = false; for (let i = 0; i < 60 && !(m._hexStacks > 0); i++) await frames(1); game.paused = true;
      out.hex = { burn: m.burnDmg | 0, stacks: m._hexStacks | 0, want: Math.floor(getAtk() * LX_SUPER_POISON_MUL) }; }
    // SIEGE - a stream staggered 1 s in
    applyClass('archer'); player.level = 99;
    { player._ballistaChannel = { endsAt: game.time + 480, mpDrainAccum: 0 }; player._castLockUntil = game.time + 480; player.hitStun = 30; player.invulnerable = 0;
      game.paused = false; await frames(3); game.paused = true; player.invulnerable = 9e9;
      out.siege = { channel: !!player._ballistaChannel, lockLeft: (player._castLockUntil | 0) - (game.time | 0) }; }
    // GRAIL - 1.2 s into the 2.5 s ascend, with nothing near to hit
    applyClass('mage'); player.level = 99; for (const m of game.monsters) if (m) { m.x = player.x + 3000; }
    player.invulnerable = 0; player.hitStun = 0;
    try { SKILL_FNS.archbishop_grail(); } catch (e) { out.grailErr = String(e).slice(0, 80); }
    game.paused = false; await frames(72); game.paused = true;
    out.grail = { ascended: Math.round(player._ascended || 0), invuln: Math.round(player.invulnerable || 0) };
    player.invulnerable = 9e9;
    // CRITS - every crit roll would succeed; the Shadow Strike chain and the Grail's pillars must still land plain
    { const _rc = window.rollCrit, _hm = window.hitMonster, log = [];
      window.rollCrit = () => true;
      window.hitMonster = function (m, d, c, tag) { log.push([tag, !!c]); return _hm.apply(this, arguments); };
      const m = game.monsters.find((x) => x && x.currentHp > 0 && !x.isBoss && !x.boss);
      Object.assign(m, { maxHp: 1e9, currentHp: 1e9, x: player.x + 150, y: player.y, evasion: 0, traits: null });
      applyClass('rogue'); player.level = 99; player.job = SKILLS.shadowStrike.job || player.job;
      try { SKILL_FNS.shadowStrike(); } catch (e) { out.ssErr = String(e).slice(0, 80); }
      game.paused = false; await frames(60); game.paused = true;
      applyClass('mage'); player.level = 99;
      try { SKILL_FNS.archbishop_grail(); } catch (e) {}
      game.paused = false; await frames(150); game.paused = true;
      window.rollCrit = _rc; window.hitMonster = _hm;
      const of = (t) => log.filter((x) => x[0] === t);
      out.crits = { ss: of('shadowStrike').length, ssCrit: of('shadowStrike').filter((x) => x[1]).length, gr: of('archbishop_grail').length, grCrit: of('archbishop_grail').filter((x) => x[1]).length }; }
    return out;
  });
  const M = R.merge;
  ok('MERGE: War Cry, Guardian and Bloodlust pressed together all reach partners (2 frames, nothing dropped)', M.buffFrames === 2 && M.keys === 'bloodlust,guardian,warCry' && M.label === 'Guardian + Bloodlust', JSON.stringify(M));
  ok('MERGE: two heals pressed together both arrive (the held one adds up)', M.healFrames === 2 && M.hp === '0.2+0.25' && M.mp === '0+0.1', JSON.stringify(M));
  ok("BANNERS: Warlord's Banner keeps a longer War Cry and Bloodlust", R.banner.warCry === 60000 && R.banner.bloodlust === 60000 && !R.bannerErr, JSON.stringify(R.banner) + (R.bannerErr || ''));
  ok('BANNERS: War of Banners keeps a longer Bloodlust', R.ult === 90000, R.ult);
  ok('BLINK: with the clones up, 20 MP is enough for a 10 MP blink; without them the summon still needs its full cost', R.blink.ready === true && R.blink.cost === 10 && R.blink.summonAt20 === false, JSON.stringify(R.blink));
  ok('DEADEYE: a press inside the open window is free at the gate (10 MP on hand); a closed window still needs the cost', R.deadeye.ready === true && R.deadeye.closedAt10 === false, JSON.stringify(R.deadeye));
  ok('HEX: the orb\'s SUPER POISON survives the hex stack it lands', R.hex.stacks >= 1 && R.hex.burn >= R.hex.want && R.hex.want > 0, JSON.stringify(R.hex));
  ok('SIEGE: a staggered stream frees the other skills at once', !R.siege.channel && R.siege.lockLeft <= 0, JSON.stringify(R.siege));
  ok('GRAIL: 1.2 s into the ascend the 0.8 s guard is over (still floating)', R.grail.ascended > 0 && R.grail.invuln <= 0 && !R.grailErr, JSON.stringify(R.grail) + (R.grailErr || ''));
  ok('CRITS: Shadow Strike and the Grail\'s pillars land plain even when every crit roll succeeds', R.crits.ss > 0 && R.crits.ssCrit === 0 && R.crits.gr > 0 && R.crits.grCrit === 0, JSON.stringify(R.crits) + (R.ssErr || ''));
  ok('CRITS: Voidrift Execution, Kage Rush and the clones pass no crit flag either (source)', /hitMonster\(target, Math\.floor\(getAtk\(\) \* 5\.2\), false, 'phantom_cut'\)/.test(src) && /_ag14\.hit\(m, Math\.floor\(getAtk\(\) \* LX_KAGE_DMG\), false, 'melee'\)/.test(src) && /_ag12\.hit\(m, dmg, false, 'shadow'\)/.test(src));
  ok('no page errors', errs.length === 0, errs.slice(0, 2).join(' | '));
} catch (e) { ok('harness ran', false, String(e).slice(0, 200)); }
console.log(`\n${pass} passed, ${fail} failed`);
await browser.close(); server.kill();
process.exit(fail ? 1 : 0);
