import pygame


class Renderer:
    """Pixel-perfect renderer: draws to a low-res buffer then scales
    nearest-neighbor to the display. Integer scale only."""

    def __init__(self, view_w, view_h, scale=None):
        self.view_w = view_w
        self.view_h = view_h
        info = pygame.display.Info()
        if scale is None:
            margin = 80
            scale = max(1, min(
                (info.current_w - 32) // view_w,
                (info.current_h - margin) // view_h,
            ))
        self.scale = scale
        self.display = pygame.display.set_mode((view_w * scale, view_h * scale))
        pygame.display.set_caption("Pixel Mage")
        self.buffer = pygame.Surface((view_w, view_h)).convert()

    def begin(self, clear_color):
        self.buffer.fill(clear_color)
        return self.buffer

    def present(self):
        pygame.transform.scale(self.buffer, self.display.get_size(), self.display)
        pygame.display.flip()
