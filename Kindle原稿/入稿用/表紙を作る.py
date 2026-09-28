# -*- coding: utf-8 -*-
"""表紙（1600×2560 JPG）と、縮めた確認用（160×256）を作る。表紙の指示.md に従う。
使い方:  python 表紙を作る.py        … 第1巻（入稿用\\ に出す）
         python 表紙を作る.py 2      … 第2巻（入稿用\\第2巻\\ に出す）
         python 表紙を作る.py 3      … 第3巻（入稿用\\第3巻\\ に出す）
型（色・字の大きさ・配置）は全巻同じ。変えるのは巻名と、その下の2行と、帯の下の1行だけ。
"""
import os, sys
from PIL import Image, ImageDraw, ImageFont

HERE = os.path.dirname(os.path.abspath(__file__))
FONTS = r'C:\Users\plan9\Documents\ayui-management\public\fonts'
BOLD = os.path.join(FONTS, 'NotoSansJP-Bold.ttf')
REG = os.path.join(FONTS, 'NotoSansJP-Regular.ttf')

VOLUMES = {
    '1': dict(dir=HERE, name='リース・設備編',
              sub=['解約金と5年総額で失敗しない', '7つの判断基準'],
              items='複合機・パソコン・社用車・LED・携帯・回線・電力'),
    '2': dict(dir=os.path.join(HERE, '第2巻'), name='業務システム編',
              sub=['乗り換えで業務を止めない', '6つの判断基準'],
              items='勤怠・会計・電子契約・給与計算・研修・福利厚生'),
    '3': dict(dir=os.path.join(HERE, '第3巻'), name='人と制度編',
              sub=['義務と期限を取りこぼさない', '7つの判断基準'],
              items='補助金・IT補助金・求人・産業医・社労士・移転・備蓄'),
}
V = VOLUMES[sys.argv[1] if len(sys.argv) > 1 else '1']
OUT = V['dir']
os.makedirs(OUT, exist_ok=True)

W, H = 1600, 2560
NAVY, WHITE, SHU = '#1B2A3A', '#FFFFFF', '#C0341C'
SOFT = '#C9D2DC'

img = Image.new('RGB', (W, H), NAVY)
d = ImageDraw.Draw(img)

def center(text, y, font, fill):
    w = d.textlength(text, font=font)
    if w > W - 120:
        raise SystemExit(f'表紙の文字が幅からはみ出します: {text}')
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
fs2 = ImageFont.truetype(REG, T // 3 + 2)
y = title_bottom + 90
center(V['name'], y, ImageFont.truetype(BOLD, 92), WHITE)
y += 150
center(V['sub'][0], y, fs2, SOFT)
y += 90
center(V['sub'][1], y, fs2, SOFT)

# 朱色の横棒（帯）
bar_y = 2080
d.rectangle([0, bar_y, W, bar_y + 36], fill=SHU)

# 下：対象と版、著者名
fsm = ImageFont.truetype(REG, 50)
center(V['items'], bar_y + 110, fsm, SOFT)
center('2026年版　オフィスの選びかた編集部', bar_y + 210, fsm, SOFT)

out = os.path.join(OUT, '表紙.jpg')
img.save(out, 'JPEG', quality=92, dpi=(300, 300))
thumb = img.resize((160, 256), Image.LANCZOS)
thumb.save(os.path.join(OUT, '表紙_縮小確認_160x256.png'))
# 確認用に拡大したサムネイル（実寸の見え方を3倍で見る）
thumb.resize((480, 768), Image.NEAREST).save(os.path.join(OUT, '表紙_縮小確認_拡大表示.png'))
print(out, img.size)
