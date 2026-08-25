#!/usr/bin/env node
// The generator data/monster_hitboxes.js always claimed to have.
// =============================================================================
// That file's header says "AUTO-GENERATED from the live game (monsterTypes w/h
// + _lxMobScale + BOSS_DRAW_SCALE)" and "Regen: extract from the running game"
// - but no script ever shipped, so it was extracted by hand, once, and has been
// drifting since. Two consequences already found the hard way:
//
//   * the twelve zodiac bosses were absent (they are synthesised at boot, so a
//     source-side extraction could never have seen them)
//   * elderbark, meloncholy, pinechad and thornmaw were absent
//
// A type with no row has no m.h, so monster_animator.html cannot compute a game
// size for it and silently falls back to its 220px preview - the animator then
// shows a number that the game never renders. That is the whole reason this
// matters: the table is what makes the tool's "in-game" label true.
//
// So this reads the RUNTIME, exactly as the header always described:
//     w, h   monsterTypes[type]
//     mul    bosses  BOSS_DRAW_SCALE[type] ?? 2.0
//            mobs    1.5 x _lxMobScale(type)
//     f      FLOATING_TYPES / FLOATING_ZODIAC
//     zmul   _ZODIAC_SPRITE_FX[sign].sizeMul   (zodiac only)
//     dy     _ZODIAC_SPRITE_FX[sign].dyPx      (zodiac only)
//
// IT ASSERTS ONLY WHAT IT CAN PROVE. w/h come straight out of monsterTypes and
// are trustworthy; mul and the floating flag are RECONSTRUCTED here from
// _lxMobScale / FLOATING_TYPES and are not. Measured across 135 rows: zero w/h
// disagree, while 32 differ on mul or f - and one of those is aetherion, which
// this reconstruction calls floating even though the draw path deliberately
// grounded him (v0.25.713). So a missing row is an error, a w/h disagreement is
// an error, and a mul/f difference is not reported at all.
// A missing row is what actually breaks the animator: no row means no m.h,
// which means no game size and a silent fall back to the 220px preview.
//
//   node scripts/gen_mob_hitboxes.mjs            # add any missing rows
//   node scripts/gen_mob_hitboxes.mjs --check    # exit 1 if a row is missing or w/h drifted
// =============================================================================
import { createRequire } from 'node:module';
import { readFileSync, writeFileSync, renameSync } from 'node:fs';
import { execFileSync, spawn } from 'node:child_process';
import { createServer } from 'node:net';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(join(root, 'x.js'));
const { chromium } = require('playwright-core');
const HB_FILE = join(root, 'data', 'monster_hitboxes.js');
const MAN_FILE = join(root, 'data', 'anim_calib_manifest.js');
const CHECK = process.argv.includes('--check');

const EXE = 'C:/Program Files/Google/Chrome/Application/chrome.exe';

const free = (p) => new Promise((r) => {
  const s = createServer();
  s.once('error', () => r(false));
  s.once('listening', () => s.close(() => r(true)));
  s.listen(p, '127.0.0.1');
});
let PORT = null;
for (let p = 8830; p <= 8999 && !PORT; p++) if (await free(p)) PORT = String(p);
const srv = spawn(process.execPath, ['serve.js', PORT], { stdio: 'ignore', cwd: root });
await new Promise((r) => setTimeout(r, 2200));

// which types the animator actually previews - those are the ones that need a row
const manSrc = readFileSync(MAN_FILE, 'utf8');
const MAN = JSON.parse(manSrc.slice(manSrc.indexOf('{'), manSrc.lastIndexOf('};') + 1));
const wanted = Object.keys(MAN);

