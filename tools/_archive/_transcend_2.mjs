// Transcendence · Batch 2 — enhancement-UI integration: the ★10 maxed preview
// becomes the Transcendence panel; transcended gear gets a 🜂 badge in the list.
import { readFile, writeFile } from 'node:fs/promises';
const FILE = new URL('../mojiworld_game.html', import.meta.url);
let src = await readFile(FILE, 'utf8');
const orig = src;

const OLD_MAXED = `    if (s >= MAX_STARS) {
      prev.style.display = 'block';
      prev.innerHTML = \`<div style="display:flex; justify-content:flex-end; margin-bottom:2px;"><button id="enhance-preview-close" title="Close preview" aria-label="Close preview" style="background:rgba(255,255,255,0.08); border:1px solid rgba(255,255,255,0.18); color:#dfe4ec; width:22px; height:22px; border-radius:50%; font-size:13px; line-height:1; cursor:pointer; display:flex; align-items:center; justify-content:center; padding:0;">✕</button></div>
        <div style="text-align:center;color:#ff99dd;font-weight:bold;">✦ This item is at the maximum ★\${MAX_STARS} enhancement ✦</div>\`;
      const _cb = document.getElementById('enhance-preview-close');
      if (_cb) _cb.onclick = () => renderEnhancementModal(null);
      return;
    }`;

const NEW_MAXED = `    if (s >= MAX_STARS) {
      // v0.26.836 — ★10 preview is now the TRANSCENDENCE panel (or the
      // final-form notice if this piece already transcended).
      prev.style.display = 'block';
      const _tHave = player.setshards || 0;
      const _tAfford = _tHave >= TRANSCEND_COST;
      const _tKeep = Math.pow(STAR_GROWTH, MAX_STARS) * 0.5;
      const _tPeak = Math.round((_tKeep * Math.pow(STAR_GROWTH, MAX_STARS) - 1) * 100);
      const _tBody = selectedItem.transcended
        ? \`<div style="text-align:center; margin-top:8px; padding:8px 10px; border-radius:6px; background:linear-gradient(90deg, rgba(255,120,60,0.14), rgba(190,90,255,0.14)); border:1px solid rgba(255,150,90,0.45); color:#ffc9a3; font-weight:bold;">🜂 TRANSCENDED — this equipment has reached its final form.</div>\`
        : \`<div style="margin-top:8px; padding:8px 10px; border-radius:6px; background:linear-gradient(90deg, rgba(255,120,60,0.12), rgba(190,90,255,0.12)); border:1px solid rgba(255,150,90,0.40);">
            <div style="font-weight:bold; color:#ffb380; letter-spacing:1px; margin-bottom:4px;">🜂 TRANSCENDENCE</div>
            <div style="font-size:11px; color:#e8d8cc; line-height:1.5;">
              • Resets to ★0 — but keeps <b>50% of its current ★\${MAX_STARS} stats as new BASE stats</b> (≈ +\${Math.round((_tKeep - 1) * 100)}% over the original base).<br>
              • Forged back to ★\${MAX_STARS}, it peaks at <b style="color:#ffd9a0;">~+\${_tPeak}%</b> — beyond today's cap.<br>
              • <b>Once per equipment.</b> Irreversible.
            </div>
            <div style="margin:6px 0 8px; font-size:11px; color:\${_tAfford ? '#cfd4dc' : '#ff8888'};">Cost: ◈ \${TRANSCEND_COST.toLocaleString()} setshards \${_tAfford ? \`(you have \${_tHave.toLocaleString()}◈)\` : \`(need \${(TRANSCEND_COST - _tHave).toLocaleString()}◈ more — you have \${_tHave.toLocaleString()}◈)\`}</div>
            <button class="enhance-btn" id="do-transcend" \${_tAfford ? '' : 'disabled'} style="background:linear-gradient(180deg, rgba(220,110,60,0.85), rgba(150,60,180,0.85));">\${_tAfford ? \`🜂 Transcend (\${TRANSCEND_COST}◈)\` : 'Not enough Setshards'}</button>
          </div>\`;
      prev.innerHTML = \`<div style="display:flex; justify-content:flex-end; margin-bottom:2px;"><button id="enhance-preview-close" title="Close preview" aria-label="Close preview" style="background:rgba(255,255,255,0.08); border:1px solid rgba(255,255,255,0.18); color:#dfe4ec; width:22px; height:22px; border-radius:50%; font-size:13px; line-height:1; cursor:pointer; display:flex; align-items:center; justify-content:center; padding:0;">✕</button></div>
        <div style="text-align:center;color:#ff99dd;font-weight:bold;">✦ This item is at the maximum ★\${MAX_STARS} enhancement ✦</div>\` + _tBody;
      const _cb = document.getElementById('enhance-preview-close');
      if (_cb) _cb.onclick = () => renderEnhancementModal(null);
      const _tb = document.getElementById('do-transcend');
      if (_tb) _tb.onclick = () => transcendItem(selectedItem);
      return;
    }`;

const reps = [
  { old: OLD_MAXED, neu: NEW_MAXED },
  // 🜂 badge on transcended gear in the item grid (next to the equipped "E" glyph)
  { old: `      + (entry.equipped ? '<div style="position:absolute; bottom:1px; left:3px; font-size:8px; font-weight:800; color:#88ff88; text-shadow:0 0 3px #000;">E</div>' : '')`,
    neu: `      + (entry.equipped ? '<div style="position:absolute; bottom:1px; left:3px; font-size:8px; font-weight:800; color:#88ff88; text-shadow:0 0 3px #000;">E</div>' : '')
      + (it.transcended ? '<div style="position:absolute; top:1px; left:3px; font-size:9px; font-weight:800; color:#ffb380; text-shadow:0 0 4px #000;" title="Transcended">🜂</div>' : '')` },
  { old: `    div.title = (it.name || 'Item') + (entry.equipped ? ' [Equipped]' : '') + ' · ★' + s + (s >= MAX_STARS ? ' (MAX)' : '');`,
    neu: `    div.title = (it.name || 'Item') + (entry.equipped ? ' [Equipped]' : '') + ' · ★' + s + (s >= MAX_STARS ? ' (MAX)' : '') + (it.transcended ? ' · 🜂 Transcended' : '');` },
];

let n = 0;
for (const { old, neu } of reps) {
  const c = src.split(old).length - 1;
  if (c !== 1) { console.error('FAIL: expected 1, got ' + c + ' for: ' + old.slice(0, 60) + '...'); process.exit(2); }
  src = src.replace(old, neu); n++;
}
if (src === orig) { console.error('no change'); process.exit(3); }
await writeFile(FILE, src, 'utf8');
console.log('OK: ' + n + ' UI edits applied.');
