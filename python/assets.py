import os
import pygame

ASSET_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "assets")

REQUIRED = []
OPTIONAL = [
    "mage_sheet.png",
    "mage_idle.png",
    "mage_cast.png",
    "mage_death.png",
    "mage_melee.png",
    "fx_charge.png",
    "fx_projectile.png",
    "fx_impact.png",
    "fx_burn.png",
]


def load_assets():
    images = {}
    for name in REQUIRED + OPTIONAL:
        path = os.path.join(ASSET_DIR, name)
        if not os.path.isfile(path):
            if name in REQUIRED:
                raise FileNotFoundError(f"missing required asset: {path}")
            continue
        img = pygame.image.load(path).convert_alpha()
        images[name] = img
    return {"images": images}
