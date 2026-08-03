#!/usr/bin/env node
// Remove all procedural-CIRCLE fallbacks from enemy/boss projectile renders.
// Every projectile sprite already exists on disk and decodes, so the circle
// fallbacks only flashed during the brief pre-decode window. We drop them so a
// not-yet-decoded projectile draws nothing instead of a procedural circle.
import { readFile, writeFile } from 'node:fs/promises';
const FILE = new URL('../mojiworld_game.html', import.meta.url);
let src = await readFile(FILE, 'utf8');
const orig = src;

const reps = [
  // 1) mspore — orange cluster circles
  {
    old: `        } else {
          // Procedural fallback (orange cluster).
          ctx.fillStyle = 'rgba(255,150,60,0.4)';
          ctx.beginPath(); ctx.arc(cx, cy, p.w * 0.7, 0, Math.PI * 2); ctx.fill();
          ctx.fillStyle = col;
          ctx.beginPath(); ctx.arc(cx, cy, p.w/2, 0, Math.PI * 2); ctx.fill();
          ctx.fillStyle = '#ffdd88';
          ctx.beginPath(); ctx.arc(cx - 2, cy - 2, p.w/4, 0, Math.PI * 2); ctx.fill();
        }`,
    neu: `        }   // procedural circle fallback removed — sprite always present`,
  },
  // 2) mdark — purple bolt circles
  {
    old: `        } else {
          // Procedural fallback (purple bolt).
          ctx.fillStyle = 'rgba(160,60,200,0.45)';
          ctx.beginPath(); ctx.arc(cx, cy, p.w * 0.9, 0, Math.PI * 2); ctx.fill();
          ctx.fillStyle = col;
          ctx.beginPath(); ctx.arc(cx, cy, p.w/2, 0, Math.PI * 2); ctx.fill();
          ctx.fillStyle = '#ff88ff';
          ctx.beginPath(); ctx.arc(cx - 2, cy - 2, p.w/5, 0, Math.PI * 2); ctx.fill();
        }`,
    neu: `        }   // procedural circle fallback removed — sprite always present`,
  },
  // 3) mtoxic — green blob circles
  {
    old: `        } else {
          // Procedural fallback (green blob).
          ctx.fillStyle = 'rgba(80,230,60,0.4)';
          ctx.beginPath(); ctx.arc(cx, cy, p.w * 0.8, 0, Math.PI * 2); ctx.fill();
          ctx.fillStyle = col;
          ctx.beginPath();
          ctx.arc(cx, cy, p.w/2, 0, Math.PI * 2);
          ctx.arc(cx - 3, cy + 2, p.w/3, 0, Math.PI * 2);
          ctx.arc(cx + 3, cy - 1, p.w/3, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillStyle = '#ccffaa';
          ctx.beginPath(); ctx.arc(cx - 2, cy - 3, 2, 0, Math.PI * 2); ctx.fill();
        }`,
    neu: `        }   // procedural circle fallback removed — sprite always present`,
  },
  // 4) shard — glow arc + diamond
  {
    old: `        } else {
          // Procedural fallback (pre-v0.26.172)
          ctx.fillStyle = 'rgba(200,160,255,0.4)';
          ctx.beginPath(); ctx.arc(0, 0, p.w, 0, Math.PI * 2); ctx.fill();
          ctx.fillStyle = '#b090ff';
          ctx.beginPath();
          ctx.moveTo(0, -p.h/2); ctx.lineTo(p.w/2, 0);
          ctx.lineTo(0, p.h/2); ctx.lineTo(-p.w/2, 0);
          ctx.closePath(); ctx.fill();
          ctx.fillStyle = '#e8d8ff';
          ctx.beginPath();
          ctx.moveTo(0, -p.h/2); ctx.lineTo(p.w/3, 0);
          ctx.lineTo(0, p.h/4); ctx.closePath();
          ctx.fill();
        }`,
    neu: `        }   // procedural circle/diamond fallback removed — fx_shard always present`,
  },
  // 5) firebomb — orange circles
  {
    old: `        } else {
          ctx.fillStyle = 'rgba(255,90,30,0.45)';
          ctx.beginPath(); ctx.arc(0, 0, p.w * 0.9, 0, Math.PI * 2); ctx.fill();
          ctx.fillStyle = col;
          ctx.beginPath(); ctx.arc(0, 0, p.w/2, 0, Math.PI * 2); ctx.fill();
          ctx.fillStyle = '#ffdd88';
          ctx.beginPath(); ctx.arc(-p.w/6, -p.w/6, p.w/5, 0, Math.PI * 2); ctx.fill();
        }`,
    neu: `        }   // procedural circle fallback removed — m_firebomb always present`,
  },
  // 6) generic blit — don't fall through to default ellipse during decode
  {
    old: `      } else if (LX_MOB_PROJ[p.skill] && _lxMobProjReady(LX_MOB_PROJ[p.skill]) && _PROJ_SPRITE_BLIT[p.skill]) {`,
    neu: `      } else if (LX_MOB_PROJ[p.skill] && _PROJ_SPRITE_BLIT[p.skill]) {`,
  },
  // 6b) guard the generic drawImage so an undecoded sprite draws nothing (no circle)
  {
    old: `        const r = p.w * (_blit.size || 1.2);
        ctx.drawImage(_sprite, -r, -r, r * 2, r * 2);
        ctx.restore();`,
    neu: `        const r = p.w * (_blit.size || 1.2);
        if (_lxMobProjReady(_sprite)) ctx.drawImage(_sprite, -r, -r, r * 2, r * 2);   // no procedural-circle fallback; skip until decoded
        ctx.restore();`,
  },
];

let n = 0;
for (const { old, neu } of reps) {
  const c = src.split(old).length - 1;
  if (c !== 1) { console.error(`FAIL: expected 1 match, got ${c} for:\n${old.slice(0, 80)}...`); process.exit(2); }
  src = src.replace(old, neu);
  n++;
}
if (src === orig) { console.error('No change'); process.exit(3); }
await writeFile(FILE, src, 'utf8');
console.log(`OK: applied ${n} procedural-circle removals.`);
