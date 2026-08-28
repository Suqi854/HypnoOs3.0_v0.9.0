from __future__ import annotations

import argparse
from collections import deque
from pathlib import Path

from PIL import Image


FRAME_SIZE = 96
GRID_COLUMNS = 4
GRID_ROWS = 2
GROUPS = ("idle", "unique-a", "unique-b", "drag", "enter", "exit")


def color_distance(left: tuple[int, int, int], right: tuple[int, int, int]) -> int:
    return max(abs(left[index] - right[index]) for index in range(3))


def remove_connected_background(image: Image.Image, threshold: int) -> Image.Image:
    source = image.convert("RGB")
    width, height = source.size
    pixels = source.load()
    background = bytearray(width * height)
    queue: deque[tuple[int, int]] = deque()

    def seed(x: int, y: int) -> None:
        offset = y * width + x
        if background[offset]:
            return
        background[offset] = 1
        queue.append((x, y))

    for x in range(width):
        seed(x, 0)
        seed(x, height - 1)
    for y in range(1, height - 1):
        seed(0, y)
        seed(width - 1, y)

    while queue:
        x, y = queue.popleft()
        current = pixels[x, y]
        for next_x, next_y in ((x - 1, y), (x + 1, y), (x, y - 1), (x, y + 1)):
            if next_x < 0 or next_y < 0 or next_x >= width or next_y >= height:
                continue
            offset = next_y * width + next_x
            if background[offset] or color_distance(current, pixels[next_x, next_y]) > threshold:
                continue
            background[offset] = 1
            queue.append((next_x, next_y))

    result = source.convert("RGBA")
    alpha = Image.new("L", (width, height), 255)
    alpha.putdata([0 if value else 255 for value in background])
    result.putalpha(alpha)
    return result


def normalize_frame(image: Image.Image) -> Image.Image:
    bounds = image.getchannel("A").point(lambda value: 255 if value > 16 else 0).getbbox()
    if not bounds:
        raise ValueError("sprite frame became empty after background removal")
    subject = image.crop(bounds)
    scale = min((FRAME_SIZE - 6) / subject.width, (FRAME_SIZE - 4) / subject.height)
    subject = subject.resize((max(1, round(subject.width * scale)), max(1, round(subject.height * scale))), Image.Resampling.LANCZOS)
    frame = Image.new("RGBA", (FRAME_SIZE, FRAME_SIZE), (0, 0, 0, 0))
    x = (FRAME_SIZE - subject.width) // 2
    y = FRAME_SIZE - subject.height - 2
    frame.alpha_composite(subject, (x, y))
    return fill_enclosed_alpha_holes(frame)


def fill_enclosed_alpha_holes(image: Image.Image) -> Image.Image:
    source = image.convert("RGBA")
    pixels = source.load()
    outside = bytearray(FRAME_SIZE * FRAME_SIZE)
    queue: deque[tuple[int, int]] = deque()

    def seed(x: int, y: int) -> None:
        offset = y * FRAME_SIZE + x
        if outside[offset] or pixels[x, y][3] > 16:
            return
        outside[offset] = 1
        queue.append((x, y))

    for x in range(FRAME_SIZE):
        seed(x, 0)
        seed(x, FRAME_SIZE - 1)
    for y in range(1, FRAME_SIZE - 1):
        seed(0, y)
        seed(FRAME_SIZE - 1, y)
    while queue:
        x, y = queue.popleft()
        for next_x, next_y in ((x - 1, y), (x + 1, y), (x, y - 1), (x, y + 1)):
            if 0 <= next_x < FRAME_SIZE and 0 <= next_y < FRAME_SIZE:
                seed(next_x, next_y)

    holes = {
        (x, y)
        for y in range(FRAME_SIZE)
        for x in range(FRAME_SIZE)
        if pixels[x, y][3] <= 16 and not outside[y * FRAME_SIZE + x]
    }
    while holes:
        resolved: list[tuple[int, int, tuple[int, int, int, int]]] = []
        for x, y in holes:
            neighbors = [
                pixels[next_x, next_y]
                for next_x, next_y in ((x - 1, y), (x + 1, y), (x, y - 1), (x, y + 1))
                if 0 <= next_x < FRAME_SIZE and 0 <= next_y < FRAME_SIZE and (next_x, next_y) not in holes and pixels[next_x, next_y][3] > 16
            ]
            if neighbors:
                resolved.append((x, y, tuple(round(sum(color[channel] for color in neighbors) / len(neighbors)) for channel in range(3)) + (255,)))
        if not resolved:
            break
        for x, y, color in resolved:
            pixels[x, y] = color
            holes.remove((x, y))
    return source


