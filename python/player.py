import math
import pygame

SPRITE_SIZE = 32
ROW = {"down": 0, "left": 1, "right": 1, "up": 3}
CAST_DUR = 0.40
CAST_FIRE_AT = 0.20
MELEE_DUR = 0.32
MELEE_HIT_START = 0.14
MELEE_HIT_END = 0.24
DEATH_DUR = 1.2
DEATH_LINGER = 0.8


class Player:
    def __init__(self, x, y, assets):
        self.x = x
        self.y = y
        self.w = 12
        self.h = 12
        self.speed = 64
        self.facing = "down"
        self.anim = 0.0
        self.max_hp = 4
        self.hp = 4
        self.iframes = 0.0
        self.attack_cd = 0.0
        self.attacking = False
        self.assets = assets
        imgs = assets["images"] if assets else {}
        self.walk_sheet = imgs.get("mage_sheet.png")
        self.idle_sheet = imgs.get("mage_idle.png")
        self.cast_sheet = imgs.get("mage_cast.png")
        self.death_sheet = imgs.get("mage_death.png")
        self.melee_sheet = imgs.get("mage_melee.png")
        self.charge_sheet = imgs.get("fx_charge.png")
        self.sheet = self.walk_sheet
        self.idle_time = 0.0
        self.cast_time = 0.0
        self.cast_fired = False
        self.melee_time = 0.0
        self.melee_hit = set()
        self.dying_time = 0.0
        self.spawn_x = x
        self.spawn_y = y

    def hurt(self, n):
        if self.iframes > 0 or self.dying_time > 0:
            return
        self.hp = max(0, self.hp - n)
        self.iframes = 1.0
        if self.hp == 0:
            self.dying_time = 0.0001
            self.cast_time = 0
            self.attack_cd = 0

    def update(self, dt, inp, tmap, world):
        if self.dying_time > 0:
            self.dying_time += dt
            if self.dying_time >= DEATH_DUR + DEATH_LINGER:
                self.x = self.spawn_x
                self.y = self.spawn_y
                self.hp = self.max_hp
                self.dying_time = 0.0
                self.iframes = 1.0
                self.facing = "down"
            return

        self.iframes = max(0.0, self.iframes - dt)
        self.attack_cd = max(0.0, self.attack_cd - dt)

        idle = self.cast_time == 0 and self.melee_time == 0 and self.attack_cd == 0
        if inp.pressed("melee") and idle:
            self.melee_time = 0.0001
            self.melee_hit.clear()
            self.attack_cd = MELEE_DUR + 0.05
        elif inp.pressed("magic") and idle:
            self.cast_time = 0.0001
            self.cast_fired = False
            self.attack_cd = CAST_DUR + 0.10

        if self.cast_time > 0:
            self.cast_time += dt
            if not self.cast_fired and self.cast_time >= CAST_FIRE_AT:
                self.cast_fired = True
                if world:
                    world.spawn_bolt(self)
            if self.cast_time >= CAST_DUR:
                self.cast_time = 0.0
        if self.melee_time > 0:
            self.melee_time += dt
            if self.melee_time >= MELEE_DUR:
                self.melee_time = 0.0
        self.attacking = self.melee_time > 0

        ax, ay = inp.axis()
        mx, my = ax, ay
        if mx and my:
            mx *= 0.7071
            my *= 0.7071
        if self.cast_time > 0:
            mx *= 0.25
            my *= 0.25
        if self.melee_time > 0:
            mx *= 0.45
            my *= 0.45

        if mx != 0 or my != 0:
            if abs(mx) > abs(my):
                self.facing = "right" if mx > 0 else "left"
            else:
                self.facing = "down" if my > 0 else "up"
            self.anim += dt * 8
            self.idle_time = 0.0
        else:
            self.anim = 0.0
            self.idle_time += dt

        dx = mx * self.speed * dt
        dy = my * self.speed * dt
        if not tmap.rect_solid(self.x + dx, self.y, self.w, self.h):
            self.x += dx
        if not tmap.rect_solid(self.x, self.y + dy, self.w, self.h):
            self.y += dy

    def draw(self, surf, camera):
        px = round(self.x - camera.x)
        py = round(self.y - camera.y)

        if self.dying_time > 0 and self.death_sheet:
            self._draw_death(surf, px, py)
            return

        if self.iframes > 0 and int(self.iframes * 20) % 2 == 0:
            return

        if self.sheet:
            self._draw_sprite(surf, px, py)
            if 0 < self.cast_time < CAST_FIRE_AT and self.charge_sheet:
                self._draw_charge_fx(surf, px, py)
            return

        # procedural fallback omitted in port (assets are present)

    def _draw_charge_fx(self, surf, px, py):
        FW, FH = 24, 24
        p = min(0.999, self.cast_time / CAST_FIRE_AT)
        frame = int(p * 4)
        cx = px + self.w / 2 - FW / 2
        cy = py - 8
        if self.facing == "left":
            cx -= 8; cy += 4
        elif self.facing == "right":
            cx += 8; cy += 4
        elif self.facing == "up":
            cy -= 2
        surf.blit(self.charge_sheet, (round(cx), round(cy)), (frame * FW, 0, FW, FH))

    def melee_hit_rect(self):
        if self.melee_time < MELEE_HIT_START or self.melee_time > MELEE_HIT_END:
            return None
        reach = 10
        if self.facing == "down":
            return (self.x - 2, self.y + self.h, self.w + 4, reach)
        if self.facing == "up":
            return (self.x - 2, self.y - reach, self.w + 4, reach)
        if self.facing == "left":
            return (self.x - reach, self.y - 2, reach, self.h + 4)
        return (self.x + self.w, self.y - 2, reach, self.h + 4)

    def _draw_death(self, surf, px, py):
        p = min(0.999, self.dying_time / DEATH_DUR)
        frame = min(7, int(p * 8))
        sx = frame * SPRITE_SIZE
        dx = round(px + (self.w - SPRITE_SIZE) / 2)
        dy = round(py + self.h - SPRITE_SIZE + 2)
        shadow = pygame.Surface((self.w - 2, 2), pygame.SRCALPHA)
        shadow.fill((0, 0, 0, 102))
        surf.blit(shadow, (px + 1, py + self.h - 1))
        surf.blit(self.death_sheet, (dx, dy), (sx, 0, SPRITE_SIZE, SPRITE_SIZE))

    def _draw_sprite(self, surf, px, py):
        casting = self.cast_time > 0 and self.cast_sheet
        meleeing = self.melee_time > 0 and self.melee_sheet
        moving = self.anim > 0

        if meleeing:
            sheet = self.melee_sheet
            p = min(0.999, self.melee_time / MELEE_DUR)
            frame = int(p * 4)
        elif casting:
            sheet = self.cast_sheet
            p = min(0.999, self.cast_time / CAST_DUR)
            frame = int(p * 4)
        elif not moving and self.idle_sheet:
            sheet = self.idle_sheet
            frame = int(self.idle_time * 3) % 4
        else:
            sheet = self.walk_sheet
            frame = int(self.anim) % 4

        row = ROW[self.facing]
        flip = self.facing == "right"
        sx = frame * SPRITE_SIZE
        sy = row * SPRITE_SIZE

        shadow = pygame.Surface((self.w - 2, 2), pygame.SRCALPHA)
        shadow.fill((0, 0, 0, 90))
        surf.blit(shadow, (px + 1, py + self.h - 1))

        dx = px + (self.w - SPRITE_SIZE) / 2
        dy = py + self.h - SPRITE_SIZE + 2

        if flip:
            sub = sheet.subsurface((sx, sy, SPRITE_SIZE, SPRITE_SIZE))
            flipped = pygame.transform.flip(sub, True, False)
            surf.blit(flipped, (round(dx), round(dy)))
        else:
            surf.blit(sheet, (round(dx), round(dy)), (sx, sy, SPRITE_SIZE, SPRITE_SIZE))
