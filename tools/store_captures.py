#!/usr/bin/env python3
"""Captures du Play Store avec phrase d'accroche.

    python3 tools/store_captures.py   → store/screenshots-store/<langue>/0N.png (1080 × 1920)

Part des captures brutes de `store/screenshots/<langue>/` : fond de nuit de l'appli, phrase d'accroche en haut,
le petit ruban arc-en-ciel de l'appli dessous, la capture sur une lueur de sa couleur. L'ordre compte : les trois
premières se voient dans les résultats de recherche (ce que fait l'appli, puis « elle trouve ma lumière »).
"""
from pathlib import Path

from PIL import Image, ImageChops, ImageDraw, ImageFilter, ImageFont

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / "store" / "screenshots"
OUT = ROOT / "store" / "screenshots-store"
W, H = 1080, 1920
NIGHT = (10, 11, 15)
AMBER = (255, 181, 71)
FONT = "/usr/share/fonts/opentype/inter/InterDisplay-Bold.otf"

# (capture brute, couleur de la lueur, accroche par langue : « texte|mot mis en valeur »)
SHOTS = [
    ("01-accueil", (255, 0, 160), {"fr-FR": "Tous tes rubans LED,|une seule appli", "en-US": "Every LED strip,|one app"}),
    ("05-recherche", (0, 190, 255), {"fr-FR": "Elle trouve tes lumières|toute seule", "en-US": "Finds your lights|on its own"}),
    ("02-ambiances", (140, 60, 255), {"fr-FR": "Des ambiances|qui s'animent", "en-US": "Moods that|come alive"}),
    ("03-creer", (255, 120, 0), {"fr-FR": "Peins ton ruban|LED par LED", "en-US": "Paint your strip|LED by LED"}),
    ("04-blancs", (255, 200, 120), {"fr-FR": "Du blanc chaud|au blanc froid", "en-US": "Warm white|to cool white"}),
]


def rainbow(width: int) -> Image.Image:
    """Le petit ruban arc-en-ciel de l'appli, avec sa lueur."""
    stops = [(255, 59, 59), (255, 225, 77), (76, 224, 122), (63, 201, 255), (194, 91, 255)]
    line = Image.new("RGB", (width, 1))
    for x in range(width):
        t = x / (width - 1) * (len(stops) - 1)
        i = min(int(t), len(stops) - 2)
        f = t - i
        line.putpixel((x, 0), tuple(round(a + (b - a) * f) for a, b in zip(stops[i], stops[i + 1])))
    return line.resize((width, 6))


def compose(raw: Path, glow: tuple, headline: str) -> Image.Image:
    img = Image.new("RGB", (W, H), NIGHT)

    # Lueur colorée derrière la capture
    halo = Image.new("RGB", (W, H), NIGHT)
    ImageDraw.Draw(halo).ellipse((90, 700, W - 90, 1700), fill=tuple(round(c * 0.55) for c in glow))
    img = Image.blend(img, halo.filter(ImageFilter.GaussianBlur(160)), 0.9)

    # Accroche : deux lignes, la seconde en ambre
    draw = ImageDraw.Draw(img)
    first, second = headline.split("|")
    for text, y, color in ((first, 120, (245, 245, 247)), (second, 222, AMBER)):
        size = 92
        while ImageDraw.Draw(img).textlength(text, font=ImageFont.truetype(FONT, size)) > W - 120:
            size -= 2
        font = ImageFont.truetype(FONT, size)
        draw.text(((W - draw.textlength(text, font=font)) / 2, y), text, font=font, fill=color)

    # Le ruban arc-en-ciel et sa lueur (ajoutée à la lumière du fond, comme une vraie LED)
    strip = rainbow(360)
    glow_layer = Image.new("RGB", (W, H), (0, 0, 0))
    glow_layer.paste(strip, ((W - 360) // 2, 359))
    img = ImageChops.add(img, glow_layer.filter(ImageFilter.GaussianBlur(18)).point(lambda v: round(v * 0.8)))
    img.paste(strip, ((W - 360) // 2, 359))
    draw = ImageDraw.Draw(img)

    # Capture réduite, coins arrondis, fin liseré
    shot = Image.open(raw).convert("RGB")
    sw = 820
    sh = round(shot.height * sw / shot.width)
    shot = shot.resize((sw, sh), Image.LANCZOS)
    mask = Image.new("L", (sw, sh), 0)
    ImageDraw.Draw(mask).rounded_rectangle((0, 0, sw - 1, sh - 1), radius=56, fill=255)
    x, y = (W - sw) // 2, 430
    shadow = Image.new("L", (W, H), 0)
    ImageDraw.Draw(shadow).rounded_rectangle((x, y + 20, x + sw, y + sh + 20), radius=56, fill=200)
    img.paste(Image.new("RGB", (W, H), (0, 0, 0)), (0, 0), shadow.filter(ImageFilter.GaussianBlur(30)))
    img.paste(shot, (x, y), mask)
    ImageDraw.Draw(img).rounded_rectangle((x, y, x + sw - 1, y + sh - 1), radius=56, outline=(60, 62, 72), width=3)
    return img


def main() -> None:
    for lang in ("fr-FR", "en-US"):
        (OUT / lang).mkdir(parents=True, exist_ok=True)
        for n, (name, glow, lines) in enumerate(SHOTS, start=1):
            compose(SRC / lang / f"{name}.png", glow, lines[lang]).save(OUT / lang / f"0{n}.png", optimize=True)
    print(f"Captures écrites dans {OUT.relative_to(ROOT)}/")


if __name__ == "__main__":
    main()
