// Do the 72 skill descriptions match what the handlers actually do?
// =============================================================================
// A wrong description is invisible: the skill still works, so nothing errors and
// nothing looks broken - the player just believes something untrue. Two real
// cases motivated this. Soul Siphon raised an undead thrall its text never
// mentioned, and Eclipse Massacre promised "a small heal" when the handler only
// refunded MP.
//
// Runs against the LIVE game and reads each handler's real source through
// Function.toString(), because a static parse cannot see values that live in
// named constants (LX_GRANDHEX_BURST_MUL) or in engine functions outside
// SKILL_FNS (the Soul Ward regen lives in updatePlayer).
//
// Three passes:
//   UNDER  the code does X and the description never says so
//   OVER   the description claims X with no supporting code near the skill
//   NUM    every %, duration, xATK, px and count in the text has a real value
//
// A SELF-TEST runs first: deliberately wrong claims are injected and must be
// caught. A checker that quietly stops working reports "all clean", which is
// indistinguishable from success - so a clean result is only trustworthy when
// the detector has just proven it still fires.
//
//   node scripts/skill_desc_audit.mjs
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);
const { chromium } = require('playwright-core');
const PORT = Number(process.env.MOJI_PORT || 9042);

const server = spawn(process.execPath, [path.join(ROOT, 'serve.js'), String(PORT)], { stdio: 'ignore' });
await new Promise((r) => setTimeout(r, 1200));
const browser = await chromium.launch({
  channel: process.env.MOJI_PW_EXE ? undefined : 'msedge',
  executablePath: process.env.MOJI_PW_EXE || undefined,
  headless: true,
});
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const errs = [];
page.on('pageerror', (e) => errs.push(String(e).slice(0, 160)));
await page.goto(`http://localhost:${PORT}/mojiworld_game.html`, { waitUntil: 'load', timeout: 90000 });
await page.waitForTimeout(9000);

