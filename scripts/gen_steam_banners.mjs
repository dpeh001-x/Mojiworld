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
};
const MOB = {
  gravitos: 'Sprites/bosses/gravitos.webp',
  mochi:    'Sprites/monsters/cosmicMochi.webp',
  mushpup:  'Sprites/monsters/mushpup.webp',
  snail:    'Sprites/monsters/snail.webp',
  petalfly: 'Sprites/monsters/petalfly.webp',
};
const LOGO = 'steam/assets/library_logo.png';

// Instructor order is fixed left→right so the colour run reads
// green → silver/red → navy/gold → violet, i.e. warm centre, cool ends.
const LINEUP = [
  { k: 'hong',  bg: 'village' },
  { k: 'will',  bg: 'throne'  },
  { k: 'hera',  bg: 'abode'   },
  { k: 'taiga', bg: 'hood'    },
];

const SIZES = {
  header:             { w: 920,  h: 430,  logo: true  },
  store_capsule_main: { w: 1232, h: 706,  logo: true  },
  library_hero:       { w: 3840, h: 1240, logo: false },
};

const VARIANTS = ['council', 'realms', 'showdown'];

const JOBS = [];
for (const size of Object.keys(SIZES)) {
  for (const v of VARIANTS) {
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
      { ...job, CAST, BG, MOB, LOGO, LINEUP });
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
