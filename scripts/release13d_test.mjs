// RELEASE 13d (bug hunt round 13, part D) stays fixed:
//   [1] a Warrior / Archer skill press (the hold-to-charge path) and the basic Z do nothing while STUNNED or STAGGERED; a release
//       under a stun drops the charge; a press the stun refused does not fire when the stun ends (release, press again: it casts)
//   [2] "+X% skill damage" talents pay on a skill hit tagged like a basic (Shuriken's 'dagger'), and "basic attacks heal" does not
//       heal off it; true basics and hits with no cast behind them keep the tag rule
//   [3] Warlord's Banner reach does not outlive a map change
//   [4] timed self-buffs survive a map change and keep counting down; Holy Shield and Hallowed Field still end; an Expedition
//       entry still starts bare
//   [5] Guardian: 12 s at rank 0, +1 s a rank, 16 s at most - always shorter than its cooldown; the text says so
//   node scripts/release13d_test.mjs        PORT / MOJI_GAME_FILE / SERVE_ROOT override
import { createRequire } from 'node:module'; import path from 'node:path'; import { fileURLToPath } from 'node:url'; import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
const ROOT = process.env.SERVE_ROOT || path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(path.join(ROOT, 'package.json'));
const { chromium } = require('playwright-core');
const PORT = Number(process.env.PORT || 15130), FILE = process.env.MOJI_GAME_FILE ? path.basename(process.env.MOJI_GAME_FILE) : 'mojiworld_game.html';
let pass = 0, fail = 0; const ok = (n, c, x) => { if (c) pass++; else fail++; console.log((c ? 'PASS ' : 'FAIL ') + n + (x !== undefined ? '  [' + JSON.stringify(x) + ']' : '')); };
const server = spawn(process.execPath, [path.join(ROOT, 'serve.js'), String(PORT)], { stdio: 'ignore', cwd: ROOT, env: { ...process.env } });
await new Promise((r) => setTimeout(r, 1500));
const EXE = ['C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', '/usr/bin/google-chrome'].find((p) => existsSync(p));
const browser = await chromium.launch({ executablePath: EXE, headless: true, args: ['--no-sandbox', '--mute-audio'] });
const errs = [];
try {
  const ctx = await browser.newContext({ serviceWorkers: 'block', viewport: { width: 1600, height: 900 } });
  await ctx.addInitScript(() => { try { localStorage.setItem('mojiworld_prologue_seen', '1'); } catch (e) {} });
  const page = await ctx.newPage(); page.on('pageerror', (e) => errs.push(String(e.message).slice(0, 140)));
  await page.goto(`http://localhost:${PORT}/${FILE}?dev=1&lxhold=0`, { waitUntil: 'domcontentloaded', timeout: 180000 });
  await page.waitForFunction(() => window._lxBootMenuSeen && typeof loadMap === 'function', null, { timeout: 240000 });
  await page.evaluate(async () => {
    try { _lxBootGateDone = true; _prologueActive = false; } catch (e) {}
    { const ov = document.getElementById('loading-overlay'); if (ov) ov.classList.add('fade'); }
    for (const id of ['loading-overlay', 'lo-auth', 'class-select-modal', 'lo-menu']) { const el = document.getElementById(id); if (el) el.style.display = 'none'; }
    player._storyBeatsSeen = player._storyBeatsSeen || {}; for (const k in STORY_BEATS) player._storyBeatsSeen[k] = true; player._storyBeatsSeen.captains_teaser = true; player._tutorialSeen = true; player._gravitosCineSeen = true;
    const _r = Math.random; let _seed = 7; Math.random = () => { _seed = (_seed * 16807) % 2147483647; return (_seed - 1) / 2147483646; }; window.__rnd0 = _r;   // pinned once
    window.__steps = (n) => new Promise((r) => { const g0 = game.time; const f = () => (game.time - g0 >= n ? r() : requestAnimationFrame(f)); f(); });
    window.__hero = (cls, job, master) => {
      try { closeAllModals(); } catch (e) {}
      player.cls = cls; player.job = job || null; player.master = master || null; player.masteries = master ? { [master]: true } : {};
      player.level = 80; player._god = false; player.maxHp = player.hp = 9e6; player.mp = player.maxMp = 99999; player.skillRanks = {};
      player.skillCooldowns = {}; player._warCharge = null; player._lxCcEaten = null; player.hitStun = 0; player.stunTimer = 0; player.frozenTimer = 0;
      player.attackCooldown = 0; player._castLockUntil = 0; player.invulnerable = 0; player.facing = 1; game.paused = false;
      game.monsters.length = 0; game.projectiles.length = 0; for (const k in game.keys) game.keys[k] = false;
    };
    window.__cd = (id) => +((player.skillCooldowns || {})[id] || 0);
    try { closeAllModals(); } catch (e) {}
    loadMap('forest'); game.paused = false; await __steps(10); game.monsters.length = 0;
  });
  const steps = (n) => page.evaluate((n) => __steps(n), n);
  const hero = (c, j, m) => page.evaluate(([c, j, m]) => __hero(c, j, m), [c, j, m]);
  const ev = (f, a) => page.evaluate(f, a);
  // [1] skill presses and the basic under a stun / a stagger
  for (const [cls, job, id] of [['warrior', 'berserker', 'powerStrike'], ['archer', 'sniper', 'multiShot']]) {
    const key = await ev(() => SLOT_TO_KEY.s);
    const out = {};
    await hero(cls, job); await page.keyboard.down(key); await steps(20); await page.keyboard.up(key); await steps(4);
    out.control = await ev((id) => __cd(id), id);   // the same press with no stun casts (the path is live)
    for (const cc of ['stunTimer', 'hitStun']) {
      await hero(cls, job); await ev((cc) => { player[cc] = 600000; }, cc);
      await page.keyboard.down(key); await steps(20); await page.keyboard.up(key); await steps(4);
      out[cc] = await ev((id) => __cd(id), id);
    }
    ok(`[1] ${cls}: ${id} does not cast while stunned or staggered`, out.control > 0 && out.stunTimer === 0 && out.hitStun === 0, out);
    await hero(cls, job); await ev(() => { player.stunTimer = 600000; });
    await page.keyboard.press('z'); await steps(6);
    const basic = await ev((c) => __cd(c === 'warrior' ? 'slash' : 'arrowShot'), cls);
    ok(`[1] ${cls}: the basic Z does not swing / shoot while stunned`, basic === 0, { basic });
    // held through the stun: nothing when it ends; a fresh press after it casts
    await hero(cls, job); await ev(() => { player.stunTimer = 600000; });
    await page.keyboard.down(key); await steps(10); await ev(() => { player.stunTimer = 0; }); await steps(30);
    const atEnd = await ev((id) => __cd(id), id); await page.keyboard.up(key); await steps(4);
    const afterUp = await ev((id) => __cd(id), id);
    await page.keyboard.down(key); await steps(3); await page.keyboard.up(key); await steps(4);
    const fresh = await ev((id) => __cd(id), id);
    ok(`[1] ${cls}: a press held through a stun does not fire when it ends; the next press casts`, atEnd === 0 && afterUp === 0 && fresh > 0, { atEnd, afterUp, fresh });
    // a charge released under a stun is dropped
    await hero(cls, job); await page.keyboard.down(key); await steps(15);
    const charging = await ev(() => !!player._warCharge); await ev(() => { player.stunTimer = 600000; });
    await page.keyboard.up(key); await steps(4);
    const rel = await ev((id) => ({ cd: __cd(id), charge: !!player._warCharge }), id);
    ok(`[1] ${cls}: a charge released while stunned is dropped, not cast`, charging && rel.cd === 0 && !rel.charge, { charging, ...rel });
  }
  // [2] talents read the cast, not just the tag
  const t2 = await ev(() => {
    __hero('rogue', 'assassin', 'nightreaper');
    const m = spawnMonster(player.x + 80, player.y, 'slime'); m.speed = 0; m.atk = 0; m.evasion = 0; m.def = 0; m.level = 1; m.maxHp = 1e12;
    const tf = window.talentFx;
    const hit = (fx, src, tag) => { window.talentFx = () => fx; const _mr = Math.random; Math.random = () => 0.5;   // the same roll for both sides of a ratio
      m.currentHp = m.maxHp; m.invulnerable = 0; m._hitIframe = 0; player.hp = 1000; if (game.monsters.indexOf(m) < 0) game.monsters.push(m); try { resetCombo(); } catch (e) {} player._momentum = 0; player._crescendoN = 0; player._stabChain = 0;   // no ramp from the hit before
      try { if (src) _lxRankAs(src, () => hitMonster(m, 100000, false, tag)); else hitMonster(m, 100000, false, tag); } finally { window.talentFx = tf; Math.random = _mr; }
      return { dmg: m.maxHp - m.currentHp, heal: player.hp - 1000 }; };
    const ratio = (src, tag) => { const a = hit({ skillDmg: 1 }, src, tag).dmg, b = hit({}, src, tag).dmg; return b > 0 ? +(a / b).toFixed(2) : null; };
    const out = { shuriken: ratio('throwDagger', 'dagger'), eclipse: ratio('nightreaper_mark', 'dagger'), stab: ratio('stab', 'melee'), noCast: ratio(null, 'dagger'), aoe: ratio('stab', 'aoe'),
      healShuriken: hit({ basicLifesteal: 0.5 }, 'throwDagger', 'dagger').heal, healStab: hit({ basicLifesteal: 0.5 }, 'stab', 'melee').heal };
    game.monsters.length = 0; return out;
  });
  ok('[2] +X% skill damage pays on a skill hit tagged like a basic (Shuriken, Eclipse Massacre)', t2.shuriken === 2 && t2.eclipse === 2, t2);
  ok('[2] ...and not on a true basic or an uncast tagged hit; a skill-tagged hit is unchanged', t2.stab === 1 && t2.noCast === 1 && t2.aoe === 2, t2);
  ok('[2] "basic attacks heal" heals off the basic, not off Shuriken', t2.healShuriken === 0 && t2.healStab > 0, t2);
  // [3] + [4] the map change
  const t3 = await ev(async () => {
    __hero('warrior', 'berserker', 'warlord');
    player._warlordBanner = game.time + 600;
    Object.assign(player.buffs, { guardian: 10000, eagleEye: 10000, warCry: 6000, bloodlust: 9000, maelstromGuard: 5000, holyShield: 5000, hallowedField: 1500 });
    loadMap('forest'); game.paused = false; await __steps(2);
    const after = { ...player.buffs }; await __steps(60);
    return { banner: player._warlordBanner | 0, after, later: player.buffs.guardian };
  });
  ok('[3] the Warlord\'s Banner reach ends with the map change', t3.banner === 0, { banner: t3.banner });
  const a = t3.after;
  ok('[4] Guardian, Eagle Eye, War Cry, Bloodlust survive a map change; the Storm Eye guard ends with its channel (release15)', a.guardian > 9000 && a.eagleEye > 9000 && a.warCry > 5000 && a.bloodlust > 8000 && (a.maelstromGuard | 0) === 0, a);
  ok('[4] ...and keep counting down; Holy Shield and Hallowed Field still end', t3.later < a.guardian - 500 && t3.later > 0 && a.holyShield === 0 && a.hallowedField === 0, { later: t3.later, holy: a.holyShield, field: a.hallowedField });
  const t4 = await ev(async () => {
    __hero('warrior', 'knight'); player.level = 120; Object.assign(player.buffs, { guardian: 10000, warCry: 6000 });
    let started = false; try { started = _startExpedition(); } catch (e) { return { err: String(e).slice(0, 100) }; }
    await __steps(2); const inRun = { guardian: player.buffs.guardian, warCry: player.buffs.warCry };
    try { _endExpedition('abandon'); } catch (e) {} try { closeAllModals(); } catch (e) {}
    return { started, inRun };
  });
  ok('[4] an Expedition still starts bare', t4.started && t4.inRun.guardian === 0 && t4.inRun.warCry === 0, t4);
  // [5] Guardian
  const t5 = await ev(() => {
    __hero('warrior', 'knight'); loadMap('forest'); game.paused = true;
    const dur = (r) => { player.skillRanks = { guardian: r }; player.buffs.guardian = 0; SKILL_FNS.guardian(); return player.buffs.guardian; };
    const out = { r0: dur(0), r3: dur(3), r5: dur(5), r10: dur(10) };
    player.skillRanks = { guardian: 10 }; player.skillCooldowns = {}; player.buffs.guardian = 0; game.paused = false; castSkill('guardian');
    out.cd10 = __cd('guardian'); out.desc = SKILLS.guardian.desc.slice(0, 60); return out;
  });
  ok('[5] Guardian lasts 12 s at rank 0, +1 s a rank, 16 s at most', t5.r0 === 12000 && t5.r3 === 15000 && t5.r5 === 16000 && t5.r10 === 16000, t5);
  ok('[5] ...never past its cooldown (rank 10), and its text says 12 s / 16 s', t5.r10 < t5.cd10 && /for 12s \(\+1 s per rank, 16 s at most\)/.test(t5.desc), t5);
  ok('no page errors', errs.length === 0, errs.slice(0, 3));
} finally { await browser.close(); server.kill(); }
console.log(`\n${pass}/${pass + fail} checks passed`);
process.exit(fail ? 1 : 0);