const R = await page.evaluate(() => {
  const S = SKILLS, FN = SKILL_FNS;
  const html = document.documentElement.outerHTML;
  const strip = (s) => s.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|[^:])\/\/[^\n]*/g, '$1 ');

  // Context = the handler PLUS a window around every mention of the skill id.
  // Engines live in updatePlayer and the draw loop, not only in SKILL_FNS.
  const cache = {};
  const ctxFor = (id) => {
    if (cache[id]) return cache[id];
    let out = strip(String(FN[id] || ''));
    const re = new RegExp(id, 'g');
    let m, n = 0;
    while ((m = re.exec(html)) && n < 60) {
      out += strip(html.slice(Math.max(0, m.index - 800), m.index + 800));
      n++;
    }
    return (cache[id] = out);
  };

  const numIn = (ctx, n) => {
    const s = String(n);
    if (new RegExp('(?<![\\d.])' + s.replace('.', '\\.') + '(?![\\d])').test(ctx)) return true;
    // decimals are often written with a trailing zero: 2.2 stored as 2.20
    if (/\./.test(s) && new RegExp('(?<![\\d.])' + s.replace('.', '\\.') + '0(?![\\d])').test(ctx)) return true;
    return false;
  };

  const BEHAV = [
    { k: 'summon',    code: /raiseMinion\(|game\.minions\.push|player\.(ultPet|pet)\s*=\s*\{/, desc: /summon|raise|minion|undead|thrall|skelet|zombie|wolf|clone|turret|companion|eagle|werewolf|pet\b|banner|sword|shade|orb/i },
    { k: 'self-heal', code: /player\.hp\s*=\s*Math\.min\(|player\.hp\s*\+=|healPlayer\(/,      desc: /heal|restor|lifesteal|drain|regen|recover|siphon|\bhp\b/i },
    { k: 'mp-gain',   code: /player\.mp\s*=\s*Math\.min\(getMaxMp|player\.mp\s*\+=/,           desc: /\bmp\b|mana|refund|drain|siphon/i },
    { k: 'invuln',    code: /_invuln|cannotDie|_immortal/,                                     desc: /cannot die|invuln|immune|untouchable|guard|shield/i },
  ];

  // The OVER patterns are deliberately generous. Co-op sharing runs through a
  // central buff set rather than per-skill calls, and "orbs" are projectiles
  // rather than minions - both produced false alarms before these were widened.
  const CLAIMS = [
    { k: 'freeze', desc: /\bfreez|\bfrozen\b/i, code: /freez|frozen|_freezeUntil|applyFreeze/i },
    { k: 'stun',   desc: /\bstun|\bstagger/i,   code: /stun|stagger|_stunUntil/i },
    { k: 'poison', desc: /\bpoison/i,           code: /poison/i },
    { k: 'summon', desc: /\bsummon|\braise\b|\bthrall|\bclone|\bturret|companion/i, code: /raiseMinion|minions\.push|ultPet\s*=|pet\s*=\s*\{|spawnTurret|_spawnClone|_clones|projectiles\.push/i },
    { k: 'coop',   desc: /co-op partner|partners on your map/i, code: /_coopShare|_coopPartyHeal|_COOP_SHARABLE|net\.|buffs\.(warCry|bloodlust|guardian|holyShield|eagleEye|aegisShield)/i },
  ];

  // ctxOverride lets the self-test run against an EMPTY context. Probing a real
  // skill's context let injected numbers match by luck (2 of 4 lies slipped
  // through), which would have quietly weakened the guard over time.
  const numAudit = (id, desc, ctxOverride) => {
    const out = [], ctx = ctxOverride !== undefined ? ctxOverride : ctxFor(id), sk = S[id];
    for (const m of desc.matchAll(/(\d+(?:\.\d+)?)\s*%/g)) {
      const n = parseFloat(m[1]);
      if (!(numIn(ctx, n) || numIn(ctx, (n / 100).toFixed(2)) || numIn(ctx, (n / 100).toFixed(3)) || numIn(ctx, String(n / 100)))) out.push('PCT:' + m[0]);
    }
    for (const m of desc.matchAll(/(\d+(?:\.\d+)?)\s*(?:s|sec|seconds)\b/gi)) {
      const n = parseFloat(m[1]), ms = Math.round(n * 1000);
      if (ms < 200 || Math.abs((sk.cd || 0) - ms) < 1) continue;
      // A rounded second is correct prose: 1230ms is honestly "1.2 s".
      let near = false;
      for (let d = -60; d <= 60; d += 10) if (numIn(ctx, ms + d)) { near = true; break; }
      if (!near && !numIn(ctx, n)) out.push('DUR:' + m[0]);
    }
    for (const m of desc.matchAll(/(\d+(?:\.\d+)?)\s*[×x]\s*ATK/gi)) if (!numIn(ctx, parseFloat(m[1]))) out.push('ATK:' + m[0]);
    for (const m of desc.matchAll(/(\d{2,4})\s*px/gi)) if (!numIn(ctx, parseInt(m[1]))) out.push('PX:' + m[0]);
    for (const m of desc.matchAll(/\b(\d+)\s+(pillars?|clones?|wolves|undead|meteors?|daggers?|arrows?|orbs?|batches?|turrets?|thralls?|charges?)\b/gi)) {
      if (m[1] !== '1' && !numIn(ctx, parseInt(m[1]))) out.push('COUNT:' + m[0]);
    }
    return out;
  };

  // SELF-TEST - injected lies must be caught, real text must stay clean.
  const probeId = Object.keys(S)[0];
  const selfTest = {
    caught: numAudit(probeId, 'Deals 99× ATK over 77s within 4321px, healing 63%.', ''),
    controlClean: Object.keys(S).slice(0, 6).every((id) => numAudit(id, S[id].desc).length === 0),
  };

  const under = [], over = [], num = [];
  for (const id of Object.keys(S)) {
    const d = S[id].desc || '';
    if (typeof FN[id] !== 'function' || !d) continue;
    const src = strip(String(FN[id])), ctx = ctxFor(id);
    for (const c of BEHAV) if (c.code.test(src) && !c.desc.test(d)) under.push(`${id} silent on [${c.k}]`);
    for (const c of CLAIMS) if (c.desc.test(d) && !c.code.test(src) && !c.code.test(ctx)) over.push(`${id} claims [${c.k}] unsupported`);
    const n = numAudit(id, d);
    if (n.length) num.push(`${id}: ${n.join(', ')}`);
  }
  return { total: Object.keys(S).length, under, over, num, selfTest };
});

await browser.close();
server.kill();

const bad = [];
console.log(`skills audited: ${R.total}`);
console.log(`self-test: injected lies caught ${R.selfTest.caught.length}/4, real descriptions clean: ${R.selfTest.controlClean}`);
if (R.selfTest.caught.length < 4 || !R.selfTest.controlClean) {
  bad.push('SELF-TEST FAILED - the audit is not trustworthy on this run');
}
for (const [label, list] of [['UNDER-DOCUMENTED', R.under], ['OVER-PROMISED', R.over], ['NUMERIC MISMATCH', R.num]]) {
  console.log(`\n${label}: ${list.length}`);
  for (const x of list) { console.log('   ' + x); bad.push(`${label}: ${x}`); }
}
console.log(`\npage errors: ${errs.length}`);
console.log(bad.length ? `\nFAIL - ${bad.length} issue(s)` : '\nPASS - every description matches the code');
process.exit(bad.length ? 1 : 0);
