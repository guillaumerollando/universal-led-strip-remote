#!/usr/bin/env python3
"""Captures du Play Store avec phrase d'accroche, image d'accroche et bannière.

    python3 tools/store_captures.py   → store/screenshots-store/<langue>/0N.png (1080 × 1920),
                                        store/feature-graphic-<langue>.png (bannière 1024 × 500)

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
    ("06-wifi-attente", (0, 190, 255), {"fr-FR": "Lumière Wi-Fi neuve ?|Elle la trouve", "en-US": "New Wi-Fi light?|It finds it"}),
    ("07-wifi-config", (76, 224, 122), {"fr-FR": "Ton Wi-Fi en un scan|de QR code", "en-US": "Your Wi-Fi in one|QR code scan"}),
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
    # Écran de téléphone très haut (captures du vrai téléphone, 20:9) : réduit pour tenir en entier sous l'accroche.
    sw = min(820, round((H - 470) * shot.width / shot.height))
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


# ── Image d'accroche (1re capture) et bannière : du texte, le néon de l'icône, l'envie ──

HERO = {
    "fr-FR": {"title": "Une seule appli|pour toutes tes lumières", "kinds": ["Bluetooth", "Wi-Fi", "Infrarouge"], "free": "Sans pub · Sans compte · Open source"},
    "en-US": {"title": "One app|for all your lights", "kinds": ["Bluetooth", "Wi-Fi", "Infrared"], "free": "No ads · No account · Open source"},
}
BRANDS = "ELK-BLEDOM · Philips Hue · WLED · Govee · Tasmota · Yeelight · LIFX"
KIND_COLORS = [(63, 201, 255), (76, 224, 122), (255, 90, 90)]


def neon() -> Image.Image:
    """
    Le néon arc-en-ciel de la bannière d'origine (rendu Blender de l'icône), avec sa lueur mais sans son fond : on
    retire la nuit violette du rendu et on fond les bords, pour ne garder que la lumière (à ajouter, pas à coller).
    """
    crop = Image.open(ROOT / "store" / "feature-graphic.png").convert("RGB").crop((200, 60, 820, 450))
    light = ImageChops.subtract(crop, Image.new("RGB", crop.size, (19, 15, 34)))
    fade = Image.new("L", crop.size, 0)
    ImageDraw.Draw(fade).rectangle((40, 40, crop.width - 40, crop.height - 40), fill=255)
    return Image.composite(light, Image.new("RGB", crop.size, (0, 0, 0)), fade.filter(ImageFilter.GaussianBlur(28)))


def fit_font(draw: ImageDraw.ImageDraw, text: str, size: int, width: int) -> ImageFont.FreeTypeFont:
    while draw.textlength(text, font=ImageFont.truetype(FONT, size)) > width:
        size -= 2
    return ImageFont.truetype(FONT, size)


def pill(img: Image.Image, cx: int, cy: int, text: str, dot: tuple, size: int = 40) -> None:
    draw = ImageDraw.Draw(img)
    font = ImageFont.truetype(FONT, size)
    w = draw.textlength(text, font=font) + size * 1.9
    h = size * 1.9
    x0, y0 = cx - w / 2, cy - h / 2
    draw.rounded_rectangle((x0, y0, x0 + w, y0 + h), radius=h / 2, fill=(24, 26, 34), outline=(60, 62, 72), width=3)
    r = size * 0.22
    draw.ellipse((x0 + size * 0.7 - r, cy - r, x0 + size * 0.7 + r, cy + r), fill=dot)
    draw.text((x0 + size * 1.2, cy), text, font=font, fill=(245, 245, 247), anchor="lm")


def hero(lang: str) -> Image.Image:
    copy = HERO[lang]
    img = Image.new("RGB", (W, H), NIGHT)
    draw = ImageDraw.Draw(img)
    first, second = copy["title"].split("|")
    for text, y, color in ((first, 170, (245, 245, 247)), (second, 285, AMBER)):
        font = fit_font(draw, text, 104, W - 110)
        draw.text((W / 2, y), text, font=font, fill=color, anchor="mt")

    # Le néon, en grand, posé sur la nuit comme une vraie lumière
    light = neon()
    light = light.resize((W + 120, round(light.height * (W + 120) / light.width)), Image.LANCZOS)
    layer = Image.new("RGB", (W, H), (0, 0, 0))
    layer.paste(light, (-60, 470))
    img = ImageChops.add(img, layer)
    draw = ImageDraw.Draw(img)

    # Bluetooth · Wi-Fi · Infrarouge
    widths = [draw.textlength(k, font=ImageFont.truetype(FONT, 40)) + 40 * 1.9 for k in copy["kinds"]]
    gap = 24
    x = (W - sum(widths) - gap * (len(widths) - 1)) / 2
    for k, w, c in zip(copy["kinds"], widths, KIND_COLORS):
        pill(img, round(x + w / 2), 1320, k, c)
        x += w + gap
    draw = ImageDraw.Draw(img)
    draw.text((W / 2, 1450), BRANDS, font=fit_font(draw, BRANDS, 36, W - 120), fill=(150, 152, 165), anchor="mt")

    # Le ruban de l'appli, puis la promesse
    strip = rainbow(360)
    glow_layer = Image.new("RGB", (W, H), (0, 0, 0))
    glow_layer.paste(strip, ((W - 360) // 2, 1610))
    img = ImageChops.add(img, glow_layer.filter(ImageFilter.GaussianBlur(18)).point(lambda v: round(v * 0.8)))
    img.paste(strip, ((W - 360) // 2, 1610))
    draw = ImageDraw.Draw(img)
    draw.text((W / 2, 1690), copy["free"], font=fit_font(draw, copy["free"], 46, W - 120), fill=(245, 245, 247), anchor="mt")
    return img


def banner(lang: str) -> Image.Image:
    """Bannière du Play Store (1024 × 500) : le néon à droite, l'accroche à gauche."""
    bw, bh = 1024, 500
    img = Image.new("RGB", (bw, bh), NIGHT)
    light = neon()
    light = light.resize((600, round(light.height * 600 / light.width)), Image.LANCZOS)
    layer = Image.new("RGB", (bw, bh), (0, 0, 0))
    layer.paste(light, (bw - 600 + 30, (bh - light.height) // 2 + 10))
    img = ImageChops.add(img, layer)
    draw = ImageDraw.Draw(img)
    first, second = SHOTS[0][2][lang].split("|")
    draw.text((64, 150), first, font=fit_font(draw, first, 62, 470), fill=(245, 245, 247))
    draw.text((64, 228), second, font=fit_font(draw, second, 62, 470), fill=AMBER)
    kinds = " · ".join(HERO[lang]["kinds"])
    draw.text((64, 322), kinds, font=ImageFont.truetype(FONT, 30), fill=(170, 172, 185))
    return img


def main() -> None:
    for lang in ("fr-FR", "en-US"):
        (OUT / lang).mkdir(parents=True, exist_ok=True)
        for old in (OUT / lang).glob("0*.png"):
            old.unlink()
        hero(lang).save(OUT / lang / "01.png", optimize=True)
        for n, (name, glow, lines) in enumerate(SHOTS, start=2):
            if (SRC / lang / f"{name}.png").exists():
                compose(SRC / lang / f"{name}.png", glow, lines[lang]).save(OUT / lang / f"0{n}.png", optimize=True)
        banner(lang).save(ROOT / "store" / f"feature-graphic-{lang}.png", optimize=True)
    print(f"Captures écrites dans {OUT.relative_to(ROOT)}/ et bannières dans store/")


if __name__ == "__main__":
    main()
