// The title menu's four community badges, redrawn pop (per user: "remake the ko-fi discord instagram and website logos
// to match the pop style better"). Imported by apply_title_pop.mjs. Each is a flat palette-colour disc with an ink
// ring, a comic shine, a halftone crescent of shade, and a white glyph with an ink edge; the cute faces stay.
const INK = '#0c0b10', CHEEK = '#ff7eb6';
const glyph = `fill="#fff" stroke="${INK}" stroke-width="3.6" stroke-linejoin="round" paint-order="stroke"`;
const face = (eyes, cheeks, mouth) => `<path d="${eyes}" fill="none" stroke="${INK}" stroke-width="2" stroke-linecap="round"/>`
  + cheeks.map(([x, y]) => `<ellipse cx="${x}" cy="${y}" rx="2.3" ry="1.4" fill="${CHEEK}"/>`).join('')
  + `<path d="${mouth}" fill="none" stroke="${INK}" stroke-width="1.7" stroke-linecap="round"/>`;
const badge = (id, bg, shade, body) => '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" aria-hidden="true" focusable="false">'
  + `<defs><pattern id="${id}-dots" width="4" height="4" patternUnits="userSpaceOnUse"><circle cx="2" cy="2" r="0.95" fill="${INK}" opacity=".3"/></pattern>`
  + `<mask id="${id}-cres"><circle cx="32" cy="32" r="29" fill="#fff"/><circle cx="27.5" cy="27" r="27.5" fill="#000"/></mask></defs>`
  + `<circle cx="32" cy="32" r="29" fill="${bg}"/>`
  + `<circle cx="32" cy="32" r="29" fill="${shade}" mask="url(#${id}-cres)"/>`
  + `<circle cx="32" cy="32" r="29" fill="url(#${id}-dots)" mask="url(#${id}-cres)"/>`
  + '<path d="M12.8 25.5A20.5 20.5 0 0 1 25 12.6" fill="none" stroke="#fff" stroke-width="3.2" stroke-linecap="round"/>'
  + body
  + `<circle cx="32" cy="32" r="29" fill="none" stroke="${INK}" stroke-width="3.5"/></svg>`;

