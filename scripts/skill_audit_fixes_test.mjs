// The skill & cooldown audit's fixes, held in the running game (v0.30.1028+, docs/reports/SKILL_COOLDOWN_AUDIT.html):
//   R1 Meteor falls on the nearest monster ahead, so it lands at casting range (was 0% past 160 px)
//   R4 Spellweaver refunds at most twice a second and never touches a B ultimate (was once a frame, everything)
//   R6 War of Banners and Bastion of Dawn wait what the Skills panel says, table cd x 0.75 (was the raw 60 s)
//   R2/R3 War of Banners and Blade of Calamity deal their retuned numbers (per press / per cast, in ATK)
//
//   [SERVE_ROOT=<dir with serve.js + the game's data/>] [PORT=11098] node scripts/skill_audit_fixes_test.mjs [candidate.html]
import { createRequire } from 'node:module'; import path from 'node:path';
import { fileURLToPath } from 'node:url'; import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);
const { chromium } = require('playwright-core');
const SERVE_ROOT = process.env.SERVE_ROOT || ROOT, PORT = process.env.PORT || '11098';
const env = { ...process.env }; if (process.argv[2]) env.MOJI_GAME_FILE = path.resolve(process.argv[2]); else delete env.MOJI_GAME_FILE;
const server = spawn(process.execPath, [path.join(SERVE_ROOT, 'serve.js'), PORT], { stdio: 'ignore', cwd: SERVE_ROOT, env });
let pass = 0, fail = 0;
const check = (ok, msg, detail) => { console.log((ok ? 'PASS ' : 'FAIL ') + msg + (detail ? '  [' + detail + ']' : '')); ok ? pass++ : fail++; };
await new Promise((r) => setTimeout(r, 1800));
const EXE = ['C:/Program Files/Google/Chrome/Application/chrome.exe'].find((p) => existsSync(p));
const browser = await chromium.launch({ executablePath: EXE, headless: true, args: ['--no-sandbox', '--mute-audio'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 760 } });
const errs = []; page.on('pageerror', (e) => errs.push(String(e.message).slice(0, 160)));
try {
  await page.goto(`http://localhost:${PORT}/mojiworld_game.html?dev=1`, { waitUntil: 'domcontentloaded', timeout: 180000 });
  await page.waitForFunction(() => typeof loadMap === 'function' && typeof castSkill === 'function', null, { timeout: 180000 });
  await page.waitForTimeout(6000);
  const r = await page.evaluate(async () => {
    const sleep = (ms) => new Promise((res) => setTimeout(res, ms));
    const steps = async (n) => { const t0 = game.time; for (let i = 0; i < 600 && game.time - t0 < n; i++) await sleep(20); };
    try { _lxBootGateDone = true; _prologueActive = false; } catch (e) {}
    for (const id of ['loading-overlay', 'lo-auth', 'class-select-modal']) { const el = document.getElementById(id); if (el) el.style.display = 'none'; }
    loadMap('forest', 300); await sleep(1200); game.paused = false;
    for (let i = 0; i < 30 && !player.onGround; i++) await sleep(100);
    const x0 = player.x, y0 = player.y;
    window.getCritDmg = () => 1; const _roll = window.rollCrit; window.rollCrit = () => false; Math.random = () => 0.95;
    for (const [k, v] of [['comboMult', 1], ['critStreak', 0], ['combo', 0]]) Object.defineProperty(game, k, { get: () => v, set() {}, configurable: true });
    const as = (cls, job, master) => { Object.assign(player, { cls, job, master, masteries: master ? { [master]: true } : {}, _god: true, level: 90, baseAtk: 1000, baseCrit: 0,
      mp: 99999, maxMp: 99999, hp: 999999, maxHp: 999999, facing: 1, skillCooldowns: {}, skillRanks: {}, _momentum: 0, _releasedCharge: 0 });
      if (typeof cancelPendingSkillTimers === 'function') cancelPendingSkillTimers();   // a previous step's delayed hits (Bastion's after-waves) must not land on the next dummy
      if (game.minions) game.minions.length = 0; player._aegis = null;
      player.tree = player.tree || {}; player.tree.spellweaver = false; if (player.mods) { player.mods.cdrChance = 0; player.mods.crit = 0; }
      for (const k of Object.keys(player.buffs || {})) player.buffs[k] = 0; player.x = x0; player.y = y0; player.vx = 0;
      game.projectiles.length = 0; if (game.hazards) game.hazards.length = 0; };
    const dummy = (gap) => { game.monsters.length = 0; const m = spawnMonster(player.x + player.w + gap, player.y - 10, 'slime', false);
      m.w = 60; m.h = 60; m.x = player.x + player.w + gap; m.maxHp = 9e12; m.currentHp = 9e12; m.evasion = 0; m.speed = 0; m.atk = 0; m.frozen = 1e9; m.stunTimer = 1e9; return m; };
    const out = {};
    // R1 Meteor at 40 / 200 / 450 px from the mage's front edge, as ATK multiples
    as('mage', 'archmage', null); out.meteor = {};
    for (const gap of [40, 200, 450]) { as('mage', 'archmage', null); const m = dummy(gap), h0 = m.currentHp; castSkill('meteor');
      for (let i = 0; i < 20; i++) { await sleep(150); m.x = player.x + player.w + gap; m.vx = 0; }
      out.meteor[gap] = +((h0 - m.currentHp) / getAtk()).toFixed(2); }
    // R4 Spellweaver: one second of game time with a crit on every frame
    as('mage', 'archmage', 'sage'); player.tree.spellweaver = true;
    const m4 = dummy(100); player.skillCooldowns = { fireball: 60000, sage_ult: 60000 };
    window.rollCrit = () => true; const g0 = game.time;
    while (game.time - g0 < 60) { hitMonster(m4, 10, true, 'bolt'); await sleep(16); }
    window.rollCrit = () => false; player.tree.spellweaver = false;
    const gs = game.time - g0;
    out.weave = { steps: gs, fireballCut: Math.round(60000 - (player.skillCooldowns.fireball || 0) - gs * 1000 / 60), ultCut: Math.round(60000 - (player.skillCooldowns.sage_ult || 0) - gs * 1000 / 60) };
    // R6 War of Banners (enrage finished) and Bastion of Dawn (released) wait the panel's cooldown
    as('warrior', 'berserker', 'warlord'); dummy(100); castSkill('warlord_ult'); await steps(20); player._warlordEnrageUntil = game.time; await steps(20);
    out.wob = { cd: Math.round(player.skillCooldowns.warlord_ult || 0), shown: Math.round(_skillRealCd('warlord_ult')) };
    as('warrior', 'knight', 'crusader'); dummy(100); castSkill('crusader_ult'); await steps(20); player._bastionArmAt = game.time - 600; player._bastionArmHeld = false;
    castSkill('crusader_ult'); await steps(5);
    out.bastion = { cd: Math.round(player.skillCooldowns.crusader_ult || 0), shown: Math.round(_skillRealCd('crusader_ult')) };
    // R2 one War of Banners press, R3 one Blade of Calamity cast, in ATK
    as('warrior', 'berserker', 'warlord'); let m = dummy(60); let h0 = m.currentHp; const atk2 = getAtk(); castSkill('warlord_ult'); await sleep(1500);
    out.wobPress = +((h0 - m.currentHp) / atk2).toFixed(2); player._warlordEnrageUntil = 0;
    as('warrior', 'berserker', 'doombringer'); m = dummy(60); h0 = m.currentHp; const atk3 = getAtk(); castSkill('doombringer_apoc'); await sleep(2500);
    out.apoc = +((h0 - m.currentHp) / atk3).toFixed(2);
    window.rollCrit = _roll;
    return out;
  });
  const M = r.meteor;
  check(M[40] >= 3 && M[200] >= 3 && M[450] >= 3, 'Meteor lands on a monster 40, 200 and 450 px away (4x ATK + 80 each)', JSON.stringify(M));
  check(r.weave.fireballCut >= 1000 && r.weave.fireballCut <= 3000, 'Spellweaver: a second of crits takes 1-3 s off a skill, not one per frame', JSON.stringify(r.weave));
  check(r.weave.ultCut <= 200, 'Spellweaver never cuts a B ultimate', JSON.stringify(r.weave));
  check(Math.abs(r.wob.cd - r.wob.shown) <= 1500 && r.wob.shown <= 46000, 'War of Banners waits what the panel says (45 s, not the raw 60 s)', JSON.stringify(r.wob));
  check(Math.abs(r.bastion.cd - r.bastion.shown) <= 1500 && r.bastion.shown <= 46000, 'Bastion of Dawn waits what the panel says (45 s, not the raw 60 s)', JSON.stringify(r.bastion));
  check(r.wobPress >= 1.5 && r.wobPress <= 3.5, 'War of Banners: one press is the retuned sweep + wave (2.3x ATK; was 10.9x)', r.wobPress + 'x ATK');
  check(r.apoc >= 12 && r.apoc <= 17, 'Blade of Calamity: one cast is the retuned cleaves + slam (14.6x ATK; was 20.3x)', r.apoc + 'x ATK');
  check(!errs.length, 'no page errors', errs.slice(0, 3).join(' | '));
} catch (e) {
  check(false, 'test ran to completion', String(e.message || e).slice(0, 160));
} finally { await browser.close(); server.kill(); }
console.log(fail ? `${fail} FAILED, ${pass} passed` : `ALL ${pass} PASS`);
process.exit(fail ? 1 : 0);
