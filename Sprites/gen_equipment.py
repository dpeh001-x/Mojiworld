"""Generate 24x24 equipment inventory icons for LevelX.

Paths (per gear_sprite_specs.md):
  sprites/equipment/weapons/sword_{wood,iron,steel,runed,katana,dawnshard}.png
  sprites/equipment/armors/armor_{cloth,leather,chain,plate,dragon,dawnshard}.png
  sprites/equipment/accessories/acc_{ring_might,ring_wisdom,boots,amulet,talisman,medallion}.png

All 24x24 transparent PNGs. Top-down / ~45-degree angle. Rich shading.
"""
import os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from pixart import (P, canvas, px, rect, hline, vline, line,
                    circle_fill, circle_outline, ellipse_fill,
                    ellipse_outline, outline_silhouette,
                    lighten, darken, save)

OUT = '/sessions/friendly-compassionate-albattani/mnt/LevelX/sprites/equipment'


# ----------------------------------------------------------------------
# WEAPONS — 24x24 inventory icons (sword held at 45deg — pommel BL, tip TR)
# ----------------------------------------------------------------------
def _sword_icon(blade_colors, guard_colors, grip_colors, pommel_color,
                accents=None):
    """accents: optional callable(img) for gem/runes/extras."""
    img = canvas(24, 24)
    bd, bm, bl = blade_colors
    gd, gm, gl = guard_colors
    grd, grm, grl = grip_colors

    # Sword diagonal from bottom-left to top-right.
    # Blade: long diagonal 2-px-wide stripe from (5, 19) → (19, 3).
    # We draw a thick diagonal rectangle by offsetting a line in parallel.

    # Blade body (~2-3 px thick along the diagonal)
    for off in range(3):
        x0, y0 = 5 + off, 19 - off
        x1, y1 = 19 + off, 3 - off
        c = [bm, bl, bd][off]
        line(img, x0, y0, x1, y1, c)

    # Blade tip accent (near TR)
    px(img, 19, 2, bl)
    px(img, 20, 3, bl)
    px(img, 20, 2, bl)

    # Fuller line (highlight) down center of blade
    line(img, 7, 18, 17, 5, bl)

    # Crossguard — perpendicular bar near the bottom-left of the blade
    # Roughly at the 'hilt' corner around (5, 19).
    # Guard runs from (2, 16) to (8, 22) approximately (perpendicular to blade)
    for k in range(-3, 4):
        px(img, 5 - k, 19 - k, gm)   # wait — that's ALONG blade direction, we want perpendicular
    # Instead: perpendicular to blade (-1,-1 direction) means (-1,+1) perpendicular
    # Redo guard:
    for off in range(-4, 5):
        gx = 5 + off
        gy = 19 + off
        c = gm if abs(off) < 4 else gd
        if 0 <= gx < 24 and 0 <= gy < 24:
            px(img, gx, gy, c)
    # Guard highlight top
    for off in range(-3, 4):
        gx = 5 + off
        gy = 19 + off - 1
        if 0 <= gx < 24 and 0 <= gy < 24:
            px(img, gx, gy, gl)

    # Grip — continues in the same diagonal direction as blade but beyond the guard
    # from (5, 19) toward (2, 22) — 3-4 pixels
    for off in range(1, 4):
        x, y = 5 - off, 19 + off
        if 0 <= x < 24 and 0 <= y < 24:
            px(img, x, y, grm)
            if off < 3:
                # highlight left side
                px(img, x - 1, y, grl) if x - 1 >= 0 else None
    # Grip wraps
    px(img, 3, 21, grd)
    px(img, 4, 20, grd)

    # Pommel — round knob at very bottom-left tip of grip
    rect(img, 1, 22, 3, 23, pommel_color)
    px(img, 1, 22, lighten(pommel_color, 30))

    if accents:
        accents(img)

    outline_silhouette(img)
    return img


