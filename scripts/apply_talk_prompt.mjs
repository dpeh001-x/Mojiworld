// The NPC interact prompt: a semi-translucent pill with a key-cap N and a Talk
// label, fading in and out, instead of bare yellow text.
// =============================================================================
// Per user (screenshot of the prompt): "The N talk should be much more
// aesthetically designed - make it semi translucent, do not clobber other
// parallel agents".
//
// WAS: fillText('[N] Talk') in bold 12px #ffdd44 with a 3 px sine bob, drawn
// the frame the player comes within 70 px and gone the frame they leave.
//
// NOW: _drawTalkPrompt - a pill (radius = half height) filled at 0.5 alpha in
// the name plate's ink, a 1 px border in the NPC's own tint at 0.75 with a
// wider 0.16 halo stroke outside it, a key cap on the left (rounded square,
// white at 0.18, a 0.55 white rim, a darker bottom edge so it reads as a key)
// carrying a bold N, and "Talk" in the plate's cream with a 1 px shadow. The
// bob stays (2.5 px), the whole thing breathes 0.9-1.0, and it eases in and
// out over ~8 frames on npc._talkA instead of popping. Label width is measured
// once and cached. The chest "[N] Open" and portal "[^] Enter" prompts are not
// touched - only the NPC prompt was asked for.
//
// Guarded + atomic + idempotent. EOL-aware.
import { readFileSync, writeFileSync, renameSync, statSync } from 'node:fs';
const F = 'C:/Users/dpeh0/Mojiworld/mojiworld_game.html';
let s = readFileSync(F, 'utf8');
const n0 = s.length;
if (s.includes('_drawTalkPrompt')) { console.log('already applied'); process.exit(0); }
const crlf = (s.match(/\r\n/g) || []).length, lf = (s.match(/\n/g) || []).length;
const EOL = crlf > lf / 2 ? '\r\n' : '\n';
const J = (...L) => L.join(EOL);
const sub = (label, anchor, after, expect) => {
  const c = s.split(anchor).length - 1;
  if (c !== (expect || 1)) { console.error(`ABORT ${label}: anchor matched ${c}, expected ${expect || 1}`); process.exit(1); }
  s = s.split(anchor).join(after);
};

