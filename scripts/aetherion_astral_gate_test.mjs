// AETHERION — the ASTRAL set plays in form 1's Astral Judgement, and nowhere else.
// ============================================================================
// Per user: "this sprite should only play in aetherion's 1st form when doing
// his ultimate special attack".
//
// Two gates have to hold together:
//   FORM    _aetherionAstralKey returns 'aetherion2astral' once _aetherionEvolved
//           is set (at 50% HP, which also swaps _phaseSprite to 'aetherion2').
//           No such art ships, so the frame picker must come back null and the
//           boss must fall through to his form-2 attack pose.
//   PATTERN the key is only stamped while patternState === 'astral'. Aetherion
//           rolls astral against volley / tear / rain / beam / teleport /
//           deathOrbs, so every one of those must leave the set alone.
//
// This reads m._aeAstralKey, which the REAL draw path stamps every frame, so it
// measures what the renderer actually chose rather than re-deriving the rule.
// Run: node scripts/aetherion_astral_gate_test.mjs
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);
const { chromium } = require('playwright-core');
const PORT = Number(process.env.PORT || 9993);
const server = spawn(process.execPath, [path.join(ROOT, 'serve.js'), String(PORT)], { stdio: 'ignore' });
await new Promise(r => setTimeout(r, 1200));
const browser = await chromium.launch({
  channel: process.env.MOJI_PW_EXE ? undefined : 'msedge',
  executablePath: process.env.MOJI_PW_EXE || undefined,
  headless: true,
});
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
await page.goto(`http://localhost:${PORT}/${process.env.MOJI_GAME_FILE || 'mojiworld_game.html'}`,
  { waitUntil: 'load', timeout: 60000 });
await page.waitForTimeout(9000);
await page.evaluate(() => { const lo = document.getElementById('loading-overlay'); if (lo) lo.classList.add('fade'); });
await page.fill('#hero-name-input', 'Astral');
await page.evaluate(() => {
  const m = document.getElementById('class-select-modal');
  for (const el of m.querySelectorAll('button,div,li')) {
    if (el.children.length > 3) continue;
    if (getComputedStyle(el).display === 'none') continue;
    if (/^\s*mage\s*$/i.test((el.textContent || '').trim())) { el.click(); return; }
  }
});
await page.click('#cs-nav-next').catch(() => {});
await page.waitForTimeout(2500);
await page.evaluate(() => { player.level = 99; player._god = true; loadMap('forest', 300); });
await page.waitForTimeout(5000);

const R = await page.evaluate(async () => {
  game.paused = false;
  const frame = () => new Promise(r => requestAnimationFrame(r));
  const keep = () => {
    player.hp = getMaxHp(); player.invulnerable = 600; game.paused = false;
    for (let i = 0; i < 6; i++) { const r = (typeof _lxPadModalRoot === 'function') && _lxPadModalRoot(); if (!r) break; r.style.display = 'none'; }
  };
  keep();
  const out = { astralArt: 0, form2Art: 0 };
  out.astralArt = (typeof BOSS_ATTACK_FRAMES !== 'undefined' && BOSS_ATTACK_FRAMES.aetherionastral)
    ? BOSS_ATTACK_FRAMES.aetherionastral.length : 0;
  out.form2Art = (typeof BOSS_ATTACK_FRAMES !== 'undefined' && BOSS_ATTACK_FRAMES.aetherion2astral)
    ? BOSS_ATTACK_FRAMES.aetherion2astral.length : 0;

  game.monsters.length = 0;
  const boss = spawnMonster(player.x + 300, player.y - 60, 'aetherion', true);
  if (!boss) return out;
  boss.atk = 0;
  // let the set decode so the picker is not just reporting "not ready yet"
  const t0 = performance.now();
  while (performance.now() - t0 < 6000) {
    const f = BOSS_ATTACK_FRAMES.aetherionastral;
    let n = 0; while (f && n < f.length && f[n] && f[n].complete && f[n].naturalWidth > 0) n++;
    if (f && n === f.length && f.length) break;
    keep(); await frame();
  }
  out.decoded = (() => {
    const f = BOSS_ATTACK_FRAMES.aetherionastral;
    let n = 0; while (f && n < f.length && f[n] && f[n].complete && f[n].naturalWidth > 0) n++;
    return n;
  })();

  // Observe the key the real draw path stamps, for a given form + pattern.
  const probe = async (evolved, pattern) => {
    boss._aetherionEvolved = !!evolved;
    boss._phaseSprite = evolved ? 'aetherion2' : null;
    boss.currentHp = evolved ? Math.floor(boss.maxHp * 0.4) : boss.maxHp;
    // _aeAstralKey is only rewritten when the boss is actually DRAWN, so a
    // value survives frames where he is culled — and the previous probe's
    // result then leaks into this one. (It did: form 2 reported the form-1 key
    // that form 1's probe had left behind.) Poison the field before each frame
    // and discard any sample where the draw did not overwrite it, so every
    // reading provably comes from the frame it is attributed to.
    const SENTINEL = '__not_drawn__';
    let seen = new Set(), drawn = 0;
    const t = performance.now();
    while (performance.now() - t < 900) {
      boss.patternState = pattern;
      boss.patternTimer = 300;                       // inside the telegraph
      boss.atkAnimUntil = performance.now() + 400;   // _bossAttacking true
      boss._aeAstralKey = SENTINEL;
      keep();
      await frame();
      if (boss._aeAstralKey === SENTINEL) continue;  // not drawn this frame
      drawn++;
      seen.add(boss._aeAstralKey || null);
    }
    return { drawn, keys: [...seen].map(v => v === null ? 'null' : v).sort().join(',') || '(never drawn)' };
  };

  out.f1_astral = await probe(false, 'astral');
  out.f2_astral = await probe(true, 'astral');
  out.f1_others = {};
  for (const p of ['volley', 'tear', 'rain', 'beam', 'teleport', 'deathOrbs', 'idle']) {
    out.f1_others[p] = await probe(false, p);
  }
  return out;
});
await browser.close(); server.kill();

