#!/usr/bin/env python3
"""
RoseWorld — генератор пиксельных префикс-бейджей для ролей Minecraft-сервера.

Рендер идёт в "пиксельном" пространстве 1:1 (шрифт Press Start 2P, кегль 16 =
2x нативной сетки 8x8), затем изображение увеличивается целым коэффициентом
NEAREST — пиксели остаются идеально чёткими, без сглаживания.

Использование:
    python3 tools/generate_prefixes.py                 # все бейджи + превью + zip
    python3 tools/generate_prefixes.py --icons-debug   # лист иконок для проверки
    python3 tools/generate_prefixes.py --scale 4
"""

import argparse
import json
import os
import shutil
import zipfile
from PIL import Image, ImageDraw, ImageFont, ImageFilter

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
FONT_PATH = os.path.join(HERE, "fonts", "PressStart2P.ttf")
OUT = os.path.join(ROOT, "images", "prefixes")

FS = 16        # 2x нативной сетки Press Start 2P (кап-высота 14 px)
SCALE = 3      # увеличение готового бейджа
H = 26         # высота бейджа в пиксельном пространстве

# ---------------------------------------------------------------- палитра ----

def hx(c):
    if isinstance(c, tuple):
        return c
    c = c.lstrip("#")
    return tuple(int(c[i:i + 2], 16) for i in (0, 2, 4))


def mix(a, b, t):
    a, b = hx(a), hx(b)
    return tuple(round(a[i] + (b[i] - a[i]) * t) for i in range(3))


def lighten(c, t):
    return mix(c, (255, 255, 255), t)


def darken(c, t):
    return mix(c, (0, 0, 0), t)


