// The Void plays backgrounds/thevoid.mp4 as its sky, has no floor band or violet rim, and rests
// the video off the Void. Per user: "use backgrounds/thevoid as a background gif or video for the
// void map (whichever loads faster), remove the purple line floor".
//
//   node scripts/void_backdrop_test.mjs [file.html] [port]
import { createRequire } from 'node:module';
import { existsSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);
const { chromium } = require('playwright-core');
const PAGE = process.argv[2] || 'mojiworld_game.html';
const PORT = Number(process.argv[3] || 11233);
const checks = [];
const VIDEO = path.join(ROOT, 'backgrounds', 'thevoid.mp4');
checks.push(['backgrounds/thevoid.mp4 ships (an mp4, not a gif: streams, hardware-decoded)', existsSync(VIDEO) && statSync(VIDEO).size > 200000 && readFileSync(VIDEO).slice(4, 8).toString('latin1') === 'ftyp', existsSync(VIDEO) ? statSync(VIDEO).size + ' bytes' : 'missing']);
const html = readFileSync(path.join(ROOT, PAGE), 'utf8');
checks.push(['the violet rim and the black band are gone from the void floor path', !/isVoid\)\s*\{\s*ctx\.fillStyle = '#0a0612'/.test(html) && !/isVoid\)[\s\S]{0,200}rgba\(170,119,255,0\.4\)/.test(html) && /isVoid\) continue;/.test(html)]);

const server = spawn(process.execPath, [path.join(ROOT, 'serve.js'), String(PORT)], { stdio: 'ignore' });
await new Promise((r) => setTimeout(r, 1200));
const browser = await chromium.launch({ channel: 'msedge', headless: true, args: ['--no-sandbox', '--mute-audio', '--autoplay-policy=no-user-gesture-required'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
const errs = [], vidReq = [];
page.on('pageerror', (e) => errs.push(String(e.message).slice(0, 120)));
page.on('response', (r) => { if (/thevoid\.mp4/.test(r.url())) vidReq.push(r.status()); });
await page.addInitScript(() => { try { localStorage.setItem('mojiworld_prologue_seen', '1'); } catch (e) {} });
await page.goto(`http://localhost:${PORT}/${PAGE}`, { waitUntil: 'load', timeout: 60000 });
await page.waitForTimeout(9000);
await page.evaluate(() => { const lo = document.getElementById('loading-overlay'); if (lo) lo.classList.add('fade'); });
await page.fill('#hero-name-input', 'Void');
await page.click('#cs-nav-next').catch(() => {});
await page.waitForTimeout(800);
await page.evaluate(() => { const c = document.querySelector('#class-options .class-card'); if (c) c.click(); });
await page.waitForTimeout(1500);
await page.evaluate(() => { loadMap('void', 400); });
await page.waitForTimeout(4000);
// the prologue story beat opens over the Void and pauses the game; click it through so physics
// runs and the hero can settle on the (now invisible) ground
for (let i = 0; i < 14; i++) {
  const open = await page.evaluate(() => { const sb = document.getElementById('story-beat-overlay'); if (sb && getComputedStyle(sb).display !== 'none' && sb.classList.contains('show')) { sb.click(); return true; } return false; });
  if (!open) break;
  await page.waitForTimeout(350);
}
await page.evaluate(() => { game.paused = false; });
await page.waitForTimeout(2500);

const r = await page.evaluate(() => {
  const v = document.getElementById('void-bg-video');
  const cv = document.getElementById('game');
  const c2 = cv.getContext('2d');
  const img = c2.getImageData(0, 0, cv.width, Math.floor(cv.height * 0.6)).data;
  let lit = 0, n = 0;
  for (let i = 0; i < img.length; i += 16) { n++; if (img[i] + img[i + 1] + img[i + 2] > 45) lit++; }
  const ground = (game.mapData.platforms || []).find((p) => p.type === 'ground');
  return {
    map: game.currentMap,
    video: v ? { ready: v.readyState, playing: !v.paused && !v.ended, w: v.videoWidth, h: v.videoHeight, loop: v.loop, muted: v.muted, t: v.currentTime } : null,
    litPct: 100 * lit / n,
    ground: ground ? { y: ground.y, w: ground.w } : null,
    feet: player.y + player.h, onGround: !!player.onGround || Math.abs(player.y + player.h - (ground ? ground.y : -1)) < 3,
    W: W, H: H,
  };
});
await page.evaluate(() => { loadMap('town', 200); });
await page.waitForTimeout(1500);
const after = await page.evaluate(() => { const v = document.getElementById('void-bg-video'); return { map: game.currentMap, paused: v ? v.paused : null }; });
await browser.close(); server.kill();

console.log(`  void: video ${JSON.stringify(r.video)}, lit ${r.litPct.toFixed(1)}% of the upper canvas, ground ${JSON.stringify(r.ground)}, feet ${Math.round(r.feet)}`);
checks.push(['the Void is the current map', r.map === 'void', r.map]);
checks.push(['the sky video exists, is muted, loops, and is playing', !!r.video && r.video.muted && r.video.loop && r.video.playing, JSON.stringify(r.video)]);
checks.push(['it has decoded frames at the drop\'s 832x464', !!r.video && r.video.ready >= 2 && r.video.w === 832 && r.video.h === 464]);
checks.push(['the canvas is no longer black (the video is being painted)', r.litPct > 5, r.litPct.toFixed(1) + '%']);
checks.push(['the ground platform still exists and the hero stands on it', !!r.ground && r.ground.y === 480 && Math.abs(r.feet - 480) < 3, `feet ${Math.round(r.feet)} vs ground ${r.ground && r.ground.y}`]);
checks.push(['the file was served, not 404', vidReq.length > 0 && vidReq.every((s) => s === 200 || s === 206), vidReq.join(',')]);
checks.push(['leaving for town pauses the video', after.map === 'town' && after.paused === true, JSON.stringify(after)]);
checks.push(['no page errors', errs.length === 0, errs.slice(0, 2).join(' | ')]);

let fails = 0;
for (const [n, ok, extra] of checks) { console.log((ok ? 'PASS ' : 'FAIL ') + n + (extra ? '  [' + extra + ']' : '')); if (!ok) fails++; }
console.log(`${checks.length - fails}/${checks.length} passed`);
process.exit(fails ? 1 : 0);
