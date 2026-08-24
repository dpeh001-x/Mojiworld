#!/usr/bin/env node
// Per user: the Ice Spike rune circle "seems to be disjointed from my
// character when using the skill in underwater maps", and it should "stick
// with my character regardless of the map".
//
// Underwater maps (Coral Reef Depths, Abyssal Trench) are isVerticalTower, so
// game.camera.y is non-zero. drawGame applies ctx.translate(0, -camera.y) at
// line ~130655 and never restores before drawParticles -> drawFlameTrail, where
// the ring is drawn. The ring then subtracts camera.y AGAIN, so it lands
// camera.y px above the player. On flat maps camera.y is 0 and there is no
// symptom, which is why this only shows up underwater.
//
// This measures the ring's true DEVICE-space centre (by reading the live
// transform at the moment of its drawImage) against the player's device-space
// centre, on a vertical map and a flat one.
//
//   node scripts/ice_ring_anchor_test.mjs [file.html]
import { chromium } from 'playwright-core';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const FILE = process.argv.slice(2).find((a) => !a.startsWith('--')) || 'mojiworld_game.html';
const URL = 'file:///' + path.join(ROOT, FILE).split(path.sep).join('/');

const browser = await chromium.launch({ channel: 'msedge', args: ['--allow-file-access-from-files'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
await page.goto(URL + '?dev=1', { waitUntil: 'domcontentloaded' });
await page.waitForFunction(() => typeof loadMap === 'function', { timeout: 90000 });

const out = await page.evaluate(async () => {
  window._lxBootGateDone = true;
  try { const bo = document.getElementById('loading-overlay'); if (bo) bo.remove(); } catch (e) {}
  try { await Promise.race([window._lxNpcSpritesReady || Promise.resolve(), new Promise(r => setTimeout(r, 20000))]); } catch (e) {}

  const c = document.getElementById('game') || document.querySelector('canvas');
  const g = c.getContext('2d');
  const orig = g.drawImage.bind(g);
  const seen = { ring: null };
  // Capture the ring's centre in DEVICE space: apply the live transform to the
  // draw's own centre point, so any enclosing translate is included.
  g.drawImage = function (...a) {
    try {
      if (a[0] && LX_FX && a[0] === LX_FX.ice_spike_ring && a.length === 5) {
        const m = g.getTransform();
        const cx = a[1] + a[3] / 2, cy = a[2] + a[4] / 2;
        seen.ring = { x: m.a * cx + m.c * cy + m.e, y: m.b * cx + m.d * cy + m.f };
      }
    } catch (e) {}
    return orig(...a);
  };
  // The player's device centre, measured the same way drawPlayer positions it:
  // X has camera.x subtracted per-entity, Y is raw world-Y because the frame
  // loop's ctx.translate(0, -camera.y) already carries the vertical scroll.
  // (Subtracting camera.x here matters: an earlier run of this test omitted it
  // and reported a bogus dx of -1134 on a flat map.)
  const playerDeviceCentre = () => {
    const m = g.getTransform();
    const cx = player.x + player.w / 2 - game.camera.x;
    const cy = player.y + player.h / 2;
    return { x: m.a * cx + m.c * cy + m.e, y: m.b * cx + m.d * cy + m.f };
  };
  let playerAt = null;
  const origPlayer = window.drawPlayer;
  window.drawPlayer = function (...a) { playerAt = playerDeviceCentre(); return origPlayer.apply(this, a); };

  const run = async (map, label) => {
    loadMap(map);
    player.cls = 'mage'; player.level = 60; player._god = true; game.paused = false;
    // Drop the player deep enough that the vertical camera actually scrolls.
    const md = game.mapData || {};
    if (md.isVerticalTower && md.worldHeight) {
      player.y = Math.max(0, md.worldHeight - 700);
      player.x = 600;
    }
    for (let i = 0; i < 40; i++) await new Promise((r) => requestAnimationFrame(r));
    seen.ring = null; playerAt = null;
    player._iceRingUntil = (game.time | 0) + 48;     // the flag castSkill('iceSpike') sets
    for (let i = 0; i < 6; i++) await new Promise((r) => requestAnimationFrame(r));
    return { label, map, camY: Math.round(game.camera.y || 0),
             vertical: !!md.isVerticalTower,
             ring: seen.ring ? { x: Math.round(seen.ring.x), y: Math.round(seen.ring.y) } : null,
             player: playerAt ? { x: Math.round(playerAt.x), y: Math.round(playerAt.y) } : null };
  };

  const res = [];
  res.push(await run('coralReef', 'Coral Reef Depths (underwater, vertical)'));
  res.push(await run('forest', 'Forest (flat, control)'));
  return res;
});
await browser.close();

console.log('\n  ' + FILE + '\n');
console.log('  ' + 'scene'.padEnd(42) + 'camera.y'.padStart(9) + 'ring dy vs player'.padStart(20));
let fail = 0, checked = 0;
for (const r of out) {
  if (!r.ring || !r.player) {
    console.log('  ' + r.label.padEnd(42) + '   ring or player never drew — INCONCLUSIVE');
    fail++; continue;
  }
  const dy = r.ring.y - r.player.y;
  const dx = r.ring.x - r.player.x;
  checked++;
  const bad = Math.abs(dy) > 4 || Math.abs(dx) > 4;
  if (bad) fail++;
  console.log('  ' + r.label.padEnd(42) + String(r.camY).padStart(9) +
              ('dx ' + dx + ', dy ' + dy).padStart(20) + (bad ? '   <-- DETACHED' : '   ok'));
}
// Structural guard for the whole class. drawFlameTrail runs inside the frame
// loop's ctx.translate(0, -camera.y), so NOTHING in it may subtract camera.y.
// The runtime check above only exercises the ice ring; this covers its four
// siblings — the two Phantom Waltz ripples, the Mirror Step decoy and the flame
// patches — without needing each one staged in a live scene.
const srcTxt = readFileSync(path.join(ROOT, FILE), 'utf8');
const fnStart = srcTxt.indexOf('function drawFlameTrail()');
const fnEnd = srcTxt.indexOf('function drawParticles()', fnStart);
if (fnStart < 0 || fnEnd < 0) { console.error('\nFAIL — could not isolate drawFlameTrail.'); process.exit(1); }
const offenders = srcTxt.slice(fnStart, fnEnd).split('\n')
  .map((l, i) => [i, l])
  .filter(([, l]) => !l.trim().startsWith('//') &&
    /-\s*(\(game\.camera\.y\s*\|\|\s*0\)|camY\b|game\.camera\.y\b)/.test(l));
console.log('\n  drawFlameTrail lines subtracting camera.y (must be none): ' + offenders.length);
for (const [i, l] of offenders.slice(0, 6)) console.log('    +' + i + '  ' + l.trim().slice(0, 92));
if (offenders.length) fail++;

if (!checked) { console.error('\nFAIL — nothing was measured.'); process.exit(1); }
if (fail) { console.error('\nFAIL — the ring is not centred on the player.'); process.exit(1); }
console.log('\nPASS — the ring is centred on the player on every map tested.');