let live;
const browser = await chromium.launch({ executablePath: EXE, headless: true, args: ['--no-sandbox', '--mute-audio'] });
try {
  const page = await browser.newPage({ viewport: { width: 1200, height: 800 } });
  await page.goto(`http://localhost:${PORT}/mojiworld_game.html`, { waitUntil: 'domcontentloaded', timeout: 120000 });
  await page.waitForFunction(() => typeof monsterTypes !== 'undefined' && !!monsterTypes.snail, null, { timeout: 120000 });
  live = await page.evaluate((types) => {
    const out = {};
    for (const t of types) {
      const mt = monsterTypes[t];
      if (!mt || !(mt.w > 0) || !(mt.h > 0)) continue;
      const isBoss = !!mt.boss;
      const sign = mt.zodiacSign || null;
      const fx = (sign && typeof _ZODIAC_SPRITE_FX !== 'undefined' && _ZODIAC_SPRITE_FX[sign]) || {};
      const mobScale = (!isBoss && typeof _lxMobScale === 'function') ? (+_lxMobScale(t) || 1) : 1;
      const mul = isBoss
        ? ((typeof BOSS_DRAW_SCALE !== 'undefined' && BOSS_DRAW_SCALE[t] != null) ? BOSS_DRAW_SCALE[t] : 2.0)
        : +(1.5 * mobScale).toFixed(3);
      const flies = sign
        ? ((typeof FLOATING_ZODIAC !== 'undefined') && FLOATING_ZODIAC.has(sign))
        : ((typeof FLOATING_TYPES !== 'undefined') && FLOATING_TYPES.has(t));
      const row = { w: mt.w, h: mt.h, mul };
      if (flies) row.f = 1;
      if (+fx.sizeMul > 0 && +fx.sizeMul !== 1) row.zmul = +fx.sizeMul;
      if (+fx.dyPx) row.dy = +fx.dyPx;
      out[t] = row;
    }
    return out;
  }, wanted);
} finally {
  await browser.close();
  srv.kill();
}

const src = readFileSync(HB_FILE, 'utf8');
const win = {};
new Function('window', src)(win);
const have = win.LX_MOB_HITBOX || {};

const fmt = (k, r) => {
  let s = `${k}:{w:${r.w},h:${r.h},mul:${r.mul}`;
  if (r.f) s += ',f:1';
  if (r.zmul) s += `,zmul:${r.zmul}`;
  if (r.dy) s += `,dy:${r.dy}`;
  return s + '}';
};
// only the fields this script can actually vouch for
const same = (a, b) => a && b && a.w === b.w && a.h === b.h;

const missing = Object.keys(live).filter((k) => !have[k]);
const drifted = Object.keys(live).filter((k) => have[k] && !same(have[k], live[k]));
const noType = wanted.filter((k) => !live[k]);

console.log('manifest entities: ' + wanted.length + '   hitbox rows: ' + Object.keys(have).length);
console.log('missing rows : ' + missing.length + (missing.length ? '  -> ' + missing.join(', ') : ''));
console.log('rows whose w/h drifted from the game: ' + drifted.length);
for (const k of drifted) console.log('    ' + k.padEnd(22) + JSON.stringify(have[k]) + '  live ' + JSON.stringify(live[k]));
console.log('no monsterTypes entry (cannot have a row): ' + noType.length + (noType.length ? '  -> ' + noType.slice(0, 12).join(', ') : ''));

if (CHECK) {
  if (missing.length || drifted.length) {
    console.error('\ndata/monster_hitboxes.js is STALE - run: node scripts/gen_mob_hitboxes.mjs');
    process.exit(1);
  }
  console.log('\nevery previewable type has a row, and no w/h has drifted');
  process.exit(0);
}
if (!missing.length && !drifted.length) { console.log('\nnothing to write'); process.exit(0); }

const BEGIN = '// --- added from the live game (scripts/gen_mob_hitboxes.mjs) ---';
const END = '// --- end live-extracted ---';
const write = [...missing, ...drifted];
let out = src;
// refresh in place where the row already exists, append the rest in a block
const appended = [];
for (const k of write) {
  const re = new RegExp('(^|[\\s,])' + k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + ':\\{[^}]*\\}', 'm');
  if (have[k] && re.test(out)) out = out.replace(re, (m, p1) => p1 + fmt(k, live[k]));
  else appended.push(fmt(k, live[k]) + ',');
}
if (appended.length) {
  const block = [BEGIN, ...appended, END].join('\n');
  const i0 = out.indexOf(BEGIN);
  if (i0 >= 0) {
    const i1 = out.indexOf(END, i0);
    out = out.slice(0, i0) + block + out.slice(i1 + END.length);
  } else {
    const close = out.lastIndexOf('};');
    out = out.slice(0, close) + block + '\n' + out.slice(close);
  }
}
const probe = join(root, 'scripts', '_tmp_mob_hb_check.js');
writeFileSync(probe, out, 'utf8');
execFileSync(process.execPath, ['--check', probe], { stdio: 'inherit' });
writeFileSync(HB_FILE + '.tmp', out, 'utf8');
renameSync(HB_FILE + '.tmp', HB_FILE);
console.log('\nwrote ' + write.length + ' row(s) into data/monster_hitboxes.js');
for (const k of write) console.log('   ' + fmt(k, live[k]));
