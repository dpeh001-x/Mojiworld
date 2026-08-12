// Steam store art generator — composes banners from live game assets.
//
// Renders at the exact Steam dimensions through headless Chrome's canvas and
// writes PNGs to steam/assets/gen/. Nothing is overwritten in steam/assets/
// itself; picking a winner is a manual copy.
//
//   header              920 x 430    (logo baked in)
//   store_capsule_main 1232 x 706    (logo baked in)
//   library_hero       3840 x 1240   (NO logo — Steam overlays library_logo)
//
// Run: node scripts/gen_steam_banners.mjs [variantFilter]
import { createRequire } from 'node:module';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);
const { chromium } = require('playwright-core');
const OUT = path.join(ROOT, 'steam', 'assets', 'gen');
fs.mkdirSync(OUT, { recursive: true });
const FILTER = process.argv[2] || '';

// ── the cast, straight from the game ────────────────────────────────────────
const NPC = (f) => 'Sprites/npc/' + encodeURIComponent(f);
const CAST = {
  will:  NPC('will.webp'),        // warrior instructor — Bastion Throne
  hera:  NPC('hera.webp'),        // mage instructor    — Floating Abode
  hong:  NPC('Lady Hong.webp'),   // archer instructor  — Emerald Village
  taiga: NPC('Taiga.webp'),       // rogue instructor   — Shadow-Woven Hood
};
const BG = {
  throne:   'backgrounds/bg_v3_bastionThrone.webp',
  abode:    'backgrounds/bg_v3_azureAbode.webp',
  village:  'backgrounds/bg_v3_emeraldVillage.webp',
  hood:     'backgrounds/bg_v3_shadowWovenHood.webp',
  central:  'backgrounds/bg_v3_everdawn_central.webp',
  celestial:'backgrounds/bg_v3_celestialAtrium.webp',
  // dark plates for the page background
  arena:    'backgrounds/bg_v3_gravitosArena.webp',
  inner:    'backgrounds/bg_v3_innerDimension.webp',
  aetherion:'backgrounds/bg_v3_aetherion.webp',
};
const MOB = {
  gravitos: 'Sprites/bosses/gravitos.webp',
  mochi:    'Sprites/monsters/cosmicMochi.webp',
  mushpup:  'Sprites/monsters/mushpup.webp',
  snail:    'Sprites/monsters/snail.webp',
  petalfly: 'Sprites/monsters/petalfly.webp',
};
const LOGO = 'steam/assets/library_logo.png';

// The zodiac bosses, in wheel order. A zodiac IS a set of constellations, so
// this is the one cast in the game that can carry a star-chart background
// without the conceit feeling bolted on.
const ZODIAC = ['aries', 'taurus', 'gemini', 'cancer', 'leo', 'virgo',
                'libra', 'scorpio', 'sagittarius', 'capricorn', 'aquarius', 'pisces']
  .reduce((m, z) => (m[z] = `Sprites/bosses/zodiac/${z}.webp`, m), {});

// Instructor order is fixed left→right so the colour run reads
// green → silver/red → navy/gold → violet, i.e. warm centre, cool ends.
const LINEUP = [
  { k: 'hong',  bg: 'village' },
  { k: 'will',  bg: 'throne'  },
  { k: 'hera',  bg: 'abode'   },
  { k: 'taiga', bg: 'hood'    },
];

// Each size carries its own variant list — a store PAGE BACKGROUND is a
// different job from a capsule and shares none of the same rules. Steam lays
// the store page's ~940px content column over the middle of it, so a page
// background must be dark, quiet through the centre, and keep whatever
// interest it has out in the side margins. Capsule compositions do the exact
// opposite, which is why they are not reused here.
const SIZES = {
  header:               { w: 920,  h: 430,  logo: true,  variants: ['council', 'realms', 'showdown'] },
  store_capsule_main:   { w: 1232, h: 706,  logo: true,  variants: ['council', 'realms', 'showdown'] },
  library_hero:         { w: 3840, h: 1240, logo: false, variants: ['council', 'realms', 'showdown'] },
  store_page_background:{ w: 1438, h: 810,  logo: false, variants: ['radiant', 'constellation', 'eclipse', 'veil', 'abyss'] },
};

const JOBS = [];
for (const size of Object.keys(SIZES)) {
  for (const v of SIZES[size].variants) {
    if (FILTER && !(`${size}_${v}`).includes(FILTER)) continue;
    JOBS.push({ size, variant: v, ...SIZES[size] });
  }
}

const PORT = 9137;
const server = spawn(process.execPath, [path.join(ROOT, 'serve.js'), String(PORT)], { stdio: 'ignore' });
await new Promise(r => setTimeout(r, 1200));
const browser = await chromium.launch({
  channel: process.env.MOJI_PW_EXE ? undefined : 'msedge',
  executablePath: process.env.MOJI_PW_EXE || undefined,
  headless: true,
});
const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });
page.on('pageerror', e => console.error('  pageerror:', String(e).slice(0, 160)));
await page.goto(`http://localhost:${PORT}/`, { waitUntil: 'domcontentloaded', timeout: 60000 });

const DRAW = fs.readFileSync(path.join(ROOT, 'scripts', 'gen_steam_banners.draw.js'), 'utf8');
await page.addScriptTag({ content: DRAW });

const manifest = [];
for (const job of JOBS) {
  const name = `${job.size}__${job.variant}`;
  process.stdout.write(`  ${name.padEnd(34)} ${job.w}x${job.h} ... `);
  let b64;
  try {
    b64 = await page.evaluate(async (j) => await window.__renderBanner(j),
      { ...job, CAST, BG, MOB, LOGO, LINEUP, ZODIAC });
  } catch (e) {
    console.log('FAIL', String(e).slice(0, 120));
    continue;
  }
  if (!b64) { console.log('FAIL (no data)'); continue; }
  const buf = Buffer.from(b64, 'base64');
  const file = path.join(OUT, name + '.png');
  fs.writeFileSync(file + '.tmp', buf);
  fs.renameSync(file + '.tmp', file);
  console.log(`${(buf.length / 1024).toFixed(0)} KB`);
  manifest.push({ name, w: job.w, h: job.h, bytes: buf.length });
}

await browser.close();
server.kill();
fs.writeFileSync(path.join(OUT, 'MANIFEST.json'), JSON.stringify(manifest, null, 2));
console.log(`\n${manifest.length} written to steam/assets/gen/`);