def gen_weapons():
    out = os.path.join(OUT, 'weapons')

    # Wooden sword — brown "blade", simple pommel
    save(_sword_icon(
        blade_colors=(P['brown_d'], P['brown_m'], P['brown_l']),
        guard_colors=(P['brown_d'], P['tan_m'], P['tan_l']),
        grip_colors=(P['brown_d'], P['brown_m'], P['brown_l']),
        pommel_color=P['brown_m'],
    ), f'{out}/sword_wood.png')

    # Iron sword — grey steel, brass guard
    def iron_accent(img):
        # Red gem pommel accent
        pass
    save(_sword_icon(
        blade_colors=(P['iron_d'], P['iron_m'], P['iron_l']),
        guard_colors=(P['gold_d'], P['gold_m'], P['gold_l']),
        grip_colors=(P['brown_d'], P['brown_m'], P['brown_l']),
        pommel_color=P['iron_l'],
    ), f'{out}/sword_iron.png')

    # Steel blade — polished mirror-bright, silver guard
    save(_sword_icon(
        blade_colors=(P['steel_d'], P['steel_m'], P['steel_l']),
        guard_colors=(P['steel_d'], P['steel_m'], P['steel_l']),
        grip_colors=(P['brown_d'], P['brown_m'], P['brown_l']),
        pommel_color=P['steel_l'],
        accents=lambda img: (
            px(img, 1, 22, P['ruby']),  # red gem pommel
        ),
    ), f'{out}/sword_steel.png')

    # Runed sabre — curved blade with glowing blue runes
    def runed_accents(img):
        # Rune dots along the blade
        px(img, 10, 15, P['cyan_l'])
        px(img, 13, 11, P['cyan_l'])
        px(img, 16, 7, P['cyan_l'])
        # Sapphire on pommel
        px(img, 2, 22, P['sapphire'])
    save(_sword_icon(
        blade_colors=(P['steel_d'], P['steel_l'], P['cyan_l']),
        guard_colors=(P['gold_d'], P['gold_m'], P['gold_l']),
        grip_colors=(P['red_d'], P['crimson'], P['crimson_l']),
        pommel_color=P['steel_m'],
        accents=runed_accents,
    ), f'{out}/sword_runed.png')

    # Enchanted katana — slim long blade, purple mist
    def katana_accents(img):
        # Purple mist around blade
        px(img, 11, 17, P['purple_l'])
        px(img, 14, 13, P['purple_l'])
        px(img, 17, 9, P['amethyst'])
        px(img, 20, 5, P['purple_l'])
        # Red tassel
        px(img, 3, 23, P['red_m'])
        px(img, 2, 23, P['red_l'])
    save(_sword_icon(
        blade_colors=(P['iron_m'], P['iron_l'], P['purple_l']),
        guard_colors=(P['black'], P['iron_d'], P['gold_m']),
        grip_colors=(P['black'], P['iron_d'], P['gold_m']),
        pommel_color=P['iron_d'],
        accents=katana_accents,
    ), f'{out}/sword_katana.png')

    # Maple Bright / Dawnshard — leaf-shaped crystal blade with glow, gold hilt
    def dawn_accents(img):
        # Glowing leaf highlights on blade
        px(img, 12, 14, P['white'])
        px(img, 15, 10, P['white'])
        px(img, 18, 6, P['white'])
        # Ruby pommel
        px(img, 2, 22, P['ruby'])
        px(img, 1, 23, P['ruby'])
        # Leaf-veins hint: make blade tip slightly wider
        px(img, 18, 3, P['emerald_l'])
        px(img, 19, 4, P['emerald_l'])
        px(img, 20, 4, P['emerald_l'])
    save(_sword_icon(
        blade_colors=(P['emerald'], P['emerald_l'], P['white']),
        guard_colors=(P['gold_d'], P['gold_m'], P['gold_l']),
        grip_colors=(P['brown_d'], P['brown_m'], P['gold_m']),
        pommel_color=P['ruby'],
        accents=dawn_accents,
    ), f'{out}/sword_dawnshard.png')


