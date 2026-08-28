from __future__ import annotations

import argparse
from pathlib import Path

from PIL import Image


FRAME_SIZE = 96
CHARACTERS = ("miku", "rem", "mai", "umaru")
ACTION_GROUPS = ("drag", "unique-a", "unique-b")


def harden_strip(path: Path, check: bool) -> int:
    source = Image.open(path).convert("RGBA")
    if source.height != FRAME_SIZE or source.width % FRAME_SIZE:
        raise ValueError(f"unexpected pet strip dimensions: {path} ({source.size})")
    alpha = source.getchannel("A")
    partial = sum(alpha.histogram()[1:255])
    if partial and not check:
        source.putalpha(alpha.point(lambda value: 255 if value else 0))
        source.save(path, optimize=True)
    return partial


def main() -> None:
    parser = argparse.ArgumentParser(description="Harden transformed pet action strips without filling intentional silhouette gaps.")
    parser.add_argument("--asset-root", type=Path, default=Path("public/assets/pet/v5"))
    parser.add_argument("--check", action="store_true")
    args = parser.parse_args()

    unresolved = []
    total = 0
    for character in CHARACTERS:
        for group in ACTION_GROUPS:
            path = args.asset_root / character / f"{character}-{group}-v5.png"
            count = harden_strip(path, args.check)
            total += count
            if count:
                unresolved.append((path, count))

    if args.check and unresolved:
        details = ", ".join(f"{path}:{count}" for path, count in unresolved)
        raise SystemExit(f"pet action strips still contain partially transparent body pixels: {details}")
    print(f"{'checked' if args.check else 'hardened'} {total} partially transparent action pixels")


if __name__ == "__main__":
    main()
