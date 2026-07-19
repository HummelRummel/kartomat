import os
from PIL import Image, ImageDraw, ImageFont

FONT_PATH = 'dist/font/Nove.ttf'
OUT_DIR = 'dist/icons'

os.makedirs(OUT_DIR, exist_ok=True)

def make_icon(size):
    img = Image.new('RGB', (size, size), color=(13, 13, 13))
    draw = ImageDraw.Draw(img)
    font_size = int(size * 0.68)
    font = ImageFont.truetype(FONT_PATH, font_size)
    bbox = draw.textbbox((0, 0), 'k', font=font)
    text_w = bbox[2] - bbox[0]
    text_h = bbox[3] - bbox[1]
    x = (size - text_w) // 2 - bbox[0]
    y = (size - text_h) // 2 - bbox[1]
    draw.text((x, y), 'k', fill=(255, 255, 255), font=font)
    return img

for sz in [192, 512]:
    img = make_icon(sz)
    path = os.path.join(OUT_DIR, f'icon-{sz}.png')
    img.save(path)
    print(f'Generated {path}')
