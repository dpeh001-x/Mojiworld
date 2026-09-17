// The Skills panel says what the skills do. Descriptions are held to the numbers in the RUNNING game - constants and
// the skill functions' own source - so a Skill Editor patch that changes a number without its text fails here.
// Also: rank-perk text matches the perk, Magic Bolt is free, the first-paint skill bar carries the live texts, and the
// Celestial Aurora field ticks for its whole (rank-extended) life.
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
    const out = { ver: GAME_VERSION, claims: [] };
    const fmt = (v) => String(+(+v).toFixed(2));
    const lit = (id, re) => { const m = SKILL_FNS[id].toString().match(re); return m ? +m[1] : NaN; };
    const lit2 = (id, re) => { const m = SKILL_FNS[id].toString().match(re); return m ? [+m[1], +m[2]] : [NaN, NaN]; };
    const claim = (id, text) => out.claims.push({ id, text, ok: SKILLS[id].desc.includes(text), desc: SKILLS[id].desc });
    // constants
    claim('marksman_ult', `${fmt(LX_PROTOCOL_LINE_ATK)}× ATK + ${LX_PROTOCOL_LINE_FLAT} each`);
    claim('marksman_oneshot', `${fmt(LX_DEADEYE_LINE_ATK)}× ATK + ${LX_DEADEYE_LINE_FLAT} each`);
    claim('dragoon_ult', `460px shockwave (${fmt(lit('dragoon_ult', /performAround\(460, ([\d.]+),/))}× ATK`);
    claim('shinobi_seal', `dealing ${fmt(LX_KAGE_DMG)}× ATK`);
    claim('hexmaster_grandhex', `a ${fmt(LX_GRANDHEX_BURST_MUL)}× ATK burst`);
    claim('hexmaster_grandhex', `PULSES AGAIN (${fmt(LX_GRANDHEX_BURST_MUL * 0.8)}× ATK)`);
    claim('hexmaster_grandhex', `RUPTURES for ${fmt(LX_GRANDHEX_RUPTURE_MUL)}× ATK and splashes ${Math.round(LX_GRANDHEX_RUPTURE_SPLASH * 100)}%`);
    claim('hexmaster_grandhex', `(${fmt(LX_HEXORB_DMG_MUL)}× ATK + a stack)`);
    { const lo = LX_DAWN.baseMul, hi = (LX_DAWN.baseMul + LX_DAWN.timeMul) * (1 + LX_DAWN.dmgAmp);
      claim('crusader_ult', `a holy detonation for ${fmt(lo * 0.7)}× ATK, up to ${fmt(hi * 0.7)}× fully charged`);
      claim('crusader_ult', `after-waves of ${fmt(lo * 0.15)}× ATK each (up to ${fmt(hi * 0.15)}×)`); }
    // literals in the skill functions; hits tagged with a slot-x skill's own id are doubled by hitMonster (_isGSkill)
    out.gx2 = { phantom_cut: _isGSkill('phantom_cut'), archbishop_grail: _isGSkill('archbishop_grail') };
    claim('phantom_cut', `(${fmt(2 * lit('phantom_cut', /getAtk\(\) \* ([\d.]+)\), crit, 'phantom_cut'/))}× ATK each)`);
    claim('phantom_cut', `shadow nova (${fmt(lit('phantom_cut', /const dmg = Math\.floor\(getAtk\(\) \* ([\d.]+) \+ 6\)/))}× ATK`);
    claim('archbishop_grail', `(${fmt(2 * lit('archbishop_grail', /const dmg = Math\.floor\(getAtk\(\) \* ([\d.]+)\);/))}× ATK each)`);
    { const c = lit('doombringer_ult', /performMelee\(440, ([\d.]+) \* _heatMul/), f = lit('doombringer_ult', /getAtk\(\) \* ([\d.]+) \* _heatMul \+/);
      claim('doombringer_ult', `a ${fmt(c)}× ATK melee cleave`); claim('doombringer_ult', `doom-fires (${fmt(f)}× ATK each)`);
      claim('doombringer_ult', `(~${fmt(c + 7 * f)}x ATK total, ~${fmt(2 * (c + 7 * f))}x at full heat)`); }
    claim('shinobi_ult', `(${fmt(lit('shinobi_ult', /performAround\(175, ([\d.]+),/))}× ATK in 175 px each)`);
    claim('shinobi_ult', `then a ${fmt(lit('shinobi_ult', /performAround\(330, ([\d.]+),/))}× ATK shockwave finale`);
    claim('sleight', `for ${fmt(lit('sleight', /getAtk\(\) \* ([\d.]+) \* ramp/))}× ATK`);
    { const [a, b] = lit2('elemental', /getAtk\(\) \* ([\d.]+) \* jumpMul \+ (\d+)/); claim('elemental', `(${fmt(a)}× ATK + ${b}, −8% per hop)`); }
    claim('archbishop_ult', `five holy pulses (${fmt(lit('archbishop_ult', /performAround\(440, ([\d.]+),/))}× ATK`);
    claim('phantom_ult', `shards (${fmt(lit('phantom_ult', /damage: getAtk\(\) \* ([\d.]+) \+/))}× ATK each)`);
    claim('nightreaper_ult', `shuriken (${fmt(lit('nightreaper_ult', /damage: getAtk\(\) \* ([\d.]+) \+ 5/))}× ATK each)`);
    claim('arcaneBurst', `(${fmt(lit('arcaneBurst', /performAround\(_abAoe, ([\d.]+),/))}× ATK, heavy knockback)`);
    claim('holyLight', `holy AoE (${fmt(lit('holyLight', /const _aoeDmg = Math\.max\(1, Math\.floor\(getAtk\(\) \* ([\d.]+)\)\)/))}× ATK`);
    claim('darkPulse', `(220px, ${fmt(lit('darkPulse', /performAround\(220, ([\d.]+),/))}× ATK)`);
    claim('blink', `Deals ${fmt(lit('blink', /const _dmg = Math\.max\(1, Math\.floor\(getAtk\(\) \* ([\d.]+)\)\)/))}× ATK`);
    // Magic Bolt's row says mp:3, but the boot loop zeroes every basic attack's MP - it really is free
    player.cls = 'mage'; player.job = null; player.master = null; player.maxMp = 500; player.mp = 200; player.skillCooldowns = {}; player.attackCooldown = 0;
    game.paused = false; const mp0 = player.mp; try { castSkill('magicBolt'); } catch (e) { out.boltErr = e.message; }
    out.boltCost = mp0 - player.mp; out.boltDesc = SKILLS.magicBolt.desc;
    // rank-perk text
    out.warCry5 = _formatSkillLv5Bonus('warCry'); out.meteor10 = _formatSkillLv10Bonus('meteor'); out.rush10 = _formatSkillLv10Bonus('rush');
    out.aegis10 = _formatSkillLv10Bonus('crusader_aegis'); out.deadeye10 = _formatSkillLv10Bonus('marksman_oneshot'); out.stab5 = _formatSkillLv5Bonus('stab');
    // the first-paint skill bar in the HTML carries copies of descs; they must be the live texts
    const html = await (await fetch(location.pathname, { cache: 'no-store' })).text();
    out.bar = [...html.matchAll(/<div class="skill-slot ready" title="([^"—]+) — ([^"]*) \(Lv \d+\+\)">/g)].map((m) => {
      const s = Object.values(SKILLS).find((x) => x.name === m[1].trim() && x.cls === 'warrior'); return { name: m[1].trim(), ok: !!s && s.desc === m[2] };
    });
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
    out.arrowRain = SKILLS.arrowRain.desc;
    return out;
  });
  console.log('build ' + r.ver);
  const bad = r.claims.filter((c) => !c.ok);
  check(r.claims.length >= 27 && !bad.length && !r.claims.some((c) => /NaN/.test(c.text)), `every checked description quotes the number in the running game's code (${r.claims.length} claims)`,
    bad.map((c) => `${c.id} should say "${c.text}"`).join(' | ') || r.claims.map((c) => c.text).slice(0, 4).join(' · '));
  check(r.gx2.phantom_cut && r.gx2.archbishop_grail, 'the doubled numbers are real: both skills are G skills whose hits carry their own id', JSON.stringify(r.gx2));
  check(r.boltCost === 0 && /Free to cast\.$/.test(r.boltDesc), 'Magic Bolt is free (basic attacks are zeroed at boot) and its text says so', `cost ${r.boltCost}; ${r.boltDesc}`);
  check(r.bar.length >= 5 && r.bar.every((b) => b.ok), "the HTML's first-paint skill bar tooltips are the live descriptions", r.bar.map((b) => `${b.name} ${b.ok ? 'ok' : 'STALE'}`).join(', '));
  check(/22 arrows/.test(r.arrowRain), 'Arrow Rain states its arrow count', r.arrowRain);
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
