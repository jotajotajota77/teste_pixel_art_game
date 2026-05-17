import random
import math
import pygame


class Tilemap:
    """Tile ids: 0 grass, 1 stone (solid), 2 water (solid), 3 path/dirt."""

    def __init__(self, w, h, tile):
        self.w = w
        self.h = h
        self.tile = tile
        self.pixel_w = w * tile
        self.pixel_h = h * tile
        self.data = bytearray(w * h)
        self.spawn = (tile * 2, tile * 2)
        self.coin_spots = []
        self.enemy_spots = []

    @staticmethod
    def generate(w, h, tile):
        m = Tilemap(w, h, tile)

        for x in range(w):
            m.data[x] = 1
            m.data[(h - 1) * w + x] = 1
        for y in range(h):
            m.data[y * w] = 1
            m.data[y * w + (w - 1)] = 1

        for _ in range(30):
            cx = 2 + int(random.random() * (w - 4))
            cy = 2 + int(random.random() * (h - 4))
            r = 1 + int(random.random() * 2)
            for y in range(-r, r + 1):
                for x in range(-r, r + 1):
                    if x * x + y * y <= r * r and random.random() > 0.3:
                        m._set(cx + x, cy + y, 1)

        pcx = int(w * 0.7)
        pcy = int(h * 0.6)
        for y in range(-3, 4):
            for x in range(-4, 5):
                if (x * x) / 16 + (y * y) / 9 <= 1:
                    m._set(pcx + x, pcy + y, 2)

        path_y = h // 2
        for x in range(1, w - 1):
            m._set(x, path_y, 3)
            m._set(x, path_y + 1, 3)

        m.spawn = m._find_open_tile()

        for _ in range(12):
            p = m._find_open_tile()
            m.coin_spots.append((p[0] + 4, p[1] + 4))
        for _ in range(6):
            p = m._find_open_tile()
            m.enemy_spots.append((p[0], p[1]))
        return m

    def _set(self, x, y, v):
        if x <= 0 or y <= 0 or x >= self.w - 1 or y >= self.h - 1:
            return
        self.data[y * self.w + x] = v

    def _find_open_tile(self):
        for _ in range(200):
            x = 2 + int(random.random() * (self.w - 4))
            y = 2 + int(random.random() * (self.h - 4))
            if not self.solid_tile(x, y):
                return (x * self.tile, y * self.tile)
        return (self.tile * 2, self.tile * 2)

    def tile_at(self, x, y):
        if x < 0 or y < 0 or x >= self.w or y >= self.h:
            return 1
        return self.data[y * self.w + x]

    def solid_tile(self, tx, ty):
        v = self.tile_at(tx, ty)
        return v == 1 or v == 2

    def rect_solid(self, x, y, w, h):
        t = self.tile
        x0 = math.floor(x / t)
        y0 = math.floor(y / t)
        x1 = math.floor((x + w - 1) / t)
        y1 = math.floor((y + h - 1) / t)
        for ty in range(y0, y1 + 1):
            for tx in range(x0, x1 + 1):
                if self.solid_tile(tx, ty):
                    return True
        return False

    def draw(self, surf, camera):
        t = self.tile
        x0 = max(0, math.floor(camera.x / t))
        y0 = max(0, math.floor(camera.y / t))
        x1 = min(self.w - 1, math.floor((camera.x + surf.get_width()) / t))
        y1 = min(self.h - 1, math.floor((camera.y + surf.get_height()) / t))
        cam_x = round(camera.x)
        cam_y = round(camera.y)
        ticks = pygame.time.get_ticks()
        for ty in range(y0, y1 + 1):
            for tx in range(x0, x1 + 1):
                v = self.data[ty * self.w + tx]
                px = tx * t - cam_x
                py = ty * t - cam_y
                draw_tile(surf, v, px, py, t, tx, ty, ticks)


def draw_tile(surf, v, px, py, t, tx, ty, ticks):
    if v == 0:
        surf.fill((79, 138, 74), (px, py, t, t))
        seed = (tx * 928371 + ty * 12849) & 0xFFFFFFFF
        dot = (63, 122, 58)
        for i in range(6):
            r = (seed * (i + 1) * 2654435761) & 0xFFFFFFFF
            surf.fill(dot, (px + (r % t), py + ((r >> 8) % t), 1, 1))
    elif v == 1:
        surf.fill((111, 114, 131), (px, py, t, t))
        surf.fill((73, 76, 91), (px, py + t - 2, t, 2))
        surf.fill((73, 76, 91), (px + t - 2, py, 2, t))
        surf.fill((140, 144, 163), (px, py, t, 1))
        surf.fill((140, 144, 163), (px, py, 1, t))
    elif v == 2:
        phase = int(ticks / 600 + tx * 0.7 + ty * 0.5) % 2
        surf.fill((58, 95, 191), (px, py, t, t))
        surf.fill((90, 139, 224), (px + 2, py + 4 + phase, 4, 1))
        surf.fill((90, 139, 224), (px + 9, py + 10 - phase, 5, 1))
    elif v == 3:
        surf.fill((160, 122, 79), (px, py, t, t))
        seed = (tx * 73 + ty * 19) & 0xFFFFFFFF
        dot = (138, 100, 56)
        for i in range(4):
            r = (seed * (i + 3) * 2654435761) & 0xFFFFFFFF
            surf.fill(dot, (px + (r % t), py + ((r >> 4) % t), 1, 1))