def remove_alpha_specks(image: Image.Image) -> Image.Image:
    source = image.convert("RGBA")
    width, height = source.size
    alpha = source.getchannel("A").point(lambda value: value if value > 16 else 0)
    alpha_pixels = alpha.load()
    visited = bytearray(width * height)
    components: list[list[tuple[int, int]]] = []

    for y in range(height):
        for x in range(width):
            offset = y * width + x
            if visited[offset] or alpha_pixels[x, y] <= 16:
                continue
            visited[offset] = 1
            queue = deque([(x, y)])
            component: list[tuple[int, int]] = []
            while queue:
                current_x, current_y = queue.popleft()
                component.append((current_x, current_y))
                for next_x, next_y in ((current_x - 1, current_y), (current_x + 1, current_y), (current_x, current_y - 1), (current_x, current_y + 1)):
                    if next_x < 0 or next_y < 0 or next_x >= width or next_y >= height:
                        continue
                    next_offset = next_y * width + next_x
                    if visited[next_offset] or alpha_pixels[next_x, next_y] <= 16:
                        continue
                    visited[next_offset] = 1
                    queue.append((next_x, next_y))
            components.append(component)

    if not components:
        raise ValueError("transparent source frame does not contain a subject")
    largest = max(len(component) for component in components)
    minimum = max(12, largest // 200)
    clean_alpha = alpha.copy()
    clean_pixels = clean_alpha.load()
    for component in components:
        if len(component) >= minimum:
            continue
        for x, y in component:
            clean_pixels[x, y] = 0
    source.putalpha(clean_alpha)
    return source


def compose_strip(frames: list[Image.Image]) -> Image.Image:
    strip = Image.new("RGBA", (FRAME_SIZE * len(frames), FRAME_SIZE), (0, 0, 0, 0))
    for index, frame in enumerate(frames):
        strip.alpha_composite(frame, (index * FRAME_SIZE, 0))
    return strip


def main() -> None:
    parser = argparse.ArgumentParser(description="Build HypnoOS 96px pet strips from a 4x2 source sheet.")
    parser.add_argument("--source", required=True, type=Path)
    parser.add_argument("--pet-id", required=True)
    parser.add_argument("--output-dir", required=True, type=Path)
    parser.add_argument("--threshold", type=int, default=18)
    parser.add_argument("--layout", choices=("4x2", "8x1"), default="4x2")
    args = parser.parse_args()

    frames: list[Image.Image] = []
    if args.layout == "8x1":
        source = Image.open(args.source).convert("RGBA")
        for index in range(8):
            left = round(index * source.width / 8)
            right = round((index + 1) * source.width / 8)
            cell = remove_alpha_specks(source.crop((left, 0, right, source.height)))
            frames.append(normalize_frame(cell))
    else:
        source = Image.open(args.source).convert("RGB")
        if source.width % GRID_COLUMNS or source.height % GRID_ROWS:
            raise ValueError("source dimensions must divide evenly into a 4x2 grid")
        cell_width = source.width // GRID_COLUMNS
        cell_height = source.height // GRID_ROWS
        for row in range(GRID_ROWS):
            for column in range(GRID_COLUMNS):
                cell = source.crop((
                    column * cell_width,
                    row * cell_height,
                    (column + 1) * cell_width,
                    (row + 1) * cell_height,
                ))
                frames.append(normalize_frame(remove_connected_background(cell, args.threshold)))

    target = args.output_dir / args.pet_id
    target.mkdir(parents=True, exist_ok=True)
    for group in GROUPS:
        compose_strip(frames).save(target / f"{args.pet_id}-{group}-v5.png", optimize=True)
    compose_strip(frames + frames[:4]).save(target / f"{args.pet_id}-landing-v5.png", optimize=True)


if __name__ == "__main__":
    main()
