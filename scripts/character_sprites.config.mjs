// Character sprite generation config — v0.25.326
// =============================================================================
// Single source of truth for the hair / eyes / mouth Ludo prompts. Mirrored in
// CHARACTER_PROMPTS.md (human-readable) — this file is for the automation
// runner (scripts/generate_character_sprites.mjs).
//
// Each entry composes as one continuous Ludo prompt:
//   SIDE_PREFIX + LOCKED_PREFIX + LAYER_BLOCKS[layer] + variant
//
// SIDE_PREFIX (v0.25.326) forces a consistent three-quarter-right pose so
// every authored sprite reads in the same direction as the chibi's idle
// stance in the renderer (faces right by default).
// =============================================================================

export const SIDE_PREFIX =
  'Side facing 40 percent to the right at a slight three-quarter angle ' +
  '(right shoulder closer to the viewer than left, head turned slightly ' +
  'toward camera-right, NOT a flat front view). ';

export const LOCKED_PREFIX =
  'Chibi anime face / hair piece for a layered character creator. Pure ' +
  'transparent background. Drawn on an 800x800 square canvas. Implied ' +
  'chibi head silhouette occupies bbox (245,215)-(612,585), centred on ' +
  '(430,400). Crown at (430,220), chin at (430,585). Soft painterly ' +
  'cel-shaded anime style, MapleStory aesthetic. Render ONLY the [LAYER] ' +
  'piece - no head silhouette, no body, no neck, no other facial features. ';

export const LAYER_BLOCKS = {
  hair:
    'Layer = hair. Hair envelopes the chibi head silhouette: crown coverage ' +
    'starting at y=180-220, side coverage flanking x=245-612, may extend ' +
    'past the bbox horizontally up to plus or minus 80 px for volume. Paint ' +
    'the FULL silhouette of the hairstyle including back-hair volume visible ' +
    'behind the head. Two- or three-tone cel shading, crisp ink-line outline ' +
    '~2 px. Authored in NEUTRAL DARK BROWN (#3a2218 base, #5a3624 highlight, ' +
    '#1a0a04 shadow) so the multiply-blend tint cache can recolour at runtime. ',
  eyes:
    'Layer = eyes. Render a PAIR of chibi anime eyes only. Each eye sits ' +
    'inside the head bbox at approximately (400,390) and (460,390), separated ' +
    'by ~60 px, ~30 px tall x ~45 px wide. No nose, no brows-without-eyes, ' +
    'no eyelashes drifting outside that band. Crisp ink-line outline ~2 px ' +
    'on whites; saturated iris colour with a single soft specular pip. ' +
    'Symmetric across x=430. ',
  mouth:
    'Layer = mouth. Render a SINGLE chibi anime mouth shape only. Sits at ' +
    'approximately (430,490), no taller than ~25 px and no wider than ~50 px. ' +
    'No nose, no chin, no facial outline around it. Crisp ink-line outline ' +
    '~2 px, warm subtle inner colour. Centred on x=430. ',
};