# ----------------------------------------------------------------------
# ARMORS — 24x24 inventory icons (cuirass front view)
# ----------------------------------------------------------------------
def _armor_icon(body_colors, trim_color=None, decoration=None):
    img = canvas(24, 24)
    bd, bm, bl = body_colors

    # Pauldrons (shoulders) — rounded caps at top corners
    # Left pauldron
    ellipse_fill(img, 5, 5, 3, 2, bm)
    ellipse_fill(img, 4, 4, 2, 1, bl)
    # Right pauldron
    ellipse_fill(img, 18, 5, 3, 2, bm)
    ellipse_fill(img, 17, 4, 2, 1, bl)

    # Neckline / collar dip
    rect(img, 8, 4, 15, 5, bm)
    # V-neckline hollow (transparent — leave be since canvas starts transparent)
    # Actually we need to draw body first then carve out V
    # Cuirass body (chest)
    rect(img, 5, 6, 18, 18, bm)
    # Highlight band (left side + top)
    for y in range(6, 18):
        px(img, 5, y, bl)
    hline(img, 5, 18, 6, bl)

    # Shadow right side
    for y in range(6, 18):
        px(img, 18, y, bd)

    # Carve V-neck
    for dy in range(3):
        for dx in range(-dy, dy + 1):
            x = 11 + dx
            y = 6 + dy
            if 5 <= x <= 18 and 6 <= y <= 8:
                px(img, x, y, (0, 0, 0, 0))

    # Waist narrowing + belt line
    rect(img, 6, 17, 17, 18, darken(bm, 25))
    rect(img, 6, 19, 17, 19, bd)
    # Belt buckle
    rect(img, 10, 18, 13, 19, P['gold_m'] if trim_color is None else trim_color)
    px(img, 11, 18, P['gold_l'])

    # Lower skirt / tassels
    rect(img, 7, 20, 16, 21, bm)
    rect(img, 9, 22, 14, 22, bd)

    if trim_color is not None:
        # Gold trim along neck collar + bottom edge
        hline(img, 8, 15, 4, trim_color)
        hline(img, 7, 16, 22, trim_color)

    if decoration is not None:
        decoration(img)

    outline_silhouette(img)
    return img


def gen_armors():
    out = os.path.join(OUT, 'armors')

    # Cloth Tunic — grey linen
    save(_armor_icon(
        body_colors=(P['grey_d'], P['grey_m'], P['grey_l']),
    ), f'{out}/armor_cloth.png')

    # Leather Vest — tan leather with straps
    def leather_deco(img):
        # Straps
        vline(img, 9, 7, 16, P['brown_d'])
        vline(img, 14, 7, 16, P['brown_d'])
        # Stitching dots
        for y in range(8, 16, 2):
            px(img, 10, y, P['brown_l'])
            px(img, 13, y, P['brown_l'])
    save(_armor_icon(
        body_colors=(P['brown_d'], P['brown_m'], P['tan_l']),
        decoration=leather_deco,
    ), f'{out}/armor_leather.png')

    # Chain Mail — woven silver rings
    def chain_deco(img):
        # Cross-hatch pattern of small dark dots
        for y in range(7, 18):
            for x in range(6, 18):
                if (x + y) % 2 == 0:
                    px(img, x, y, P['iron_d'])
    save(_armor_icon(
        body_colors=(P['iron_d'], P['iron_m'], P['steel_l']),
        decoration=chain_deco,
    ), f'{out}/armor_chain.png')

    # Plate Armor — polished steel plates
    def plate_deco(img):
        # Central plate seam
        vline(img, 11, 7, 17, darken(P['steel_m'], 30))
        # Rivets at corners
        for (rx, ry) in [(6, 7), (17, 7), (6, 17), (17, 17), (11, 9), (11, 13)]:
            px(img, rx, ry, P['gold_l'])
    save(_armor_icon(
        body_colors=(P['steel_d'], P['steel_m'], P['steel_l']),
        trim_color=P['gold_m'],
        decoration=plate_deco,
    ), f'{out}/armor_plate.png')

    # Dragon Scale — green scales with spikes
    def dragon_deco(img):
        # Scale pattern
        for y in range(7, 18, 2):
            for x in range(6, 18, 2):
                # Draw a small scale curve (darker)
                px(img, x, y, P['green_d'])
                px(img, x + 1, y, P['green_l'])
        # Shoulder spikes
        px(img, 3, 3, P['grey_l'])
        px(img, 4, 2, P['grey_l'])
        px(img, 19, 3, P['grey_l'])
        px(img, 19, 2, P['grey_l'])
        # Green-gold trim
        hline(img, 7, 16, 22, P['green_l'])
    save(_armor_icon(
        body_colors=(P['green_d'], P['green_m'], P['green_l']),
        trim_color=P['gold_m'],
        decoration=dragon_deco,
    ), f'{out}/armor_dragon.png')

    # Maple Aegis / Dawnshard — white radiant plate with maple leaf
    def dawn_deco(img):
        # Maple leaf emblem (center chest, 5x5 ish)
        leaf = [
            (11, 11), (12, 11),
            (10, 12), (11, 12), (12, 12), (13, 12),
            (10, 13), (13, 13),
            (11, 14), (12, 14),
        ]
        for (x, y) in leaf:
            px(img, x, y, P['emerald_l'])
        # Glow halo dots
        px(img, 9, 10, P['white'])
        px(img, 14, 10, P['white'])
        # Gold rivets
        for (rx, ry) in [(6, 7), (17, 7), (6, 17), (17, 17)]:
            px(img, rx, ry, P['gold_l'])
        # Shoulder feather highlights (angel-wing hint)
        px(img, 3, 4, P['white'])
        px(img, 2, 5, P['white'])
        px(img, 20, 4, P['white'])
        px(img, 21, 5, P['white'])
    save(_armor_icon(
        body_colors=(P['eggshell'], P['steel_l'], P['white']),
        trim_color=P['gold_l'],
        decoration=dawn_deco,
    ), f'{out}/armor_dawnshard.png')


