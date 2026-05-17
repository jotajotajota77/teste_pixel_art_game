import pygame

# Maps pygame key constants to game input names.
KEY_ALIAS = {
    pygame.K_LEFT: "left", pygame.K_RIGHT: "right", pygame.K_UP: "up", pygame.K_DOWN: "down",
    pygame.K_a: "left", pygame.K_d: "right", pygame.K_w: "up", pygame.K_s: "down",
    pygame.K_SPACE: "melee", pygame.K_RETURN: "melee", pygame.K_j: "melee",
    pygame.K_k: "magic", pygame.K_LSHIFT: "magic",
    pygame.K_F1: "F1", pygame.K_F2: "F2",
}


class Input:
    def __init__(self):
        self.held = set()
        self.just_pressed = set()

    def handle_event(self, event):
        if event.type == pygame.KEYDOWN:
            name = KEY_ALIAS.get(event.key)
            if name and name not in self.held:
                self.just_pressed.add(name)
                self.held.add(name)
        elif event.type == pygame.KEYUP:
            name = KEY_ALIAS.get(event.key)
            if name:
                self.held.discard(name)
        elif event.type == pygame.WINDOWFOCUSLOST:
            self.held.clear()

    def down(self, name):
        return name in self.held

    def pressed(self, name):
        return name in self.just_pressed

    def axis(self):
        x = (1 if self.down("right") else 0) - (1 if self.down("left") else 0)
        y = (1 if self.down("down") else 0) - (1 if self.down("up") else 0)
        return x, y

    def end_frame(self):
        self.just_pressed.clear()
