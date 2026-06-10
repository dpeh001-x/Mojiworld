from PIL import Image
import os

base = '/sessions/friendly-compassionate-albattani/mnt/LevelX/sprites'

expected = {
    'character': {
        'base_male.png': (192, 48),
        'base_female.png': (192, 48),
        'overlays/hair/spiky_brown.png': (192, 48),
        'overlays/hair/spiky_gold.png': (192, 48),
        'overlays/hair/long_silver.png': (192, 48),
        'overlays/hair/ponytail_blonde.png': (192, 48),
        'overlays/armor/cloth_tunic.png': (192, 48),
        'overlays/armor/leather_vest.png': (192, 48),
        'overlays/armor/chain_mail.png': (192, 48),
        'overlays/armor/plate_armor.png': (192, 48),
        'overlays/armor/dragon_scale.png': (192, 48),
        'overlays/armor/dawnshard_aegis.png': (192, 48),
        'overlays/cape/wine_red.png': (192, 48),
        'overlays/cape/royal_blue.png': (192, 48),
        'overlays/cape/dawnshard.png': (192, 48),
        'overlays/helmet/iron_cap.png': (192, 48),
        'overlays/helmet/knight_plume.png': (192, 48),
        'overlays/helmet/dawnshard_crown.png': (192, 48),
        'overlays/shield/wooden.png': (192, 48),
        'overlays/shield/iron.png': (192, 48),
        'overlays/shield/knight_kite.png': (192, 48),
        'overlays/weapon/sword_wood.png': (192, 48),
        'overlays/weapon/sword_iron.png': (192, 48),
        'overlays/weapon/sword_steel.png': (192, 48),
        'overlays/weapon/sword_runed.png': (192, 48),
        'overlays/weapon/sword_katana.png': (192, 48),
        'overlays/weapon/sword_dawnshard.png': (192, 48),
        'overlays/boots/leather.png': (192, 48),
        'overlays/boots/plate.png': (192, 48),
        'overlays/boots/dawnshard.png': (192, 48),
    },
    'items': {
        'potion_hp.png': (12, 16),
        'potion_mp.png': (12, 16),
        'potion_orange.png': (12, 16),
        'potion_elixir.png': (12, 16),
        'coin.png': (48, 12),
        'chest_wood_closed.png': (28, 24),
        'chest_wood_open.png': (28, 24),
        'chest_silver_closed.png': (28, 24),
        'chest_silver_open.png': (28, 24),
        'chest_gold_closed.png': (28, 24),
        'chest_gold_open.png': (28, 24),
        'orb_common.png': (26, 26),
        'orb_rare.png': (26, 26),
        'orb_epic.png': (26, 26),
        'orb_legendary.png': (26, 26),
    },
    'equipment': {
        'weapons/sword_wood.png': (24, 24),
        'weapons/sword_iron.png': (24, 24),
        'weapons/sword_steel.png': (24, 24),
        'weapons/sword_runed.png': (24, 24),
        'weapons/sword_katana.png': (24, 24),
        'weapons/sword_dawnshard.png': (24, 24),
        'armors/armor_cloth.png': (24, 24),
        'armors/armor_leather.png': (24, 24),
        'armors/armor_chain.png': (24, 24),
        'armors/armor_plate.png': (24, 24),
        'armors/armor_dragon.png': (24, 24),
        'armors/armor_dawnshard.png': (24, 24),
        'accessories/acc_ring_might.png': (24, 24),
        'accessories/acc_ring_wisdom.png': (24, 24),
        'accessories/acc_boots.png': (24, 24),
        'accessories/acc_amulet.png': (24, 24),
        'accessories/acc_talisman.png': (24, 24),
        'accessories/acc_medallion.png': (24, 24),
    },
    'vfx': {
        'slash.png':      (128, 32),   # 4 x 32
        'magic_bolt.png': (128, 32),
        'fireball.png':   (192, 32),   # 6 x 32
        'ice_spike.png':  (128, 48),
        'meteor.png':     (288, 48),   # 6 x 48
        'level_up.png':   (384, 48),   # 8 x 48
        'portal.png':     (192, 48),   # 4 x 48
        'death.png':      (240, 48),   # 5 x 48
    },
    'ui': {
        'hp_bar.png':             (200, 14),
        'mp_bar.png':             (200, 14),
        'exp_bar.png':            (200, 14),
        'skill_slot.png':         (52, 64),
        'skill_slot_cooldown.png':(52, 64),
        'dialog_box.png':         (384, 112),
        'menu_panel.png':         (256, 320),
        'button.png':             (96, 32),
    },
}

ok = 0
bad = []
missing = []
for cat, files in expected.items():
    for name, size in files.items():
        path = os.path.join(base, cat, name)
        if not os.path.exists(path):
            missing.append(path)
            continue
        im = Image.open(path)
        if im.size != size:
            bad.append((path, im.size, size))
        else:
            ok += 1

print(f'OK: {ok} / {sum(len(v) for v in expected.values())}')
if missing:
    print('\nMISSING:')
    for p in missing: print(' ', p)
if bad:
    print('\nWRONG SIZE:')
    for (p, got, want) in bad:
        print(f'  {p}  got={got} want={want}')
