// Title screen: the support line becomes a row of four cute link badges - Ko-fi, Discord, Instagram, website.
// ============================================================================
// Per user: "Also put this in the links: https://discord.gg/9CqQwXKcv, https://www.instagram.com/mojistudios.official/,
// moji-studios.com. Make cute icons for all of them".
//
// The badges are drawn in the menu cards' own language - a gold ring, a soft gloss, the platform's colour - each with a
// little face. Their source is assets/social/*.svg (also used by the README); this script INLINES them, so the row costs
// no request, cannot 404 in the portable zip, and stays sharp at any render scale. The overlay that holds them is
// visibility:hidden with animations off once play starts (v0.30.271), so none of this runs during a fight.
// #lo-support stays on the Ko-fi badge. Guarded + atomic + idempotent. EOL-aware.
import { readFileSync, writeFileSync, renameSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const F = process.env.LX_GAME_FILE || path.join(ROOT, 'mojiworld_game.html');
let s = readFileSync(F, 'utf8');
const n0 = s.length;
if (/v0\.30\.(x|\d+) social-links/.test(s)) { console.log('already applied'); process.exit(0); }
const EOL = ((s.match(/\r\n/g) || []).length > (s.match(/\n/g) || []).length / 2) ? '\r\n' : '\n';
const J = (...L) => L.join(EOL);
const abort = (m) => { console.error('ABORT ' + m); process.exit(1); };
const sub = (label, a, b) => { const c = s.split(a).length - 1; if (c !== 1) abort(`${label}: matched ${c}, expected 1`); s = s.split(a).join(b); };

const LINKS = [
  { key: 'kofi', id: 'lo-support', href: 'https://ko-fi.com/mojistudios', label: 'Ko-fi', name: 'Support Mojiworld on Ko-fi' },
  { key: 'discord', id: 'lo-discord', href: 'https://discord.gg/9CqQwXKcv', label: 'Discord', name: 'Join the Mojiworld Discord' },
  { key: 'instagram', id: 'lo-instagram', href: 'https://www.instagram.com/mojistudios.official/', label: 'Instagram', name: 'Follow Moji Studios on Instagram' },
  { key: 'website', id: 'lo-website', href: 'https://moji-studios.com', label: 'Website', name: 'Visit moji-studios.com' },
];
// one SVG file -> one line of inline markup: comments and indentation out, sizing to CSS, hidden from assistive tech
// (the link carries the accessible name)
const inline = (key) => {
  let v = readFileSync(path.join(ROOT, 'assets', 'social', key + '.svg'), 'utf8');
  v = v.replace(/<!--[\s\S]*?-->/g, '').replace(/\s*\n\s*/g, ' ').replace(/>\s+</g, '><').trim();
  v = v.replace(/ width="64" height="64"/, '').replace(/ role="img" aria-label="[^"]*"/, ' aria-hidden="true" focusable="false"');
  if (!/^<svg xmlns="http:\/\/www\.w3\.org\/2000\/svg" viewBox="0 0 64 64" aria-hidden="true" focusable="false">/.test(v) || !/<\/svg>$/.test(v)) abort(key + '.svg: unexpected shape');
  if (/<script|on[a-z]+=|href=/i.test(v)) abort(key + '.svg: carries script, handlers or links');
  return v;
};

// ---- CSS: the support line's rules become the row's ------------------------------------------------------
sub('css', J(
  '  /* v0.30.445 — the support line. Same whisper as .auth-note, warmed to read as a link; it lifts on hover so it is',
  '     discoverable without competing with the five menu cards above it. */',
  '  #loading-overlay .lo-support {',
  '    display: block; margin: 7px 0 0; font-size: 10.5px; letter-spacing: 0.5px;',
  '    color: #c9a6ff; text-align: center; text-decoration: none; opacity: 0.85;',
  '    transition: color 0.18s ease, opacity 0.18s ease;',
  '  }',
  '  #loading-overlay .lo-support:hover,',
  '  #loading-overlay .lo-support:focus-visible { color: #ffd166; opacity: 1; text-decoration: underline; }'),
  J('  /* v0.30.825 social-links — the v0.30.445 support line is a row of four link badges now (Ko-fi, Discord, Instagram,',
    '     website). Still a whisper under the menu cards: small, muted, lifting and glowing gold on hover or keyboard focus,',
    '     with a little wiggle. The badges are inline SVG sized here; assets/social/*.svg is their source. */',
    '  #loading-overlay .lo-links {',
    '    display: flex; justify-content: center; align-items: flex-start; gap: 10px; margin: 9px 0 0;',
    '  }',
    '  #loading-overlay .lo-link {',
    '    display: flex; flex-direction: column; align-items: center; gap: 3px; width: 60px;',
    '    color: #c9a6ff; text-decoration: none; font-size: 9.5px; letter-spacing: 0.4px; line-height: 1.1;',
    '    opacity: 0.9; outline: none; -webkit-tap-highlight-color: transparent;',
    '    transition: transform 0.2s cubic-bezier(.3,1.7,.5,1), color 0.18s ease, opacity 0.18s ease;',
    '  }',
    '  #loading-overlay .lo-link-ico {',
    '    display: block; width: 34px; height: 34px; border-radius: 50%;',
    '    filter: drop-shadow(0 2px 3px rgba(0,0,0,0.5)); transition: filter 0.18s ease;',
    '  }',
    '  #loading-overlay .lo-link-ico svg { display: block; width: 100%; height: 100%; }',
    '  #loading-overlay .lo-link:hover,',
    '  #loading-overlay .lo-link:focus-visible { color: #ffd166; opacity: 1; transform: translateY(-3px); }',
    '  #loading-overlay .lo-link:hover .lo-link-ico,',
    '  #loading-overlay .lo-link:focus-visible .lo-link-ico { filter: drop-shadow(0 0 7px rgba(255,209,102,0.7)) drop-shadow(0 2px 3px rgba(0,0,0,0.5)); }',
    '  #loading-overlay .lo-link:hover .lo-link-ico svg,',
    '  #loading-overlay .lo-link:focus-visible .lo-link-ico svg { animation: loLinkWiggle 0.55s ease; }',
    '  #loading-overlay .lo-link:focus-visible .lo-link-lab { text-decoration: underline; }',
    '  @keyframes loLinkWiggle { 0%, 100% { transform: rotate(0) scale(1); } 30% { transform: rotate(-9deg) scale(1.08); } 65% { transform: rotate(6deg) scale(1.08); } }',
    '  @media (prefers-reduced-motion: reduce) {',
    '    #loading-overlay .lo-link, #loading-overlay .lo-link-ico { transition: none; }',
    '    #loading-overlay .lo-link:hover .lo-link-ico svg, #loading-overlay .lo-link:focus-visible .lo-link-ico svg { animation: none; }',
    '  }'));

// ---- markup: the one Ko-fi anchor becomes the row ------------------------------------------------------------
const row = [
  '        <!-- v0.30.825 social-links — per user: Discord, Instagram and the studio site join Ko-fi, each with a cute badge.',
  '             Every link opens in a new tab without handing the game\'s window over (rel noopener). -->',
  '        <nav class="lo-links" id="lo-links" aria-label="Mojiworld community">',
  ...LINKS.map((l) => `          <a class="lo-link" id="${l.id}" href="${l.href}" target="_blank" rel="noopener noreferrer" title="${l.name}" aria-label="${l.name}"><span class="lo-link-ico">${inline(l.key)}</span><span class="lo-link-lab">${l.label}</span></a>`),
  '        </nav>',
];
sub('markup',
  '        <a class="lo-support" id="lo-support" href="https://ko-fi.com/mojistudios" target="_blank" rel="noopener noreferrer">♥ Support Mojiworld on Ko-fi</a>',
  J(...row));

const grew = s.length - n0;
if (grew < 8000 || grew > 20000) abort(`content moved ${grew}`);
writeFileSync(F + '.tmp', s, 'utf8');
if (statSync(F + '.tmp').size < 1000000) abort('tmp suspiciously small');
renameSync(F + '.tmp', F);
console.log(`applied: social-links — Ko-fi, Discord, Instagram, website badges on the title screen (+${grew}, EOL ${EOL === '\r\n' ? 'CRLF' : 'LF'})`);
