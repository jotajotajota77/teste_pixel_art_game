import math
import random
import pygame

DIR_VEC = {
    "down":  (0, 1),
    "up":    (0, -1),
    "left":  (-1, 0),
    "right": (1, 0),
}

BOLT_FW, BOLT_FH = 24, 20
IMPACT_FW, IMPACT_FH = 32, 32
BURN_FW, BURN_FH = 14, 14
IMPACT_DUR = 0.42
BURN_DUR = 1.6

# Degrees (pygame.transform.rotate uses degrees, counter-clockwise positive).
# The projectile sheet points right; rotating CCW by these values aims it.
DIR_DEG = {
    "right": 0,
    "down":  -90,
    "left":  180,
    "up":    90,
}


class MagicBolt:
    kind = "bolt"

    def __init__(self, player, assets):
        self.facing = player.facing
        d = DIR_VEC[player.facing]
        self.x = player.x + player.w / 2 - 4 + d[0] * 8
        self.y = player.y + player.h / 2 - 4 + d[1] * 8
        self.w = 8
        self.h = 8
        self.vx = d[0] * 140
        self.vy = d[1] * 140
        self.life = 0.9
        self.t = 0.0
        self.dead = False
        sheet = assets["images"].get("fx_projectile.png") if assets else None
        self.frames = None
        if sheet is not None:
            self.frames = []
            for i in range(4):
                sub = sheet.subsurface((i * BOLT_FW, 0, BOLT_FW, BOLT_FH))
                self.frames.append(pygame.transform.rotate(sub, DIR_DEG[self.facing]))

    def update(self, dt, _player, tmap):
        self.t += dt
        self.life -= dt
        if self.life <= 0:
            self.dead = True
            return
        nx = self.x + self.vx * dt
        ny = self.y + self.vy * dt
        if tmap.rect_solid(nx, ny, self.w, self.h):
            self.dead = True
            return
        self.x = nx
        self.y = ny

    def draw(self, surf, camera):
        cx = round(self.x + self.w / 2 - camera.x)
        cy = round(self.y + self.h / 2 - camera.y)
        if self.frames:
            frame = int(self.t * 14) % 4
            img = self.frames[frame]
            r = img.get_rect(center=(cx, cy))
            surf.blit(img, r)
            return
        # fallback
        surf.fill((255, 220, 120), (cx - 5, cy - 5, 10, 10))
        col = (255, 247, 196) if int(self.t * 20) % 2 else (253, 227, 106)
        surf.fill(col, (cx - 2, cy - 2, 4, 4))


class Impact:
    kind = "impact"

    def __init__(self, x, y, assets):
        self.x = x - IMPACT_FW / 2
        self.y = y - IMPACT_FH / 2
        self.w = 16
        self.h = 16
        self.t = 0.0
        self.dead = False
        self.sheet = assets["images"].get("fx_impact.png") if assets else None
        self.damaged = set()

    def update(self, dt, _player=None, _map=None):
        self.t += dt
        if self.t >= IMPACT_DUR:
            self.dead = True

    def damage_rect(self):
        if self.t > IMPACT_DUR * 0.4:
            return None
        return (self.x + 4, self.y + 4, IMPACT_FW - 8, IMPACT_FH - 8)

    def draw(self, surf, camera):
        if not self.sheet:
            return
        p = min(0.999, self.t / IMPACT_DUR)
        frame = int(p * 6)
        dx = round(self.x - camera.x)
        dy = round(self.y - camera.y)
        surf.blit(self.sheet, (dx, dy), (frame * IMPACT_FW, 0, IMPACT_FW, IMPACT_FH))


