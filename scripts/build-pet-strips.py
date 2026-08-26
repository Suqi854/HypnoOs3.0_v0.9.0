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
    bounds = image.getbbox()
    if not bounds:
        raise ValueError("sprite frame became empty after background removal")
    subject = image.crop(bounds)
    subject.thumbnail((FRAME_SIZE - 6, FRAME_SIZE - 4), Image.Resampling.LANCZOS)
    frame = Image.new("RGBA", (FRAME_SIZE, FRAME_SIZE), (0, 0, 0, 0))
    x = (FRAME_SIZE - subject.width) // 2
    y = FRAME_SIZE - subject.height - 2
    frame.alpha_composite(subject, (x, y))
    return frame


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
    args = parser.parse_args()

    source = Image.open(args.source).convert("RGB")
    if source.width % GRID_COLUMNS or source.height % GRID_ROWS:
        raise ValueError("source dimensions must divide evenly into a 4x2 grid")
    cell_width = source.width // GRID_COLUMNS
    cell_height = source.height // GRID_ROWS
    frames: list[Image.Image] = []
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