const res = [];
const ok = (n, c, extra) => res.push({ n, pass: !!c, extra: extra === undefined ? '' : String(extra).slice(0, 210) });

console.log(`  aetherionastral frames: ${R.astralArt} (decoded ${R.decoded})   aetherion2astral frames: ${R.form2Art}`);
console.log(`  form 1 + astral -> ${R.f1_astral.keys}   (drawn ${R.f1_astral.drawn} frames)`);
console.log(`  form 2 + astral -> ${R.f2_astral.keys}   (drawn ${R.f2_astral.drawn} frames)`);
console.log(`  form 1, other patterns -> ${Object.entries(R.f1_others).map(([k,v])=>k+":"+v.keys).join(", ")}`);

ok('the astral set exists and decodes', R.astralArt > 0 && R.decoded === R.astralArt,
   `${R.decoded}/${R.astralArt} frames decoded`);
// The requirement is 'only there', not 'on every frame there'. Aetherion's own
// AI advances patternTimer and can leave the cast mid-probe, so some frames in
// the window legitimately read null; demanding 100% failed a correct build.
ok('FORM 1 + Astral Judgement plays the astral set',
   /(^|,)aetherionastral(,|$)/.test(R.f1_astral.keys) && R.f1_astral.drawn > 5,
   `keys seen: ${R.f1_astral.keys} over ${R.f1_astral.drawn} drawn frames`);
ok('FORM 2 does NOT play it', R.f2_astral.keys === 'null' && R.f2_astral.drawn > 5,
   `key in form 2: ${R.f2_astral.keys} over ${R.f2_astral.drawn} drawn frames (aetherion2astral has ${R.form2Art} frames, so it must fall back)`);
const others = Object.entries(R.f1_others || {});
const leaked = others.filter(([, v]) => v.keys !== 'null').map(([k]) => k);
ok('no OTHER form-1 pattern plays it', leaked.length === 0,
   leaked.length ? 'leaked on: ' + leaked.join(', ') : `clean across ${others.length} patterns`);
ok('CONTROL: the probe can tell the two apart', R.f1_astral.keys !== R.f2_astral.keys,
   'if these matched, the test could not distinguish a gate from a no-op');

let bad = 0;
for (const r of res) { if (!r.pass) bad++; console.log(`${r.pass ? 'PASS' : 'FAIL'}  ${r.n}${r.extra ? '   [' + r.extra + ']' : ''}`); }
console.log(bad ? `\n${bad}/${res.length} FAILED` : `\nall ${res.length} passed`);
process.exit(bad ? 1 : 0);
