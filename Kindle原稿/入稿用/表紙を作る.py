# -*- coding: utf-8 -*-
"""表紙（1600×2560 JPG）と、縮めた確認用（160×256）を作る。表紙の指示.md に従う。"""
import os
from PIL import Image, ImageDraw, ImageFont

HERE = os.path.dirname(os.path.abspath(__file__))
FONTS = r'C:\Users\plan9\Documents\ayui-management\public\fonts'
BOLD = os.path.join(FONTS, 'NotoSansJP-Bold.ttf')
REG = os.path.join(FONTS, 'NotoSansJP-Regular.ttf')

W, H = 1600, 2560
NAVY, WHITE, SHU = '#1B2A3A', '#FFFFFF', '#C0341C'
SOFT = '#C9D2DC'

img = Image.new('RGB', (W, H), NAVY)
d = ImageDraw.Draw(img)

def center(text, y, font, fill):
    w = d.textlength(text, font=font)
    d.text(((W - w) / 2, y), text, font=font, fill=fill)

# 書名：画面の上から1/3に、白・太字・特大（3行）
T = 176
ft = ImageFont.truetype(BOLD, T)
lines = ['中小企業の', '総務が、', '契約の前に', '確かめること']
LH = int(T * 1.28)
top = 330
for i, s in enumerate(lines):
    # 行末の「、」は見た目の幅に数えず、字面の中心をそろえる
    core = s.rstrip('、')
    w = d.textlength(core, font=ft)
    d.text(((W - w) / 2, top + i * LH), s, font=ft, fill=WHITE)
title_bottom = top + len(lines) * LH

# 副題：書名の3分の1の大きさ
fs = ImageFont.truetype(BOLD, T // 3 + 2)   # 60px
fs2 = ImageFont.truetype(REG, T // 3 + 2)
y = title_bottom + 90
center('リース・設備編', y, ImageFont.truetype(BOLD, 92), WHITE)
y += 150
center('解約金と5年総額で失敗しない', y, fs2, SOFT)
y += 90
center('7つの判断基準', y, fs2, SOFT)

# 朱色の横棒（帯）
bar_y = 2080
d.rectangle([0, bar_y, W, bar_y + 36], fill=SHU)

# 下：対象と版、著者名
fsm = ImageFont.truetype(REG, 50)
center('複合機・パソコン・社用車・LED・携帯・回線・電力', bar_y + 110, fsm, SOFT)
center('2026年版　オフィスの選びかた編集部', bar_y + 210, fsm, SOFT)

out = os.path.join(HERE, '表紙.jpg')
img.save(out, 'JPEG', quality=92, dpi=(300, 300))
thumb = img.resize((160, 256), Image.LANCZOS)
thumb.save(os.path.join(HERE, '表紙_縮小確認_160x256.png'))
# 確認用に拡大したサムネイル（実寸の見え方を3倍で見る）
thumb.resize((480, 768), Image.NEAREST).save(os.path.join(HERE, '表紙_縮小確認_拡大表示.png'))
print(out, img.size)