# ----------------------------------------------------------------------
# ACCESSORIES — 24x24 inventory icons (spec is 12x12 but we upscale to 24
#                                       to match the weapon/armor icon grid)
# Per user spec actually, accessories are 12x12. But the icon context in
# the game uses 24x24 squares, so we'll center the 12x12 glyph inside 24x24.
# ----------------------------------------------------------------------
def _center_frame(inner):
    """Center a small image inside a 24x24 canvas."""
    out = canvas(24, 24)
    ox = (24 - inner.width) // 2
    oy = (24 - inner.height) // 2
    out.paste(inner, (ox, oy), inner)
    return out


def _acc_ring(band_color, gem_color):
    img = canvas(12, 12)
    # Ring band — small "O"
    circle_outline(img, 6, 6, 4, band_color)
    circle_outline(img, 6, 6, 3, darken(band_color, 20))
    # Highlight on upper-left of band
    px(img, 4, 3, lighten(band_color, 50))
    px(img, 3, 5, lighten(band_color, 50))
    # Gem on top
    px(img, 5, 1, gem_color)
    px(img, 6, 1, gem_color)
    px(img, 5, 2, gem_color)
    px(img, 6, 2, darken(gem_color, 20))
    px(img, 5, 0, lighten(gem_color, 40))
    outline_silhouette(img)
    return img


