from __future__ import annotations

import argparse
import hashlib
from pathlib import Path

from collections import deque

from PIL import Image


FRAME_SIZE = 96
CHARACTERS = ("miku", "rem", "mai", "umaru")
ACTION_GROUPS = ("idle", "drag", "unique-a", "unique-b", "enter", "exit", "landing")
DISTINCT_ACTION_GROUPS = ("drag", "unique-a", "unique-b")


def count_enclosed_transparent_pixels(path: Path) -> int:
    source = Image.open(path).convert("RGBA")
    if source.height != FRAME_SIZE or source.width % FRAME_SIZE:
        raise ValueError(f"unexpected pet strip dimensions: {path} ({source.size})")
    enclosed = 0
    for frame_index in range(source.width // FRAME_SIZE):
        alpha = source.crop((frame_index * FRAME_SIZE, 0, (frame_index + 1) * FRAME_SIZE, FRAME_SIZE)).getchannel("A")
        pixels = alpha.load()
        outside = bytearray(FRAME_SIZE * FRAME_SIZE)
        queue: deque[tuple[int, int]] = deque()

        def seed(x: int, y: int) -> None:
            offset = y * FRAME_SIZE + x
            if outside[offset] or pixels[x, y] > 16:
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
        enclosed += sum(
            1
            for y in range(FRAME_SIZE)
            for x in range(FRAME_SIZE)
            if pixels[x, y] <= 16 and not outside[y * FRAME_SIZE + x]
        )
    return enclosed


def frame_digests(path: Path) -> list[str]:
    source = Image.open(path).convert("RGBA")
    return [
        hashlib.sha256(source.crop((index * FRAME_SIZE, 0, (index + 1) * FRAME_SIZE, FRAME_SIZE)).tobytes()).hexdigest()
        for index in range(source.width // FRAME_SIZE)
    ]


def main() -> None:
    parser = argparse.ArgumentParser(description="Check imported pet strips for transparent holes inside character silhouettes.")
    parser.add_argument("--asset-root", type=Path, default=Path("public/assets/pet/v5"))
    parser.add_argument("--check", action="store_true")
    args = parser.parse_args()

    unresolved = []
    repeated_actions = []
    total = 0
    for character in CHARACTERS:
        for group in ACTION_GROUPS:
            path = args.asset_root / character / f"{character}-{group}-v5.png"
            count = count_enclosed_transparent_pixels(path)
            total += count
            if count:
                unresolved.append((path, count))
        idle_digests = frame_digests(args.asset_root / character / f"{character}-idle-v5.png")
        for group in DISTINCT_ACTION_GROUPS:
            path = args.asset_root / character / f"{character}-{group}-v5.png"
            digests = frame_digests(path)
            if len(set(digests)) < 3 or digests == idle_digests:
                repeated_actions.append(path)

    if args.check and unresolved:
        details = ", ".join(f"{path}:{count}" for path, count in unresolved)
        raise SystemExit(f"pet action strips still contain enclosed transparent body pixels: {details}")
    if args.check and repeated_actions:
        raise SystemExit("pet action strips still repeat idle or contain fewer than three distinct frames: " + ", ".join(map(str, repeated_actions)))
    print(f"checked {total} enclosed transparent body pixels and distinct action frames")


if __name__ == "__main__":
    main()