class Burning:
    kind = "burning"

    def __init__(self, x, y, assets):
        self.x = x - BURN_FW / 2
        self.y = y - BURN_FH / 2 + 4
        self.w = BURN_FW
        self.h = BURN_FH - 4
        self.t = 0.0
        self.dead = False
        self.sheet = assets["images"].get("fx_burn.png") if assets else None
        self.tick_accum = 0.0

    def update(self, dt, _player=None, _map=None):
        self.t += dt
        self.tick_accum += dt
        if self.t >= BURN_DUR:
            self.dead = True

    def consume_tick(self):
        if self.tick_accum >= 0.3:
            self.tick_accum = 0.0
            return True
        return False

    def draw(self, surf, camera):
        dx = round(self.x - camera.x)
        dy = round(self.y - camera.y)
        if self.sheet:
            frame = int(self.t * 10) % 4
            sub = self.sheet.subsurface((frame * BURN_FW, 0, BURN_FW, BURN_FH))
            if self.t > BURN_DUR - 0.3:
                a = max(0.0, (BURN_DUR - self.t) / 0.3)
                tmp = sub.copy()
                tmp.set_alpha(int(255 * a))
                surf.blit(tmp, (dx, dy))
            else:
                surf.blit(sub, (dx, dy))
        else:
            surf.fill((229, 75, 75), (dx + 4, dy + 4, 6, 6))


class Coin:
    kind = "coin"

    def __init__(self, x, y, assets=None):
        self.x = x
        self.y = y
        self.w = 6
        self.h = 6
        self.bob = random.random() * math.pi * 2
        self.dead = False

    def update(self, dt, _player=None, _map=None):
        self.bob += dt * 5

    def draw(self, surf, camera):
        dy = math.sin(self.bob) * 1.5
        px = round(self.x - camera.x)
        py = round(self.y - camera.y + dy)
        surf.fill((40, 30, 0), (px, int(self.y - camera.y + 6), 6, 1))
        surf.fill((202, 165, 59), (px, py, 6, 6))
        surf.fill((253, 227, 106), (px + 1, py + 1, 4, 4))
        surf.fill((255, 247, 196), (px + 2, py + 1, 1, 1))


class Slime:
    kind = "slime"

    def __init__(self, x, y, assets=None):
        self.x = x
        self.y = y
        self.w = 12
        self.h = 10
        self.vx = 0.0
        self.vy = 0.0
        self.tick = random.random() * 2
        self.dir_timer = 0.0
        self.dead = False
        self.squish = 0.0

    def update(self, dt, player, tmap):
        self.tick += dt
        self.squish = (math.sin(self.tick * 4) + 1) * 0.5

        dx = (player.x + player.w / 2) - (self.x + self.w / 2)
        dy = (player.y + player.h / 2) - (self.y + self.h / 2)
        dist2 = dx * dx + dy * dy

        if dist2 < 64 * 64:
            inv = 1.0 / math.sqrt(dist2 or 1)
            self.vx = dx * inv * 30
            self.vy = dy * inv * 30
        else:
            self.dir_timer -= dt
            if self.dir_timer <= 0:
                a = random.random() * math.pi * 2
                self.vx = math.cos(a) * 18
                self.vy = math.sin(a) * 18
                self.dir_timer = 1.0 + random.random() * 1.5

        mx = self.vx * dt
        my = self.vy * dt
        if not tmap.rect_solid(self.x + mx, self.y, self.w, self.h):
            self.x += mx
        else:
            self.vx *= -1
        if not tmap.rect_solid(self.x, self.y + my, self.w, self.h):
            self.y += my
        else:
            self.vy *= -1

    def draw(self, surf, camera):
        px = round(self.x - camera.x)
        py = round(self.y - camera.y)
        sq = int(self.squish)
        shadow = pygame.Surface((self.w - 2, 2), pygame.SRCALPHA)
        shadow.fill((0, 0, 0, 90))
        surf.blit(shadow, (px + 1, py + self.h - 1))
        surf.fill((74, 176, 122), (px + 1, py + 3 - sq, 10, 7 + sq))
        surf.fill((122, 216, 166), (px + 2, py + 3 - sq, 8, 1))
        surf.fill((255, 255, 255), (px + 3, py + 5, 2, 2))
        surf.fill((255, 255, 255), (px + 7, py + 5, 2, 2))
        surf.fill((0, 0, 0), (px + 4, py + 6, 1, 1))
        surf.fill((0, 0, 0), (px + 8, py + 6, 1, 1))
