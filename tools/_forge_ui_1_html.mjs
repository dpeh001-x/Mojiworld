// Forge UI redesign · 1/3 — modal HTML: dedicated centre-stage for the anvil
// (item floats above it; success/fail fx plays ON the stage), two-column
// layout (gear rack left · stage + preview right), slim one-line info strip.
import { readFile, writeFile } from 'node:fs/promises';
const FILE = new URL('../mojiworld_game.html', import.meta.url);
let src = await readFile(FILE, 'utf8');
const orig = src;

const OLD = `    <div class="modal" style="position:relative; min-width:640px; max-width:720px; height:540px; max-height:92vh; display:flex; flex-direction:column; justify-content:flex-start; padding-left:90px;">
      <div id="enhance-anvil" aria-hidden="true"></div>
      <!-- v0.26.x — Ludo sprite-animation overlay played on forge success/fail
           (frame-cycled by _playForgeAnim from Sprites/fx/anim/forge_*). -->
      <div id="enhance-forge-fx" aria-hidden="true"></div>
      <div id="enhance-sparks" aria-hidden="true">
        <div class="ring"></div>
        <div class="spark" style="--dx:-60px; --dy:-72px;">✦</div>
        <div class="spark" style="--dx: 70px; --dy:-58px;">✦</div>
        <div class="spark" style="--dx:-90px; --dy: 18px;">✧</div>
        <div class="spark" style="--dx: 92px; --dy: 26px;">✧</div>
        <div class="spark" style="--dx:-30px; --dy:-100px;">★</div>
        <div class="spark" style="--dx: 45px; --dy:-110px;">★</div>
        <div class="spark" style="--dx:-110px; --dy:-30px;">✦</div>
        <div class="spark" style="--dx: 120px; --dy:-12px;">✦</div>
      </div>
      <button class="close-btn" onclick="closeAllModals()">✕</button>
      <h2 style="flex-shrink:0;">✦ Enhancement Forge ✦</h2>
      <!-- v0.26.259 — Inline "How it works" helper. Replaces the single-line
           "+10% per star" tagline that didn't communicate the success-rate
           curve, downgrade risk, or the three-zone progression. -->
      <div style="flex-shrink:0; margin:0 auto 8px; padding:8px 12px; background:rgba(255,255,255,0.04); border:1px solid rgba(255,255,255,0.10); border-radius:8px; font-size:11.5px; color:#cfd4dc; max-width:520px;">
        <div style="text-align:center; margin-bottom:4px;"><b style="color:#dfe4ec;">How forging works</b></div>
        <div style="display:flex; gap:8px; justify-content:space-around; text-align:center;">
          <div>
            <div style="color:#88ff88; font-weight:700;">★0 → ★5</div>
            <div style="font-size:10px; opacity:0.85;">Safe</div>
            <div style="font-size:10px; opacity:0.85;">63-95 % · fail can't drop ★</div>
          </div>
          <div>
            <div style="color:#ffcc44; font-weight:700;">★5 → ★8</div>
            <div style="font-size:10px; opacity:0.85;">Risky</div>
            <div style="font-size:10px; opacity:0.85;">39-55 % · fail may drop ★</div>
          </div>
          <div>
            <div style="color:#ff8888; font-weight:700;">★8 → ★10</div>
            <div style="font-size:10px; opacity:0.85;">Dangerous</div>
            <div style="font-size:10px; opacity:0.85;">23-31 % · fail may drop ★</div>
          </div>
        </div>
        <div style="text-align:center; margin-top:5px; font-size:10.5px; color:#aab2c0;">Each ★ multiplies <b>all gear stats</b> by 1.08× (★10 = +116 %).</div>
      </div>
      <div style="flex-shrink:0; text-align:center; margin-bottom:6px; font-size:12px;">Your Mojicoins: <span class="gold" id="enhance-lumens">0</span></div>
      <div id="enhance-list" style="flex:1; min-height:0; overflow-y:auto; padding:2px 4px 2px 2px; display:grid; grid-template-columns:repeat(auto-fill, minmax(56px, 1fr)); gap:7px; align-content:start; justify-items:center;"></div>
      <div id="enhance-preview" style="flex-shrink:0; margin-top:8px; padding:10px 12px; background:rgba(0,0,0,0.4); border:1px solid rgba(255,255,255,0.12); border-radius:6px; display:none; font-size:12px;"></div>`;

const NEW = `    <!-- v0.26.873 — Forge UI redesign: dedicated centre-stage for the anvil.
         Two-column layout — gear rack (left) · FORGE STAGE + preview (right).
         The anvil lives ON the stage, the selected item floats above it, and
         the success/fail Ludo animation plays AT the stage, front and centre.
         The old 3-zone helper block is condensed into a one-line info strip. -->
    <div class="modal" style="position:relative; min-width:660px; max-width:760px; height:560px; max-height:92vh; display:flex; flex-direction:column; justify-content:flex-start;">
      <button class="close-btn" onclick="closeAllModals()">✕</button>
      <h2 style="flex-shrink:0; margin-bottom:2px;">✦ Enhancement Forge ✦</h2>
      <div id="enhance-topstrip">
        <span>🪙 <span class="gold" id="enhance-lumens">0</span></span>
        <span class="sep">·</span>
        <span><b style="color:#88ff88;">★0-5</b> safe</span>
        <span><b style="color:#ffcc44;">★5-8</b> may drop ★</span>
        <span><b style="color:#ff8888;">★8-10</b> dangerous</span>
        <span class="sep">·</span>
        <span>each ★ = ×1.08 all stats</span>
      </div>
      <div id="enhance-body">
        <div id="enhance-list"></div>
        <div id="enhance-stage-col">
          <div id="enhance-stage">
            <div id="enhance-forge-fx" aria-hidden="true"></div>
            <div id="enhance-stage-item" aria-hidden="true"></div>
            <div id="enhance-anvil" aria-hidden="true"></div>
            <div id="enhance-stage-hint">Pick gear from the rack —<br>Brok will set it on the anvil.</div>
            <div id="enhance-sparks" aria-hidden="true">
              <div class="ring"></div>
              <div class="spark" style="--dx:-60px; --dy:-72px;">✦</div>
              <div class="spark" style="--dx: 70px; --dy:-58px;">✦</div>
              <div class="spark" style="--dx:-90px; --dy: 18px;">✧</div>
              <div class="spark" style="--dx: 92px; --dy: 26px;">✧</div>
              <div class="spark" style="--dx:-30px; --dy:-100px;">★</div>
              <div class="spark" style="--dx: 45px; --dy:-110px;">★</div>
              <div class="spark" style="--dx:-110px; --dy:-30px;">✦</div>
              <div class="spark" style="--dx: 120px; --dy:-12px;">✦</div>
            </div>
          </div>
          <div id="enhance-preview" style="display:none;"></div>
        </div>
      </div>`;

const c = src.split(OLD).length - 1;
if (c !== 1) { console.error('FAIL html block: ' + c); process.exit(2); }
src = src.replace(OLD, NEW);
if (src === orig) { console.error('no change'); process.exit(3); }
await writeFile(FILE, src, 'utf8');
console.log('OK: modal HTML restructured.');