def gen_accessories():
    out = os.path.join(OUT, 'accessories')

    # Ring of Might — gold with ruby
    save(_center_frame(_acc_ring(P['gold_m'], P['ruby'])),
         f'{out}/acc_ring_might.png')
    # Ring of Wisdom — silver with sapphire
    save(_center_frame(_acc_ring(P['steel_l'], P['sapphire'])),
         f'{out}/acc_ring_wisdom.png')

    # Boots of Swiftness — small boot with wings
    def boots():
        img = canvas(12, 12)
        # Boot body
        rect(img, 4, 5, 8, 9, P['brown_m'])
        rect(img, 3, 9, 9, 10, P['brown_d'])  # sole
        rect(img, 4, 5, 4, 9, P['brown_d'])   # left shadow
        rect(img, 8, 5, 8, 9, P['brown_l'])   # right highlight
        # Upper cuff
        rect(img, 4, 4, 8, 4, P['brown_l'])
        # Wings on the side
        px(img, 2, 6, P['cyan_l'])
        px(img, 1, 7, P['cyan_m'])
        px(img, 2, 7, P['cyan_l'])
        px(img, 10, 6, P['cyan_l'])
        px(img, 11, 7, P['cyan_m'])
        px(img, 10, 7, P['cyan_l'])
        outline_silhouette(img)
        return img
    save(_center_frame(boots()), f'{out}/acc_boots.png')

    # Amulet of Fortune — gold clover pendant
    def amulet():
        img = canvas(12, 12)
        # Chain loop at top
        px(img, 6, 1, P['gold_m'])
        px(img, 5, 2, P['gold_m'])
        px(img, 7, 2, P['gold_m'])
        # Four-leaf clover
        leaf_coords = [
            # Top-left leaf
            (4, 4), (3, 5), (4, 5), (4, 6),
            # Top-right leaf
            (8, 4), (8, 5), (9, 5), (8, 6),
            # Bottom-left leaf
            (4, 7), (3, 7), (4, 8), (4, 9),
            # Bottom-right leaf
            (8, 7), (9, 7), (8, 8), (8, 9),
            # Center
            (5, 6), (6, 6), (7, 6), (5, 7), (6, 7), (7, 7),
            (6, 5), (6, 8),
        ]
        for (x, y) in leaf_coords:
            px(img, x, y, P['green_m'])
        # Highlights
        px(img, 3, 4, P['green_l'])
        px(img, 7, 4, P['green_l'])
        # Gold trim around edges via outline
        outline_silhouette(img, color=P['gold_m'])
        return img
    save(_center_frame(amulet()), f'{out}/acc_amulet.png')

    # Shadow Talisman — jagged black jewel
    def talisman():
        img = canvas(12, 12)
        # Jagged shard shape
        shard = [
            (6, 1),
            (5, 2), (6, 2), (7, 2),
            (4, 3), (5, 3), (6, 3), (7, 3), (8, 3),
            (3, 4), (4, 4), (5, 4), (6, 4), (7, 4), (8, 4),
            (4, 5), (5, 5), (6, 5), (7, 5),
            (5, 6), (6, 6), (7, 6),
            (5, 7), (6, 7),
            (6, 8),
        ]
        for (x, y) in shard:
            px(img, x, y, P['grey_d'])
        # Purple mist aura
        px(img, 2, 4, P['purple_l'])
        px(img, 9, 4, P['purple_l'])
        px(img, 3, 7, P['amethyst'])
        px(img, 8, 7, P['amethyst'])
        # Highlight streak
        px(img, 5, 2, P['purple_l'])
        px(img, 5, 3, P['amethyst'])
        px(img, 5, 4, P['purple_l'])
        outline_silhouette(img)
        return img
    save(_center_frame(talisman()), f'{out}/acc_talisman.png')

    # Maple Medallion — gold medal with maple leaf (legendary)
    def medallion():
        img = canvas(12, 12)
        # Gold circle medal
        circle_fill(img, 6, 6, 4, P['gold_m'])
        circle_fill(img, 5, 5, 2, P['gold_l'])
        # Shadow arc
        px(img, 8, 7, P['gold_d'])
        px(img, 8, 6, P['gold_d'])
        px(img, 7, 8, P['gold_d'])
        # Maple leaf in the middle (tiny emblem)
        px(img, 5, 4, P['emerald'])
        px(img, 6, 4, P['emerald'])
        px(img, 4, 5, P['emerald'])
        px(img, 5, 5, P['emerald_l'])
        px(img, 6, 5, P['emerald'])
        px(img, 7, 5, P['emerald'])
        px(img, 5, 6, P['emerald'])
        px(img, 6, 6, P['emerald_l'])
        px(img, 6, 7, P['emerald'])
        # Ribbon loop at top
        px(img, 5, 1, P['gold_d'])
        px(img, 6, 1, P['gold_m'])
        px(img, 7, 1, P['gold_d'])
        outline_silhouette(img)
        # Glow halo — a few orange dots just outside the circle
        px(img, 1, 6, P['orange_l'])
        px(img, 11, 6, P['orange_l'])
        px(img, 6, 1, P['yellow'])
        return img
    save(_center_frame(medallion()), f'{out}/acc_medallion.png')


if __name__ == '__main__':
    gen_weapons()
    gen_armors()
    gen_accessories()
    print('equipment done ->', OUT)
