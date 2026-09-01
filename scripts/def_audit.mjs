#!/usr/bin/env node
// DEF AUDIT — do bosses actually tank harder than the field they sit beside?
// ============================================================================
// Per user: "audit to check regarding DEF discrepancies for bosses for
// monsters that are the similar level as them".
//
// RAW DEF IS THE WRONG NUMBER, and comparing it is how three bosses shipped
// soft without anyone noticing. What the game applies is
//
//     defVal   = def x armourClass x defVariance x variantMul   (boss x2.2)
//     taken%   = 300 / (defVal + 300)
//
// so a boss's headline DEF is multiplied 2.2x while a field mob's is not, and
// the armour ARCHETYPE (soft 0.65x, armoured bone 2.0x, block 2.2x) moves it
// again. Two mobs with identical printed DEF can differ 3x in what they
// actually take. This audit therefore reports EFFECTIVE DAMAGE TAKEN, resolved
// through the live helpers, and compares each boss against the median of the
// non-boss monsters within +/-3 levels of it — the mobs a player fights in the
// same stretch of the game.
//
// Reads the RUNTIME monsterTypes, not the source: the twelve zodiac types are
// synthesised at boot and no source-side parse can see them.
//   node scripts/def_audit.mjs [--json] [--band N]
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);
const { chromium } = require('playwright-core');
const { existsSync } = require('node:fs');
const argv = process.argv.slice(2);
const BAND = Number((argv.find((a) => a.startsWith('--band=')) || '--band=3').split('=')[1]) || 3;
const AS_JSON = argv.includes('--json');
const PORT = Number(process.env.PORT || 9981);
const server = spawn(process.execPath, [path.join(ROOT, 'serve.js'), String(PORT)], { stdio: 'ignore' });
await new Promise((r) => setTimeout(r, 1200));
const EXE = [process.env.PW_EXE, process.env.MOJI_PW_EXE,
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
  '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
  '/usr/bin/google-chrome', '/usr/bin/chromium'].find((p) => p && existsSync(p));
const browser = await chromium.launch({
  channel: EXE ? undefined : 'msedge', executablePath: EXE || undefined,
  headless: true, args: ['--no-sandbox', '--mute-audio'],
});
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
await page.goto(`http://localhost:${PORT}/${process.env.MOJI_GAME_FILE || 'mojiworld_game.html'}?dev=1`,
  { waitUntil: 'domcontentloaded', timeout: 180000 });
await page.waitForFunction(() => typeof monsterTypes === 'object' && typeof _mobArmorClass === 'function',
  null, { timeout: 180000 });
await page.waitForTimeout(6000);

const data = await page.evaluate((band) => {
  const DEF_K = 300;
  // defVariance is a per-INSTANCE roll; the audit wants the archetype's centre,
  // so it is deliberately left at 1 (the midpoint of the spread) rather than
  // sampled — otherwise the same type audits differently on every run.
  const rows = [];
  for (const t in monsterTypes) {
    const M = monsterTypes[t];
    if (!M || typeof M !== 'object') continue;
    // _mobLevel is the game's OWN resolver: an explicit level, else the
    // MOB_NATURAL_LEVEL table, else the map gate. Reading M.level directly
    // found only 16 levelled field mobs out of ~200 and left most bosses with
    // no peers at all — the table is where the field's levels actually live.
    const lv = _mobLevel({ level: M.level, type: t }) | 0;
    if (!lv || lv === 1) continue;           // unresolvable = not placeable on the curve
    const armour = _mobArmorClass({ type: t });
    const isBoss = !!(M.boss || M.superBoss);
    const variant = isBoss ? 2.2 : 1;
    const defVal = (M.def || 0) * armour * variant;
    rows.push({
      type: t, name: M.name || t, lv, def: M.def || 0, hp: M.hp || 0, atk: M.atk || 0,
      armour, isBoss, superBoss: !!M.superBoss,
      defVal: +defVal.toFixed(1),
      taken: +(DEF_K / (defVal + DEF_K)).toFixed(4),   // fraction of damage that lands
    });
  }
  const field = rows.filter((r) => !r.isBoss);
  const med = (a) => { if (!a.length) return null; const s = a.slice().sort((x, y) => x - y); return s[Math.floor(s.length / 2)]; };
  const out = [];
  for (const b of rows.filter((r) => r.isBoss)) {
    const peers = field.filter((f) => Math.abs(f.lv - b.lv) <= band);
    const peerTaken = med(peers.map((p) => p.taken));
    const peerDef = med(peers.map((p) => p.def));
    out.push({
      ...b,
      peers: peers.length,
      peerTaken, peerDef,
      // >1 means the BOSS takes MORE damage per hit than the median field mob
      // it stands beside — i.e. the boss is softer than the trash.
      ratio: peerTaken ? +(b.taken / peerTaken).toFixed(2) : null,
    });
  }
  out.sort((a, b) => (b.ratio || 0) - (a.ratio || 0));
  return { bosses: out, fieldCount: field.length, total: rows.length };
}, BAND);
await browser.close(); server.kill();

if (AS_JSON) { console.log(JSON.stringify(data, null, 1)); process.exit(0); }

const pc = (v) => (v * 100).toFixed(1) + '%';
console.log(`\nDEF AUDIT — ${data.bosses.length} levelled bosses against ${data.fieldCount} levelled field mobs (peer band +/-${BAND} levels)`);
console.log('taken% = share of a hit that actually lands, after def x armour x variant through 300/(def+300).');
console.log('ratio  = boss taken% / median peer taken%.  >1.00 means the BOSS IS SOFTER than the trash beside it.\n');
console.log('ratio   Lv   def   arm   taken%   peers%   boss');
console.log('-----  ---  -----  ----  -------  -------  ----------------------------------');
for (const b of data.bosses) {
  if (b.ratio == null) continue;
  const flag = b.ratio >= 1.30 ? ' <<< SOFTER THAN THE FIELD' : (b.ratio >= 1.00 ? ' <<' : '');
  console.log(
    String(b.ratio).padStart(5) + '  ' +
    String(b.lv).padStart(3) + '  ' +
    String(b.def).padStart(5) + '  ' +
    String(b.armour).padStart(4) + '  ' +
    pc(b.taken).padStart(7) + '  ' +
    pc(b.peerTaken).padStart(7) + '  ' +
    b.name.slice(0, 34) + flag);
}
const soft = data.bosses.filter((b) => b.ratio != null && b.ratio >= 1.00);
console.log(`\n${soft.length} of ${data.bosses.filter((b) => b.ratio != null).length} bosses take at least as much damage per hit as the median field mob of their own level band.`);