// ---- 1. the drawer, placed just before drawNPCs -------------------------------
sub('drawer', 'function drawNPCs() {',
  J('// v0.30.599 talk-prompt - the NPC interact prompt (per user: "much more aesthetically',
    '// designed, make it semi translucent"). A pill at half alpha in the name plate\'s ink,',
    '// bordered in the NPC\'s tint with a soft halo, a key cap carrying the N, and "Talk"',
    '// in the plate\'s cream. Bobs, breathes, and eases in and out on `a` (0..1).',
    'function _drawTalkPrompt(cx, y, npc, a) {',
    '  const t = Math.sin(game.time * 0.12) * 2.5;',
    '  const breathe = 0.9 + Math.sin(game.time * 0.2) * 0.1;',
    "  const tint = (npc && npc.color) || '#886bb8';",
    '  ctx.save();',
    '  ctx.globalAlpha = Math.max(0, Math.min(1, a)) * breathe;',
    "  ctx.font = '600 11px \"Segoe UI\", system-ui, sans-serif';",
    "  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';",
    "  if (window._lxTalkLabelW == null) window._lxTalkLabelW = Math.ceil(ctx.measureText('Talk').width);",
    '  const cap = 16, gap = 6, pad = 8, h = 22, r = h / 2;',
    '  const w = pad + cap + gap + window._lxTalkLabelW + pad;',
    '  const x0 = Math.round(cx - w / 2), y0 = Math.round(y - h / 2 + t);',
    '  const pill = () => {',
    '    ctx.beginPath();',
    '    ctx.moveTo(x0 + r, y0);',
    '    ctx.lineTo(x0 + w - r, y0); ctx.arc(x0 + w - r, y0 + r, r, -Math.PI / 2, Math.PI / 2);',
    '    ctx.lineTo(x0 + r, y0 + h); ctx.arc(x0 + r, y0 + r, r, Math.PI / 2, Math.PI * 1.5);',
    '    ctx.closePath();',
    '  };',
    '  // halo, then the translucent body, then the tinted rim',
    '  pill(); ctx.strokeStyle = tint; ctx.lineWidth = 4; ctx.globalAlpha *= 0.16; ctx.stroke(); ctx.globalAlpha /= 0.16;',
    "  pill(); ctx.fillStyle = 'rgba(14,8,26,0.5)'; ctx.fill();",
    '  ctx.strokeStyle = tint; ctx.lineWidth = 1; ctx.globalAlpha *= 0.75; ctx.stroke(); ctx.globalAlpha /= 0.75;',
    '  // key cap: a rounded square with a rim and a darker bottom edge',
    '  const kx = x0 + pad, ky = y0 + (h - cap) / 2, kr = 4;',
    '  ctx.beginPath();',
    '  ctx.moveTo(kx + kr, ky); ctx.lineTo(kx + cap - kr, ky); ctx.quadraticCurveTo(kx + cap, ky, kx + cap, ky + kr);',
    '  ctx.lineTo(kx + cap, ky + cap - kr); ctx.quadraticCurveTo(kx + cap, ky + cap, kx + cap - kr, ky + cap);',
    '  ctx.lineTo(kx + kr, ky + cap); ctx.quadraticCurveTo(kx, ky + cap, kx, ky + cap - kr);',
    '  ctx.lineTo(kx, ky + kr); ctx.quadraticCurveTo(kx, ky, kx + kr, ky); ctx.closePath();',
    "  ctx.fillStyle = 'rgba(255,255,255,0.18)'; ctx.fill();",
    "  ctx.strokeStyle = 'rgba(255,255,255,0.55)'; ctx.lineWidth = 1; ctx.stroke();",
    "  ctx.strokeStyle = 'rgba(0,0,0,0.35)'; ctx.beginPath(); ctx.moveTo(kx + kr, ky + cap - 0.5); ctx.lineTo(kx + cap - kr, ky + cap - 0.5); ctx.stroke();",
    "  ctx.font = 'bold 10px \"Segoe UI\", system-ui, sans-serif';",
    "  ctx.fillStyle = '#ffffff'; ctx.fillText('N', kx + cap / 2, ky + cap / 2 + 0.5);",
    '  // the label, with a 1 px shadow like the name plate',
    "  ctx.font = '600 11px \"Segoe UI\", system-ui, sans-serif';",
    '  const lx = kx + cap + gap + window._lxTalkLabelW / 2;',
    "  ctx.fillStyle = 'rgba(0,0,0,0.6)'; ctx.fillText('Talk', lx, y0 + h / 2 + 1);",
    "  ctx.fillStyle = '#ffe7a3'; ctx.fillText('Talk', lx, y0 + h / 2);",
    '  ctx.restore();',
    '}',
    'function drawNPCs() {'));

// ---- 2. the call site: ease in and out, draw while visible --------------------
sub('call site',
  J('    if (near) {',
    '      const t = Math.sin(game.time * 0.15) * 3;',
    "      ctx.fillStyle = '#ffdd44';",
    "      ctx.font = 'bold 12px sans-serif';",
    "      ctx.fillText('[N] Talk', cx, labelHeadY - 36 + t);",
    '    }'),
  J('    // v0.30.599 talk-prompt - eases in and out over ~8 frames instead of popping (see _drawTalkPrompt)',
    '    npc._talkA = Math.max(0, Math.min(1, (npc._talkA || 0) + (near ? 0.12 : -0.12)));',
    '    if (npc._talkA > 0.02) _drawTalkPrompt(cx, labelHeadY - 40, npc, npc._talkA);'));

// ---- 3. the quest marker lifts clear of the pill while the prompt is up -------
sub('marker lift', '      const qy = labelHeadY - (near ? 52 : 38) + qBob;',
  '      const qy = labelHeadY - (near ? 64 : 38) + qBob;   // v0.30.599 talk-prompt - the pill (22 px tall, centred at -40) needs the extra 12');

const grew = s.length - n0;
if (grew < 2500 || grew > 6500) { console.error(`ABORT: content moved ${grew}`); process.exit(1); }
writeFileSync(F + '.tmp', s, 'utf8');
if (statSync(F + '.tmp').size < 1000000) { console.error('ABORT: tmp suspiciously small'); process.exit(1); }
renameSync(F + '.tmp', F);
console.log(`applied: talk prompt - translucent pill, key cap, fade in/out (+${grew}, EOL ${EOL === '\r\n' ? 'CRLF' : 'LF'})`);
