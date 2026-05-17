class Camera:
    def __init__(self, view_w, view_h):
        self.view_w = view_w
        self.view_h = view_h
        self.x = 0
        self.y = 0
        self.dz_w = 40
        self.dz_h = 24

    def snap_to(self, cx, cy):
        self.x = round(cx - self.view_w / 2)
        self.y = round(cy - self.view_h / 2)

    def follow(self, cx, cy, world_w, world_h):
        left = self.x + (self.view_w - self.dz_w) / 2
        right = left + self.dz_w
        top = self.y + (self.view_h - self.dz_h) / 2
        bot = top + self.dz_h

        if cx < left:
            self.x -= left - cx
        elif cx > right:
            self.x += cx - right
        if cy < top:
            self.y -= top - cy
        elif cy > bot:
            self.y += cy - bot

        if world_w > self.view_w:
            self.x = max(0, min(self.x, world_w - self.view_w))
        else:
            self.x = (world_w - self.view_w) / 2
        if world_h > self.view_h:
            self.y = max(0, min(self.y, world_h - self.view_h))
        else:
            self.y = (world_h - self.view_h) / 2
