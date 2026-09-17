// The Skills panel says what the skills do (v0.30.782): descriptions audited against the code, rank-perk text
// that matches the perk, and the Celestial Aurora field ticking for its whole (rank-extended) life.
//
//   [SERVE_ROOT=<dir with serve.js + the game's data/>] node scripts/skill_desc_accuracy_test.mjs [candidate.html]
import { createRequire } from 'node:module'; import path from 'node:path';
import { fileURLToPath } from 'node:url'; import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);
const { chromium } = require('playwright-core');
const SERVE_ROOT = process.env.SERVE_ROOT || ROOT, PORT = process.env.PORT || '11096';
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
    try { _lxBootGateDone = true; _prologueActive = false; } catch (e) {}
    for (const id of ['loading-overlay', 'lo-auth', 'class-select-modal']) { const el = document.getElementById(id); if (el) el.style.display = 'none'; }
    loadMap('forest', 300); await sleep(1500);
    const out = { ver: GAME_VERSION };
    // Magic Bolt's row says mp:3, but the boot loop zeroes every basic attack's MP - it really is free
    player.cls = 'mage'; player.job = null; player.master = null; player.maxMp = 500; player.mp = 200; player.skillCooldowns = {}; player.attackCooldown = 0;
    game.paused = false; const mp0 = player.mp; try { castSkill('magicBolt'); } catch (e) { out.boltErr = e.message; }
    out.boltCost = mp0 - player.mp;
    // rank-perk text
    out.warCry5 = _formatSkillLv5Bonus('warCry'); out.meteor10 = _formatSkillLv10Bonus('meteor'); out.rush10 = _formatSkillLv10Bonus('rush');
    out.aegis10 = _formatSkillLv10Bonus('crusader_aegis'); out.deadeye10 = _formatSkillLv10Bonus('marksman_oneshot');
    out.stab5 = _formatSkillLv5Bonus('stab');
    // Celestial Aurora: one heal / holy tick per second of the field's life, including the rank seconds
    const aurora = async (rank) => {
      game.paused = true; game.hazards.length = 0; player.cls = 'mage'; player.job = 'priest'; player.skillRanks = { celestialAurora: rank };
      SKILL_FNS.celestialAurora();
      const h = game.hazards.find((x) => x.type === 'aurora_field'); if (!h) return null;
      // a headless page runs ~13 frames a second: wait long enough for a few frames, which cross tick 600 exactly once
      h.ticksDealt = 10; h.tick = 599; game.paused = false;
      for (let i = 0; i < 40 && (h.tick | 0) < 604; i++) await sleep(50);
      game.paused = true;
      return { life: h.maxLife, ticksDealt: h.ticksDealt };
    };
    out.aurora0 = await aurora(0); out.aurora10 = await aurora(10); player.skillRanks = {};
    out.desc = {}; for (const id of ['magicBolt', 'phantom_cut', 'marksman_ult', 'doombringer_ult', 'hexmaster_grandhex', 'archbishop_grail', 'arrowRain']) out.desc[id] = SKILLS[id].desc;
    return out;
  });
  console.log('build ' + r.ver);
  check(r.boltCost === 0 && /Free to cast\.$/.test(r.desc.magicBolt) && /1\.2× ATK \+ 6/.test(r.desc.magicBolt), 'Magic Bolt is free (basic attacks are zeroed at boot) and its text says so, with its 1.2× damage', `cost ${r.boltCost}; ${r.desc.magicBolt}`);
  check(/5\.8× ATK each/.test(r.desc.phantom_cut), "Voidrift Execution's strikes read 5.8× ATK (2.9 doubled by the G-skill x2, verified in play)", r.desc.phantom_cut.slice(0, 90));
  check(/1× ATK \+ 12 each/.test(r.desc.marksman_ult) && !/0\.6% ATK/.test(r.desc.marksman_ult), 'Deadeye Protocol quotes its real round damage', r.desc.marksman_ult.slice(0, 120));
  check(/~35x ATK total/.test(r.desc.doombringer_ult) && /\+1% damage per point/.test(r.desc.doombringer_ult), 'Calamity Incarnate quotes 35× and +1% per heat point', '');
  check(/4× ATK burst/.test(r.desc.hexmaster_grandhex) && /splashes 50%/.test(r.desc.hexmaster_grandhex), "Grand Hex quotes the user's v0.30.778 numbers", '');
  check(/5\.6× ATK each/.test(r.desc.archbishop_grail) && /22 arrows/.test(r.desc.arrowRain), 'Holy Grail pillars (doubled) and Arrow Rain count are stated', '');
  check(/\+2\.5 s buff duration/.test(r.warCry5 || ''), 'War Cry rank 5 reads +2.5 s, not +3 s', r.warCry5);
  check(/for 2\.5 s after casting/.test(r.stab5 || ''), 'a 2.5 s milestone window reads 2.5 s, not 3 s', r.stab5);
  check(/second full meteor/.test(r.meteor10 || '') && !/finisher attack/.test(r.meteor10 || ''), 'Meteor rank 10 says it drops a second meteor', r.meteor10);
  check(/flame-burst reach/.test(r.rush10 || '') && !/dash reach/.test(r.rush10 || ''), "Rush's reach perk names the flame bursts it widens", r.rush10);
  check(/half damage taken last ×1\.20/.test(r.aegis10 || ''), 'Divine Aegis rank 10 says it lengthens the half-damage window too', r.aegis10);
  check(/rank 9 × 1\.30/.test(r.deadeye10 || ''), 'Deadeye rank 10 says what its ×1.30 multiplies', r.deadeye10);
  check(r.aurora0 && r.aurora10 && r.aurora0.ticksDealt === 10 && r.aurora10.ticksDealt === 11 && r.aurora10.life === 1200,
    'Celestial Aurora at rank 10 keeps ticking past 10 s (rank 0 still stops at 10 ticks)', JSON.stringify([r.aurora0, r.aurora10]));
  check(!errs.length, 'no page errors', errs.slice(0, 3).join(' | '));
} finally { await browser.close(); server.kill(); }
console.log(`\n${pass}/${pass + fail} checks passed`);
process.exit(fail ? 1 : 0);
