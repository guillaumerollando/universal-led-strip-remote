#!/usr/bin/env python3
"""Fabrique l'icône de l'appli (« LED Strip Remote ») : un néon LED flexible photoréaliste rendu dans Blender
(tools/icon_blender.py), puis une diffusion lumineuse (« bloom ») et une teinte de nuit ajoutées ici avec Pillow.

    python3 tools/make_icon.py [échantillons]   → assets/icon.png, android-icon-*.png, splash-icon.png, favicon.png
"""

import subprocess
import sys
import tempfile
from pathlib import Path

from PIL import Image, ImageChops, ImageEnhance, ImageFilter

ROOT = Path(__file__).resolve().parent.parent
ASSETS = ROOT / "assets"
SAMPLES = sys.argv[1] if len(sys.argv) > 1 else "256"


def render(out: Path, lens: float) -> Image.Image:
    subprocess.run(
        ["blender", "-b", "-P", str(ROOT / "tools/icon_blender.py"), "--", str(out), SAMPLES, str(lens)],
        check=True,
        stdout=subprocess.DEVNULL,
    )
    return Image.open(out).convert("RGB")


def bloom(img: Image.Image) -> Image.Image:
    """Diffusion douce de la lumière AUTOUR du néon (comme le halo des rubans dans l'appli), sans délaver le néon lui-même."""
    vivid = ImageEnhance.Color(img).enhance(1.25)
    bright = vivid.point(lambda v: max(0, v - 40) * 255 // 215)
    wide = bright.filter(ImageFilter.GaussianBlur(img.width * 0.055))
    near = bright.filter(ImageFilter.GaussianBlur(img.width * 0.014))
    glow = ImageChops.screen(Image.eval(wide, lambda v: int(v * 0.75)), Image.eval(near, lambda v: int(v * 0.35)))
    out = ImageChops.screen(vivid, glow)
    # Le tube garde ses couleurs vives : on le repose par-dessus le halo.
    mask = vivid.convert("L").point(lambda v: 255 if v > 95 else 0).filter(ImageFilter.GaussianBlur(img.width * 0.004))
    return Image.composite(vivid, out, mask)


def night_tint(img: Image.Image) -> Image.Image:
    """Fond de nuit violacé de l'appli : léger dégradé radial ajouté en écran."""
    n = img.width
    g = Image.radial_gradient("L").resize((n, n), Image.BICUBIC)
    tint = Image.composite(Image.new("RGB", (n, n), (6, 6, 10)), Image.new("RGB", (n, n), (24, 16, 42)), g)
    return ImageChops.screen(img, tint)


def finish(raw: Image.Image) -> Image.Image:
    return night_tint(bloom(raw))


def main() -> None:
    ASSETS.mkdir(exist_ok=True)
    with tempfile.TemporaryDirectory() as tmp:
        raw_big = render(Path(tmp) / "icon.png", 40)
        big = finish(raw_big)
        small = finish(render(Path(tmp) / "adaptive.png", 27))
    big.save(ASSETS / "icon.png")
    big.resize((48, 48), Image.LANCZOS).save(ASSETS / "favicon.png")

    # Android adaptatif : tout le visuel en arrière-plan (néon assez petit pour le rond), premier plan vide.
    small.resize((512, 512), Image.LANCZOS).save(ASSETS / "android-icon-background.png")
    Image.new("RGBA", (512, 512), (0, 0, 0, 0)).save(ASSETS / "android-icon-foreground.png")
    # Monochrome (icônes à thème) : silhouette du néon, d'après sa luminosité.
    lum = small.convert("L").point(lambda v: 255 if v > 110 else 0).filter(ImageFilter.GaussianBlur(2))
    mono = Image.new("RGBA", small.size, (255, 255, 255, 0))
    mono.putalpha(lum)
    mono.resize((432, 432), Image.LANCZOS).save(ASSETS / "android-icon-monochrome.png")

    # Écran de démarrage (Android 12+ : l'image est masquée par un cercle de ~2/3 de sa taille) : le néon et son halo
    # sur fond transparent, réduit au centre pour que ses extrémités restent dans le cercle. Fond : couleur de l'appli.
    glow = bloom(raw_big)
    alpha = glow.convert("L").point(lambda v: min(255, max(0, v - 6) * 3))
    rgba = Image.merge("RGBA", (*Image.eval(glow, lambda v: v).split(), alpha))
    # Couleurs « dé-prémultipliées » : le halo garde sa teinte au lieu de virer au gris une fois posé sur le fond.
    px = rgba.load()
    for y in range(rgba.height):
        for x in range(rgba.width):
            r, g, b, a = px[x, y]
            if a:
                k = 255 / max(a, 1)
                px[x, y] = (min(255, int(r * k)), min(255, int(g * k)), min(255, int(b * k)), a)
    n = rgba.width
    splash = Image.new("RGBA", (n, n), (0, 0, 0, 0))
    inner = rgba.resize((int(n * 0.62), int(n * 0.62)), Image.LANCZOS)
    splash.paste(inner, ((n - inner.width) // 2, (n - inner.height) // 2), inner)
    splash.save(ASSETS / "splash-icon.png")
    print("Icônes écrites dans", ASSETS)


if __name__ == "__main__":
    main()