def lum(c):
    r, g, b = hx(c)
    return (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255


def hexs(c):
    return "#%02X%02X%02X" % hx(c)


# ------------------------------------------------------------------ иконки ---
# 8x8, '.' прозрачно, 'k' контур/тень, 'm' основной, 'w' блик

ICONS = {
    "crown": [
        "m..m..m.",
        "m..m..m.",
        "mm.mm.mm",
        "mmmmmmmm",
        "mwmmmmwm",
        "mmmmmmmm",
        ".mmmmmm.",
        "........",
    ],
    "shield": [
        ".mmmmmm.",
        "mmmmmmmm",
        "mmmmmmmm",
        "mmwwwwmm",
        "mmmmmmmm",
        ".mmmmmm.",
        "..mmmm..",
        "...mm...",
    ],
    "shield_star": [
        ".mmmmmm.",
        "mmmmmmmm",
        "mmmwwmmm",
        "mmwwwwmm",
        "mmmwwmmm",
        ".mmmmmm.",
        "..mmmm..",
        "...mm...",
    ],
    "shield_slash": [
        ".mmmmmm.",
        "mmmmmmmm",
        "mmmkmmmm",
        "mmmmkmmm",
        "mmmmmkmm",
        ".mmmmmk.",
        "..mmmm..",
        "...mm...",
    ],
    "down": [
        "...mm...",
        "...mm...",
        "mmmmmmmm",
        ".mmmmmm.",
        "..mmmm..",
        "...mm...",
        "........",
        "........",
    ],
    "hammer": [
        "mmmmmmmm",
        "mmmmmmmm",
        ".mmmmmm.",
        "...mm...",
        "...mm...",
        "...mm...",
        "..mmmm..",
        "........",
    ],
    "star": [
        "...mm...",
        "...mm...",
        ".mmmmmm.",
        "mmmmmmmm",
        "mmmmmmmm",
        ".mm..mm.",
        "mm....mm",
        "........",
    ],
    "globe": [
        "..mmmm..",
        ".mmmmmm.",
        "mmmmmmmm",
        "kkkkkkkk",
        "mmmmmmmm",
        "mmmmmmmm",
        ".mmmmmm.",
        "..mmmm..",
    ],
    "heart": [
        ".mm..mm.",
        "mmmmmmmm",
        "mmmmmmmm",
        "mmmmmmmm",
        ".mmmmmm.",
        "..mmmm..",
        "...mm...",
        "........",
    ],
    "flame": [
        "...m....",
        "..mm....",
        "..mmm...",
        ".mmmmm..",
        ".mmmmm..",
        "mmmmmmm.",
        ".mmmmm..",
        "..mmm...",
    ],
    "gem": [
        "...mm...",
        "..mmmm..",
        ".mmmmmm.",
        "mmmmmmmm",
        ".mmmmmm.",
        "..mmmm..",
        "...mm...",
        "........",
    ],
    "crescent": [
        "..mmmm..",
        ".mmmmm..",
        "mmmm....",
        "mmm.....",
        "mmm.....",
        "mmmm....",
        ".mmmmm..",
        "..mmmm..",
    ],
    "feather": [
        "....mmm.",
        "...mmmwm",
        "..mmmwm.",
        ".mmmwm..",
        "mmmwm...",
        ".mwm....",
        "mm......",
        "........",
    ],
    "bunny": [
        "..m..m..",
        "..m..m..",
        ".mmmmmm.",
        "mmmmmmmm",
        "mmkmmkmm",
        "mmmmmmmm",
        ".mmmmmm.",
        "..mmmm..",
    ],
    "claw": [
        "mm..mm..",
        ".mm..mm.",
        "..mm..mm",
        "mm..mm..",
        ".mm..mm.",
        "..mm..mm",
        "mm..mm..",
        "........",
    ],
    "horns": [
        "m......m",
        "mm....mm",
        "mmm..mmm",
        ".mmmmmm.",
        "..mmmm..",
        "...mm...",
        "........",
        "........",
    ],
    "bolt": [
        "....mm..",
        "...mm...",
        "..mm....",
        ".mmmmm..",
        "...mm...",
        "...mm...",
        "..mm....",
        ".mm.....",
    ],
    "chat": [
        "mmmmmmmm",
        "mkkkkkkm",
        "mkkkkkkm",
        "mmmmmmmm",
        "mmmmmmmm",
        ".mm.....",
        "..m.....",
        "........",
    ],
    "play": [
        "..mm....",
        "..mmmm..",
        "..mmmmmm",
        "..mmmmmm",
        "..mmmm..",
        "..mm....",
        "........",
        "........",
    ],
    "mic": [
        "...mm...",
        "..mmmm..",
        "..mmmm..",
        "..mmmm..",
        "...mm...",
        "..mmmm..",
        "...mm...",
        "........",
    ],
    "cross_swords": [
        "m.....m.",
        "mm...mm.",
        ".mm.mm..",
        "..mmm...",
        "..mmm...",
        ".mm.mm..",
        "mm...mm.",
        "m.....m.",
    ],
    "sword": [
        "...mm...",
        "...mm...",
        "...mm...",
        "...mm...",
        "mmmmmmmm",
        "...mm...",
        "...mm...",
        "..mmmm..",
    ],
    "sword_slash": [
        "m.....mm",
        "mm...mmm",
        ".mm.mm..",
        "..mmm...",
        "..mmm...",
        ".mm.mm..",
        "mm...mm.",
        "m.....m.",
    ],
    "sparkle": [
        "m..m..m.",
        ".m.m.m..",
        "..mmm...",
        "mmmmmmmm",
        "..mmm...",
        ".m.m.m..",
        "m..m..m.",
        "........",
    ],
    "book": [
        "mmmmmmmm",
        "mwwwwwwm",
        "mkkkkkkm",
        "mwwwwwwm",
        "mkkkkkkm",
        "mwwwwwwm",
        "mmmmmmmm",
        "........",
    ],
    "mountain": [
        "...mm...",
        "...mm...",
        "..mmmm..",
        "..mmmm..",
        ".mmmmmm.",
        ".mmmmmm.",
        "mmmmmmmm",
        "........",
    ],
    "drop": [
        "...mm...",
        "...mm...",
        "..mmmm..",
        ".mmmmmm.",
        "mmmmmmmm",
        "mmmmmmmm",
        ".mmmmmm.",
        "..mmmm..",
    ],
    "trident": [
        "m..m..m.",
        "m..m..m.",
        "m..m..m.",
        "mmmmmmm.",
        "...m....",
        "...m....",
        "...m....",
        "........",
    ],
    "leaf": [
        "....mm..",
        "...mmmm.",
        "..mmmmm.",
        ".mmmmm..",
        ".mmmm...",
        "mmm.....",
        "mm......",
        "........",
    ],
    "dot": [
        "........",
        "........",
        "..mmmm..",
        ".mmmmmm.",
        ".mmmmmm.",
        "..mmmm..",
        "........",
        "........",
    ],
}

# ------------------------------------------------------------------- роли ---
# (ключ, базовый цвет, иконка, рамка, вес)

ROLES = [
    ("owner",       "#FFC83D", "crown",        "grand",  100),
    ("admin",       "#FF3B4B", "shield",       "solid",  95),
    ("swdadmin",    "#E01E37", "shield_star",  "solid",  92),
    ("dadmin",      "#D2324F", "shield",       "solid",  90),
    ("mladmin",     "#C13AA8", "shield",       "solid",  88),
    ("fakeadmin",   "#8A3038", "shield_slash", "dashed", 85),
    ("opka",        "#FF8A2B", "hammer",       "solid",  82),
    ("downer",      "#B0722E", "down",         "solid",  80),
    ("overlord",    "#B01030", "crown",        "grand",  76),
    ("imperator",   "#FFD34E", "crown",        "grand",  74),
    ("god",         "#FFE45C", "sparkle",      "grand",  72),
    ("magister",    "#8A6BFF", "book",         "solid",  70),
    ("avenger",     "#E63946", "cross_swords", "solid",  68),
    ("titan",       "#93A4B8", "mountain",     "solid",  66),
    ("hero",        "#FFC94A", "star",         "solid",  64),
    ("swglmoder",   "#2EA8FF", "globe",        "solid",  60),
    ("glmoder",     "#1F80D6", "globe",        "solid",  58),
    ("swstmoder",   "#FFD23F", "star",         "solid",  56),
    ("stmoder",     "#E0A81E", "star",         "solid",  54),
    ("swmoderplus", "#A45BF0", "sword",        "solid",  52),
    ("moderplus",   "#8347D1", "sword",        "solid",  50),
    ("swmoder",     "#37D5A5", "sword",        "solid",  48),
    ("moder",       "#28A98A", "sword",        "solid",  46),
    ("swdmoder",    "#4CC9F0", "sword",        "solid",  44),
    ("dmoder",      "#38A5C9", "sword",        "solid",  42),
    ("offdmoder",   "#5E6B78", "cross_swords", "dashed", 40),
    ("swmlmoder",   "#D07BFF", "chat",         "solid",  38),
    ("mlmoder",     "#9D4EDD", "chat",         "solid",  36),
    ("swhelper",    "#7EE787", "heart",        "solid",  34),
    ("helper",      "#3FB950", "heart",        "solid",  32),
    ("dhelper",     "#5FD873", "heart",        "solid",  30),
    ("youtube",     "#FF2D2D", "play",         "solid",  28),
    ("media",       "#FF6B9D", "mic",          "solid",  27),
    ("sponsor",     "#F5B41F", "gem",          "solid",  26),
    ("dragon",      "#8B2FE0", "flame",        "solid",  24),
    ("hydra",       "#2FA36B", "trident",      "solid",  23),
    ("cobra",       "#6DD400", "drop",         "solid",  22),
    ("dracula",     "#C2103C", "drop",         "solid",  21),
    ("vampire",     "#9B1230", "drop",         "solid",  20),
    ("bull",        "#C44A16", "horns",        "solid",  19),
    ("tiger",       "#FF9F1C", "claw",         "solid",  18),
    ("pegas",       "#25C9F5", "feather",      "solid",  17),
    ("wild",        "#8FD14F", "leaf",         "solid",  16),
    ("eclipse",     "#7A6CF0", "crescent",     "solid",  15),
    ("bunny",       "#FF9EC9", "bunny",        "solid",  14),
    ("rabbit",      "#F6B8D8", "bunny",        "solid",  13),
    ("default",     "#98A2B0", "dot",          "thin",    1),
]

# --------------------------------------------------------------- рендеринг ---

def palette(base):
    """Согласованные оттенки и цвета текста для базового цвета роли."""
    base = hx(base)
    p = dict(
        light=lighten(base, 0.50),
        mid=base,
        dark=darken(base, 0.44),
        outline=darken(base, 0.74),
        edge=lighten(base, 0.72),
    )
    if lum(base) > 0.55:                       # светлый бейдж — тёмный текст
        p.update(tcol=darken(base, 0.90), tout=darken(base, 0.60),
                 tsh=darken(base, 0.45))
    else:                                      # тёмный бейдж — светлый текст
        p.update(tcol=lighten(base, 0.90), tout=darken(base, 0.68),
                 tsh=darken(base, 0.85))
    return p


def text_mask(text, font):
    """Бинарная (без сглаживания) маска текста — истинные пиксели шрифта."""
    tmp = Image.new("L", (max(1, int(font.getlength(text)) + 8), FS + 10), 0)
    d = ImageDraw.Draw(tmp)
    d.text((2, 2), text, font=font, fill=255)
    return tmp.point(lambda v: 255 if v >= 128 else 0)


def draw_icon(img, art, x0, y0, pal, px=2):
    """Трёхтоновая иконка в цветах текста + автоматическая пиксельная обводка."""
    n = 8
    m_k = Image.new("L", (n, n), 0)   # тень
    m_m = Image.new("L", (n, n), 0)   # тело
    m_w = Image.new("L", (n, n), 0)   # блик
    for y, row in enumerate(art):
        for x, ch in enumerate(row):
            if ch == "k":
                m_k.putpixel((x, y), 255)
            elif ch == "m":
                m_m.putpixel((x, y), 255)
            elif ch == "w":
                m_w.putpixel((x, y), 255)

    sil = Image.new("L", (n, n), 0)
    for m in (m_k, m_m, m_w):
        sil.paste(m, (0, 0), m)
    outline = sil.filter(ImageFilter.MaxFilter(3))

    tcol, tout = pal["tcol"], pal["tout"]
    size = n * px

    def scale(m):
        return m.resize((size, size), Image.NEAREST)

    def paint(mask, color, dx=0, dy=0):
        if mask.getbbox() is None:
            return
        img.paste(Image.new("RGBA", (size, size), color + (255,)), (x0 + dx, y0 + dy), scale(mask))

    paint(outline, tout, -px, -px)
    paint(m_k, mix(tcol, tout, 0.45))
    paint(m_m, tcol)
    paint(m_w, mix(tcol, (255, 255, 255), 0.55))


def panel(img, W, pal, frame):
    d = ImageDraw.Draw(img)
    if frame == "thin":
        for y in range(H):
            c = mix(pal["light"], pal["dark"], y / (H - 1))
            d.line([(0, y), (W - 1, y)], fill=c + (255,))
        d.line([(0, 0), (W - 1, 0)], fill=lighten(pal["mid"], 0.6) + (255,))
        d.line([(0, H - 1), (W - 1, H - 1)], fill=pal["outline"] + (255,))
        return 0

    if frame == "grand":
        # премиум: тёмный контур, золотое кольцо, тёмный зазор, панель
        d.rectangle([0, 0, W - 1, H - 1], fill=pal["outline"] + (255,))
        d.rectangle([1, 1, W - 2, H - 2], fill=lighten(pal["mid"], 0.45) + (255,))
        d.rectangle([2, 2, W - 3, H - 3], fill=darken(pal["mid"], 0.70) + (255,))
        x0, y0, x1, y1 = 3, 3, W - 4, H - 4
    elif frame == "dashed":
        # «фальшивая»/неактивная роль: полосатая предупреждающая окантовка
        d.rectangle([0, 0, W - 1, H - 1], fill=pal["outline"] + (255,))
        a = lighten(pal["mid"], 0.30)
        b = darken(pal["mid"], 0.55)
        for x in range(W - 2):
            c = a if (x // 3) % 2 == 0 else b
            d.point((1 + x, 1), fill=c + (255,))
            d.point((1 + x, H - 2), fill=c + (255,))
        for y in range(H - 2):
            c = a if (y // 3) % 2 == 0 else b
            d.point((1, 1 + y), fill=c + (255,))
            d.point((W - 2, 1 + y), fill=c + (255,))
        x0, y0, x1, y1 = 2, 2, W - 3, H - 3
    else:
        x0, y0, x1, y1 = 0, 0, W - 1, H - 1

    # заливка панели
    for y in range(y0, y1 + 1):
        t = (y - y0) / max(1, y1 - y0)
        t = t * t * (3 - 2 * t)
        c = mix(pal["light"], pal["dark"], 0.05 + t * 0.9)
        d.line([(x0, y), (x1, y)], fill=c + (255,))

    if frame == "dashed":
        d.rectangle([x0 - 1, y0 - 1, x1 + 1, y1 + 1], outline=pal["outline"] + (255,))
    else:
        # пиксельная фаска: светлая кромка сверху/слева, тёмная снизу/справа
        d.line([(x0, y0), (x1 - 1, y0)], fill=pal["edge"] + (255,))
        d.line([(x0, y0), (x0, y1 - 1)], fill=mix(pal["edge"], pal["mid"], 0.45) + (255,))
        d.line([(x1, y0 + 1), (x1, y1)], fill=darken(pal["mid"], 0.58) + (255,))
        d.line([(x0 + 1, y1), (x1, y1)], fill=darken(pal["mid"], 0.58) + (255,))
        d.rectangle([x0 - 1, y0 - 1, x1 + 1, y1 + 1], outline=pal["outline"] + (255,))

    if frame == "grand":
        # заклёпки-самоцветы по углам золотого кольца
        for cx, cy in ((1, 1), (W - 2, 1), (1, H - 2), (W - 2, H - 2)):
            d.rectangle([cx, cy, cx, cy], fill=lighten(pal["mid"], 0.85) + (255,))
    return x0


def badge(name, base, icon, frame, scale=SCALE):
    pal = palette(base)
    text = name.upper()
    font = ImageFont.truetype(FONT_PATH, FS)
    tm = text_mask(text, font)
    tm_bb = tm.getbbox()
    tw, th = tm_bb[2] - tm_bb[0], tm_bb[3] - tm_bb[1]

    inset = 3 if frame == "grand" else (2 if frame == "dashed" else 0)
    pad_l, gap, pad_r = 5, 4, 6
    icon_px, icon_w = 2, 18
    W = pad_l + icon_w + gap + tw + pad_r + inset * 2

    img = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    panel(img, W, pal, frame)

    # иконка
    ix = inset + pad_l
    iy = (H - 16) // 2
    draw_icon(img, ICONS[icon], ix, iy, pal, icon_px)

    # текст: обводка (дилатация) + тень + заливка
    tx = ix + icon_w + gap - tm_bb[0]
    ty = (H - th) // 2 - tm_bb[1]

    outline = tm.filter(ImageFilter.MaxFilter(3))
    shadow = Image.new("L", tm.size, 0)
    shadow.paste(outline, (2, 2))
    solid = Image.new("RGBA", tm.size, pal["tout"] + (255,))
    img.paste(solid, (tx, ty), outline)
    solid = Image.new("RGBA", tm.size, pal["tsh"] + (255,))
    img.paste(solid, (tx, ty), shadow)
    solid = Image.new("RGBA", tm.size, pal["tcol"] + (255,))
    img.paste(solid, (tx, ty), tm)

    # срезанные углы — чистый пиксельный силуэт
    px = img.load()
    if frame not in ("grand", "thin"):
        for x, y in ((0, 0), (W - 1, 0), (0, H - 1), (W - 1, H - 1)):
            px[x, y] = (0, 0, 0, 0)

    return img.resize((W * scale, H * scale), Image.NEAREST), pal


# ------------------------------------------------------------------ вывод ----

def icons_debug(scale=10):
    os.makedirs(OUT, exist_ok=True)
    names = list(ICONS)
    cols = 6
    cw, ch = 16 * scale + 26, 16 * scale + 34
    rows = (len(names) + cols - 1) // cols
    img = Image.new("RGBA", (cols * cw, rows * ch), (18, 16, 24, 255))
    f = ImageFont.truetype(FONT_PATH, FS)
    pal = palette("#59D2FF")
    for i, n in enumerate(names):
        cell = Image.new("RGBA", (16, 16), (0, 0, 0, 0))
        draw_icon(cell, ICONS[n], 0, 0, pal, 2)
        cell = cell.resize((16 * scale, 16 * scale), Image.NEAREST)
        x = (i % cols) * cw + (cw - 16 * scale) // 2
        y = (i // cols) * ch + 6
        img.alpha_composite(cell, (x, y))
        ImageDraw.Draw(img).text(((i % cols) * cw + 8, y + 16 * scale + 6),
                                 n, font=f, fill=(200, 205, 220, 255))
    img.save(os.path.join(OUT, "_icons-debug.png"))
    print("icons debug ->", os.path.join(OUT, "_icons-debug.png"))


def build(scale=SCALE, make_zip=True):
    roles_dir = os.path.join(OUT, "roles")
    if os.path.isdir(roles_dir):
        shutil.rmtree(roles_dir)
    os.makedirs(roles_dir, exist_ok=True)

    made, meta = [], []
    for name, base, icon, frame, weight in ROLES:
        img, pal = badge(name, base, icon, frame, scale)
        img.save(os.path.join(roles_dir, f"{name}.png"))
        made.append((name, img))
        meta.append(dict(
            role=name, label=name.upper(), weight=weight, icon=icon, frame=frame,
            base=hexs(base), light=hexs(pal["light"]), dark=hexs(pal["dark"]),
            text=hexs(pal["tcol"]), file=f"roles/{name}.png",
            width=img.width, height=img.height, scale=scale,
        ))

    with open(os.path.join(OUT, "roles.json"), "w", encoding="utf-8") as fh:
        json.dump(meta, fh, ensure_ascii=False, indent=2)

    # сводный каталог: бейдж + название роли (пиксельные подписи, без сглаживания)
    lab_font = ImageFont.truetype(FONT_PATH, FS)

    def label(txt, color=(150, 158, 176)):
        m = text_mask(txt, lab_font)
        bb = m.getbbox() or (0, 0, 1, 1)
        m = m.crop(bb)
        tile = Image.new("RGBA", m.size, color + (255,))
        out = Image.new("RGBA", m.size, (0, 0, 0, 0))
        out.paste(tile, (0, 0), m)
        return out

    pad = 16
    col_w = max(im.width for _, im in made) + pad * 2
    row_h = max(im.height for _, im in made) + pad + 30
    cols = 2
    rows = (len(made) + cols - 1) // cols
    sheet = Image.new("RGBA", (col_w * cols, row_h * rows), (14, 12, 20, 255))
    for i, (name, im) in enumerate(made):
        cx, cy = (i % cols) * col_w, (i // cols) * row_h
        sheet.alpha_composite(im, (cx + pad, cy + pad))
        meta_i = meta[i]
        lb = label(f'{meta_i["label"]}  {meta_i["base"]}', (140, 148, 168))
        sheet.alpha_composite(lb, (cx + pad, cy + pad + im.height + 8))
    sheet = sheet.crop((0, 0, sheet.width, row_h * rows - pad))
    sheet.save(os.path.join(OUT, "catalog.png"))

    # компактная сетка бейджей
    gw = max(im.width for _, im in made) + 12
    gh = max(im.height for _, im in made) + 12
    gcols = 2
    grid = Image.new("RGBA", (gw * gcols, gh * ((len(made) + gcols - 1) // gcols)),
                     (14, 12, 20, 255))
    for i, (name, im) in enumerate(made):
        grid.alpha_composite(im, ((i % gcols) * gw + 6, (i // gcols) * gh + 6))
    grid.save(os.path.join(OUT, "preview-grid.png"))

    if make_zip:
        zpath = os.path.join(OUT, "roseworld-prefixes.zip")
        with zipfile.ZipFile(zpath, "w", zipfile.ZIP_DEFLATED) as z:
            for name, _, _, _, _ in ROLES:
                z.write(os.path.join(roles_dir, f"{name}.png"), f"roles/{name}.png")
            z.write(os.path.join(OUT, "roles.json"), "roles.json")
            readme = os.path.join(OUT, "README.md")
            if os.path.exists(readme):
                z.write(readme, "README.md")
        print("zip ->", zpath)

    print(f"готово: {len(made)} бейджей -> {roles_dir}")
    return meta


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--scale", type=int, default=SCALE)
    ap.add_argument("--icons-debug", action="store_true")
    ap.add_argument("--no-zip", action="store_true")
    a = ap.parse_args()
    if a.icons_debug:
        icons_debug()
    else:
        build(a.scale, not a.no_zip)
