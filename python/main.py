"""Pixel Mage - Python/Pygame port.

Run:
    pip install -r requirements.txt
    python main.py

Controls:
    WASD / arrows  -- move
    Space / J      -- melee swing
    K / Left Shift -- cast magic
    F1             -- toggle debug rects
    F2             -- regenerate level
"""
import sys
import pygame

from assets import load_assets
from camera import Camera
from input_state import Input
from renderer import Renderer
from tilemap import Tilemap
from player import Player
from entities import Slime, Coin, MagicBolt, Impact, Burning

TILE = 16
VIEW_W = 320
VIEW_H = 180


class World:
    def __init__(self, entities, assets):
        self.entities = entities
        self.assets = assets

    def spawn_bolt(self, p):
        self.entities.append(MagicBolt(p, self.assets))

    def spawn_impact(self, x, y):
        self.entities.append(Impact(x, y, self.assets))

    def spawn_burning(self, x, y):
        self.entities.append(Burning(x, y, self.assets))


def aabb(a, b):
    ax, ay, aw, ah = _rect(a)
    bx, by, bw, bh = _rect(b)
    return ax < bx + bw and ax + aw > bx and ay < by + bh and ay + ah > by


def _rect(o):
    if isinstance(o, tuple):
        return o
    return (o.x, o.y, o.w, o.h)


class Game:
    def __init__(self):
        pygame.init()
        self.renderer = Renderer(VIEW_W, VIEW_H)
        self.input = Input()
        self.camera = Camera(VIEW_W, VIEW_H)
        self.assets = load_assets()
        self.font = pygame.font.SysFont("monospace", 10)
        self.debug = False
        self.coins_collected = 0
        self.build_level()

    def build_level(self):
        self.map = Tilemap.generate(50, 30, TILE)
        self.player = Player(self.map.spawn[0], self.map.spawn[1], self.assets)
        self.entities = []
        self.world = World(self.entities, self.assets)
        for x, y in self.map.coin_spots:
            self.entities.append(Coin(x, y, self.assets))
        for x, y in self.map.enemy_spots:
            self.entities.append(Slime(x, y, self.assets))
        self.camera.snap_to(self.player.x, self.player.y)
        self.coins_collected = 0

    def run(self):
        clock = pygame.time.Clock()
        STEP = 1.0 / 60.0
        acc = 0.0
        running = True
        while running:
            dt_ms = clock.tick(60)
            dt = min(dt_ms / 1000.0, 0.25)
            for event in pygame.event.get():
                if event.type == pygame.QUIT:
                    running = False
                elif event.type == pygame.KEYDOWN and event.key == pygame.K_ESCAPE:
                    running = False
                else:
                    self.input.handle_event(event)

            acc += dt
            while acc >= STEP:
                self.update(STEP)
                acc -= STEP
            self.render()
        pygame.quit()

    def update(self, dt):
        if self.input.pressed("F1"):
            self.debug = not self.debug
        if self.input.pressed("F2"):
            self.build_level()

        self.player.update(dt, self.input, self.map, self.world)
        for e in self.entities:
            e.update(dt, self.player, self.map)

        # bolt vs slime
        for b in self.entities:
            if b.dead or b.kind != "bolt":
                continue
            for s in self.entities:
                if s.dead or s.kind != "slime":
                    continue
                if aabb(b, s):
                    s.dead = True
                    b.dead = True
                    break

        # melee vs slime
        hit = self.player.melee_hit_rect()
        if hit:
            for s in self.entities:
                if s.dead or s.kind != "slime":
                    continue
                if s in self.player.melee_hit:
                    continue
                if aabb(hit, s):
                    s.dead = True
                    self.player.melee_hit.add(s)

        # impact AOE
        for im in self.entities:
            if im.dead or im.kind != "impact":
                continue
            r = im.damage_rect()
            if not r:
                continue
            for s in self.entities:
                if s.dead or s.kind != "slime":
                    continue
                if s in im.damaged:
                    continue
                if aabb(r, s):
                    s.dead = True
                    im.damaged.add(s)

        # burning DoT
        for bn in self.entities:
            if bn.dead or bn.kind != "burning":
                continue
            if not bn.consume_tick():
                continue
            for s in self.entities:
                if s.dead or s.kind != "slime":
                    continue
                if aabb(bn, s):
                    s.dead = True

        # player pickup + damage
        for e in self.entities:
            if e.dead:
                continue
            if not aabb(self.player, e):
                continue
            if e.kind == "coin":
                e.dead = True
                self.coins_collected += 1
            elif e.kind == "slime":
                self.player.hurt(1)

        # cleanup + chain spawns
        for i in range(len(self.entities) - 1, -1, -1):
            e = self.entities[i]
            if not e.dead:
                continue
            if e.kind == "bolt":
                self.world.spawn_impact(e.x + e.w / 2, e.y + e.h / 2)
            elif e.kind == "impact":
                self.world.spawn_burning(e.x + 16, e.y + 16)
            self.entities.pop(i)

        self.camera.follow(
            self.player.x + self.player.w / 2,
            self.player.y + self.player.h / 2,
            self.map.pixel_w,
            self.map.pixel_h,
        )
        self.input.end_frame()

    def render(self):
        surf = self.renderer.begin((28, 32, 48))
        self.map.draw(surf, self.camera)
        draw_list = sorted(self.entities + [self.player], key=lambda e: e.y + e.h)
        for e in draw_list:
            e.draw(surf, self.camera)
        if self.debug:
            self.draw_debug(surf)
        self.draw_hud(surf)
        self.renderer.present()

    def draw_hud(self, surf):
        for i in range(self.player.max_hp):
            filled = i < self.player.hp
            draw_heart(surf, 4 + i * 10, 4, filled)
        surf.fill((253, 227, 106), (VIEW_W - 28, 6, 6, 6))
        surf.fill((202, 165, 59), (VIEW_W - 28, 11, 6, 1))
        text = self.font.render("x " + str(self.coins_collected), False, (255, 255, 255))
        surf.blit(text, (VIEW_W - 20, 3))

    def draw_debug(self, surf):
        for e in [self.player] + self.entities:
            r = pygame.Rect(round(e.x - self.camera.x), round(e.y - self.camera.y), e.w, e.h)
            pygame.draw.rect(surf, (0, 255, 0), r, 1)
        text = self.font.render(
            f"ent {len(self.entities)}  cam {int(self.camera.x)},{int(self.camera.y)}",
            False, (0, 255, 0),
        )
        surf.blit(text, (4, VIEW_H - 12))


def draw_heart(surf, x, y, filled):
    color = (229, 75, 75) if filled else (58, 42, 42)
    surf.fill(color, (x + 1, y, 2, 1))
    surf.fill(color, (x + 5, y, 2, 1))
    surf.fill(color, (x, y + 1, 8, 3))
    surf.fill(color, (x + 1, y + 4, 6, 1))
    surf.fill(color, (x + 2, y + 5, 4, 1))
    surf.fill(color, (x + 3, y + 6, 2, 1))


if __name__ == "__main__":
    Game().run()