// 36 entries: 12 hair + 12 eyes + 12 mouth. Filename column = exactly what
// gets saved into Sprites/character/<layer>/. spriteId = filename without ext.
export const ENTRIES = [
  // ---- HAIR (12) ----
  { layer:'hair', id:'flow',        filename:'flow.webp',        variant:'Variant: Long flowing hair past the shoulders, soft side-swept bangs covering one eyebrow. Generous side volume. Romantic / heroine aesthetic.' },
  { layer:'hair', id:'ponytail',    filename:'ponytail.webp',    variant:'Variant: Tall genki high ponytail tied at crown with a small ribbon, side bangs framing the face. Volume swept up and backward. Energetic schoolgirl aesthetic.' },
  { layer:'hair', id:'shaggy',      filename:'shaggy.webp',      variant:'Variant: Loose unkempt shaggy layered cut, choppy mid-length strands falling over the forehead and ears. Tousled bedhead aesthetic.' },
  { layer:'hair', id:'spiky',       filename:'spiky.webp',       variant:'Variant: Aggressive shounen spiked hair with sharp pointed clusters radiating outward, gravity-defying volume. Battle-anime hero aesthetic.' },
  { layer:'hair', id:'flowy',       filename:'flowy.webp',       variant:'Variant: Long flowing wavy hair with gentle curls, voluminous bottom layer. Storybook princess aesthetic.' },
  { layer:'hair', id:'iceCream',    filename:'ice_cream.webp',   variant:'Variant: Tall soft tower-bun pulled high on the crown like an ice-cream cone, two short side strands at the cheeks. Cute mascot aesthetic.' },
  { layer:'hair', id:'pigeotto',    filename:'pigeotto.webp',    variant:'Variant: Short cropped front-tuft style with one wide bang sweeping across the forehead, sides cleanly tapered. Boyish anime protagonist aesthetic.' },
  { layer:'hair', id:'pigtails',    filename:'pigtails.webp',    variant:'Variant: Twin low pigtails tied with simple bands behind each ear, blunt-cut bangs across the forehead. Genki schoolgirl aesthetic.' },
  { layer:'hair', id:'topknot',     filename:'topknot.webp',     variant:'Variant: Tight topknot bun tied at crown, sleek sides pulled smooth, optional short side-strand at one temple. Samurai / martial-artist aesthetic.' },
  { layer:'hair', id:'afro',        filename:'afro.webp',        variant:'Variant: Round full curly halo of tight ringlets framing the face, even volume on all sides. Chibi cherub aesthetic.' },
  { layer:'hair', id:'undercut',    filename:'undercut.webp',    variant:'Variant: Long top swept to one side with shaved / very-short undercut on the sides, sharp contrast between top length and side stubble. Edgy modern aesthetic.' },
  { layer:'hair', id:'ringlets',    filename:'ringlets.webp',    variant:'Variant: Long tightly-spiralled ringlet curls cascading past the shoulders, voluminous side volume. Vintage-doll aesthetic.' },
  // ---- EYES (12) ----
  { layer:'eyes', id:'default',     filename:'default.webp',     variant:'Variant: Standard chibi round eyes, deep brown iris with a single bright specular pip, simple thin upper eyelid line and short brows above. Calm friendly expression.' },
  { layer:'eyes', id:'fierce',      filename:'fierce.webp',      variant:'Variant: Fierce slanted determined eyes, sharper outer corners angled upward, narrowed lid line, bold dark eyebrows angled inward. Combat-ready expression.' },
  { layer:'eyes', id:'sparkle',     filename:'sparkle.webp',     variant:'Variant: Wide-open round eyes with multiple star and circle sparkle pips inside large saturated irises (mint or pink), magical-girl awe expression.' },
  { layer:'eyes', id:'sleepy',      filename:'sleepy.webp',      variant:'Variant: Half-lidded relaxed eyes, lid covering top third of iris, gentle curve. Drowsy daydreamer expression.' },
  { layer:'eyes', id:'cat',         filename:'cat.webp',         variant:'Variant: Cat-like slit pupils inside large yellow-green irises, sharper almond-shaped lid line, slight upward outer corner. Mischievous trickster expression.' },
  { layer:'eyes', id:'closed',      filename:'closed.webp',      variant:'Variant: Both eyes closed in upturned crescent arcs (^_^), no iris visible, soft happy lashes. Cheerful expression.' },
  { layer:'eyes', id:'wink',        filename:'wink.webp',        variant:'Variant: Right eye open with normal round iris, left eye closed in upturned crescent, asymmetric playful wink expression.' },
  { layer:'eyes', id:'glasses',     filename:'glasses.webp',     variant:'Variant: Standard round eyes behind thin round wire-frame glasses, light reflection across one lens. Studious scholar expression.' },
  { layer:'eyes', id:'scarred',     filename:'scarred.webp',     variant:'Variant: Standard determined eyes with one diagonal scar across the right brow / cheek (faint pink line), unaffected gaze. Battle-hardened veteran expression.' },
  { layer:'eyes', id:'heterochromia', filename:'heterochromia.webp', variant:'Variant: Round eyes with mismatched iris colours (left eye gold, right eye violet), each with single specular pip. Mystical otherworldly expression.' },
  { layer:'eyes', id:'cyber',       filename:'cyber.webp',       variant:'Variant: Eyes hidden behind a horizontal glowing cyan visor band across the eye line, two slit highlights where pupils would be. Cyberpunk netrunner expression.' },
  { layer:'eyes', id:'teary',       filename:'teary.webp',       variant:'Variant: Wide round eyes brimming with a single visible tear droplet at the inner corner, glossy oversized speculars across the iris. Vulnerable emotional expression.' },
  // ---- MOUTH (12) ----
  { layer:'mouth', id:'default',    filename:'default.webp',     variant:'Variant: Small soft closed-mouth smile, gentle upturned curve, warm rose-tinted lip line, no teeth visible. Friendly default expression.' },
  { layer:'mouth', id:'grin',       filename:'grin.webp',        variant:'Variant: Wide open-mouth grin showing top row of small even white teeth, upturned corners, joyful expression.' },
  { layer:'mouth', id:'smirk',      filename:'smirk.webp',       variant:'Variant: Asymmetric one-sided smirk, only the right corner pulled up, small confident curve. Cocky expression.' },
  { layer:'mouth', id:'surprise',   filename:'surprise.webp',    variant:'Variant: Small round open mouth in a perfect "O" shape, slight inner-mouth shadow visible. Startled expression.' },
  { layer:'mouth', id:'tongue',     filename:'tongue.webp',      variant:'Variant: Open mouth with tongue sticking out playfully to one side, small teeth visible above tongue. Cheeky expression.' },
  { layer:'mouth', id:'stoic',      filename:'stoic.webp',       variant:'Variant: A simple flat horizontal mouth line, neither up- nor downturned, no teeth visible. Neutral stoic expression.' },
  { layer:'mouth', id:'laugh',      filename:'laugh.webp',       variant:'Variant: Wide-open laughing mouth showing top teeth and tongue, head-tilt-back energy implied, joyful overflowing laughter expression.' },
  { layer:'mouth', id:'pout',       filename:'pout.webp',        variant:'Variant: Small pursed pouty mouth, lower lip slightly pushed forward, downturned corners. Sulky expression.' },
  { layer:'mouth', id:'fang',       filename:'fang.webp',        variant:'Variant: Half-open grin with one small visible canine fang protruding from the upper lip, mischievous monster-girl / shounen aesthetic.' },
  { layer:'mouth', id:'frown',      filename:'frown.webp',       variant:'Variant: Small downturned closed mouth, gentle inverted curve, no teeth. Sad / disappointed expression.' },
  { layer:'mouth', id:'blush',      filename:'blush.webp',       variant:'Variant: Small soft closed smile with two pink blush dabs centred under each eye on the cheek line. Bashful flustered expression.' },
  { layer:'mouth', id:'determined', filename:'determined.webp',  variant:'Variant: Tightly closed mouth in a flat slightly-downturned firm line, jaw-set energy. Resolute battle-ready expression.' },
];

export function composePrompt(entry) {
  const block = LAYER_BLOCKS[entry.layer];
  if (!block) throw new Error(`Unknown layer: ${entry.layer}`);
  const prefix = LOCKED_PREFIX.replace('[LAYER]', entry.layer);
  return SIDE_PREFIX + prefix + block + entry.variant;
}