export const SOCIAL = {
  // Ko-fi: a smiling cup with a heart for steam, on cyan
  'lo-support': badge('lxp-kf', '#25e2ff', '#10a9cf',
    `<path d="M42.6 32.2h2.2a5.6 5.6 0 0 1 0 11.2h-2.6" fill="none" stroke="${INK}" stroke-width="7.6" stroke-linecap="round"/>`
    + '<path d="M42.6 32.2h2.2a5.6 5.6 0 0 1 0 11.2h-2.6" fill="none" stroke="#fff" stroke-width="3.6" stroke-linecap="round"/>'
    + `<path d="M17 29.5h26.5v11c0 5.6-4.4 9.2-9.8 9.2h-6.9c-5.4 0-9.8-3.6-9.8-9.2z" ${glyph}/>`
    + `<path d="M28 24.2c-5.6-3.6-5.4-9.6-1.2-9.9 1.6-.1 2.6 1 3.2 2 .6-1 1.6-2.1 3.2-2 4.2.3 4.4 6.3-1.2 9.9l-2 1.3z" fill="#ff2e88" stroke="${INK}" stroke-width="2.6" stroke-linejoin="round" paint-order="stroke"/>`
    + face('M23.6 38.3q2.1-2.6 4.2 0M32.8 38.3q2.1-2.6 4.2 0', [[21.8, 42], [38.8, 42]], 'M28.6 41.8q1.7 1.9 3.4 0')),
  // Discord: the controller-face, on violet
  'lo-discord': badge('lxp-dc', '#7b61ff', '#5536e0',
    `<path d="M20.6 21.4C23.6 19.9 26.6 19 29.3 18.7L30.6 21.3C31.5 21.2 32.5 21.2 33.4 21.3L34.7 18.7C37.4 19 40.4 19.9 43.4 21.4C47.6 27.6 49.3 34 48.7 40.9C45.6 43.3 42.6 44.6 39.8 45.3L37.5 41.9C39 41.3 40.4 40.6 41.7 39.7C35.8 42.6 28.2 42.6 22.3 39.7C23.6 40.6 25 41.3 26.5 41.9L24.2 45.3C21.4 44.6 18.4 43.3 15.3 40.9C14.7 34 16.4 27.6 20.6 21.4Z" ${glyph}/>`
    + `<ellipse cx="26.2" cy="31.2" rx="3.3" ry="3.9" fill="${INK}"/><ellipse cx="37.8" cy="31.2" rx="3.3" ry="3.9" fill="${INK}"/>`
    + '<circle cx="27.3" cy="29.8" r="1.2" fill="#fff"/><circle cx="38.9" cy="29.8" r="1.2" fill="#fff"/>'
    + `<ellipse cx="21.4" cy="36.2" rx="2.4" ry="1.4" fill="${CHEEK}"/><ellipse cx="42.6" cy="36.2" rx="2.4" ry="1.4" fill="${CHEEK}"/>`
    + `<path d="M30 35.6q2 2 4 0" fill="none" stroke="${INK}" stroke-width="1.7" stroke-linecap="round"/>`),
  // Instagram: the camera, with a face in the lens, on hot pink
  'lo-instagram': badge('lxp-ig', '#ff2e88', '#d0126a',
    `<rect x="16.5" y="17.5" width="31" height="30" rx="9.5" fill="none" stroke="${INK}" stroke-width="8.4"/>`
    + '<rect x="16.5" y="17.5" width="31" height="30" rx="9.5" fill="none" stroke="#fff" stroke-width="4"/>'
    + `<circle cx="32" cy="33" r="8.6" fill="#fff" stroke="${INK}" stroke-width="3" paint-order="stroke"/>`
    + `<circle cx="41" cy="24.2" r="2.3" fill="#fff" stroke="${INK}" stroke-width="2.2" paint-order="stroke"/>`
    + `<circle cx="29" cy="32" r="1.5" fill="${INK}"/><circle cx="35" cy="32" r="1.5" fill="${INK}"/>`
    + `<ellipse cx="26.6" cy="35.4" rx="1.8" ry="1.1" fill="${CHEEK}"/><ellipse cx="37.4" cy="35.4" rx="1.8" ry="1.1" fill="${CHEEK}"/>`
    + `<path d="M30.5 35.3q1.5 1.6 3 0" fill="none" stroke="${INK}" stroke-width="1.4" stroke-linecap="round"/>`),
  // Website: a smiling globe, on acid yellow
  'lo-website': badge('lxp-ws', '#ffe45c', '#e9b91c',
    '<clipPath id="lxp-ws-clip"><circle cx="32" cy="33.5" r="14.5"/></clipPath>'
    + '<circle cx="32" cy="33.5" r="14.5" fill="#25e2ff"/>'
    + `<g clip-path="url(#lxp-ws-clip)" fill="#c6ff4d" stroke="${INK}" stroke-width="1.5" stroke-linejoin="round"><path d="M16.5 22.5c4-2.6 9.5-3 12.6-.6 1.4 1.1.2 2.6-1.8 2.8-2.6.3-3.6 1.8-5.6 2.1-2.6.4-4.6-.8-5.2-4.3z"/><path d="M38.5 21.3c3.4-.6 7.3 1.4 8.6 4.6.6 1.5-.9 2-2.5 1.4-2.1-.8-3.3.3-5 .1-2.3-.2-3.4-2.2-1.1-6.1z"/><path d="M22.5 45.2c3.4-1.8 8-2.4 12.4-1.3 3 .8 5.4-.4 7.2.6 1.8 1 .4 4.6-2.8 5.6-5.4 1.7-13.4 1-16.8-4.9z"/></g>`
    + `<circle cx="32" cy="33.5" r="14.5" fill="none" stroke="${INK}" stroke-width="3.2"/>`
    + face('M25.4 34.2q2-2.5 4 0M34.6 34.2q2-2.5 4 0', [[23.6, 37.8], [40.4, 37.8]], 'M30.2 37.6q1.8 1.9 3.6 0')),
};
