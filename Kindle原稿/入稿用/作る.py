# -*- coding: utf-8 -*-
"""第1巻（リース・設備編）の原稿とEPUBを、記事JSONから組み立てる。
使い方:  python 作る.py
出力:    原稿_第1巻.md / 中小企業の総務が契約の前に確かめること_第1巻.epub
"""
import json, os, re, zipfile, html, uuid, datetime
from xml.dom import minidom

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, '..', '..'))
ARTICLES = os.path.join(ROOT, '記事')

TITLE = '中小企業の総務が、契約の前に確かめること'
SUBTITLE = 'リース・設備編 ─ 解約金と5年総額で失敗しない7つの判断基準（2026年版）'
AUTHOR = 'オフィスの選びかた編集部'
SERIES = '総務の契約前チェック 1'
SITE = 'https://soumu-choice.com/?utm_source=kindle&utm_medium=ebook&utm_campaign=vol1'
PUB_DATE = '2026-09-28'
BOOK_ID = 'urn:uuid:' + str(uuid.uuid5(uuid.NAMESPACE_URL, 'soumu-choice.com/kindle/vol1'))

# 章の順番（記事のslug）
CHAPTERS = [
    'copier-lease-contract-judgement',
    'office-pc-lease-or-buy',
    'company-car-lease-or-buy',
    'office-led-lighting-lease-or-buy',
    'corporate-mobile-phone-contract-checklist',
    'office-internet-wifi-contract',
    'corporate-electricity-switch-checklist',
]

# ── 直し（旧→新）。旧が見つからなければ止める（黙って素通りさせない） ──
EDITS = {
  'copier-lease-contract-judgement': [
    ('総務が夜まで残ることになります。経験があります。', '総務が夜まで残ることになります。'),
  ],
  'office-pc-lease-or-buy': [
    ('月額の比較表だけで決めると、4〜5年後に必ず引っかかります。',
     '月額の比較表だけで決めると、4〜5年後に引っかかりやすくなります。'),
    ('取引先の情報セキュリティ調査で指摘されることがあります。',
     '取引先の情報セキュリティ調査で指摘されることがあります。たとえばWindows 10は、2025年10月14日にマイクロソフトの通常のサポートが終わりました（出典：マイクロソフト社の公表情報）。'),
    ('産業廃棄物として処理する必要があり、証明書の保管も求められます。',
     '事業で使ったパソコンは産業廃棄物として扱うのが原則で、委託した場合は管理票（マニフェスト）などの保管も求められます。'),
    ('返却と廃棄で必ず詰まる', '返却と廃棄で詰まりやすい'),
  ],
  'company-car-lease-or-buy': [
    ('という不安は現場に必ずあります。', 'という不安は、たいてい現場にあります。'),
    ('・アルコール検知器。安全運転管理者を選任する規模の事業所では、運転前後の酒気帯び確認と検知器の使用、記録の保存が求められます。',
     '・アルコール検知器。乗車定員11人以上の車を1台以上、またはその他の車を5台以上使う事業所は、安全運転管理者の選任が必要です。2023年12月1日からは、運転前後の酒気帯び確認をアルコール検知器で行い、記録を1年間保存し、検知器を常に使える状態に保つことが義務になっています（出典：警察庁「安全運転管理者の業務の拡充等」。2026年9月時点）。'),
    ('乗車定員が多い車両や、一定台数以上を保有する事業所では安全運転管理者の選任と酒気帯び確認・記録が求められます。台数が少なくても要件に当たる場合があるため、自社の車両構成をもとに所轄の警察署や社会保険労務士に確認してください。',
     '乗車定員11人以上の車を1台以上、またはその他の車を5台以上使う事業所では、安全運転管理者の選任と、アルコール検知器による酒気帯び確認・記録が求められます（2026年9月時点）。1台だけでも、それが乗車定員11人以上の車なら当たります。数え方に迷ったら、所轄の警察署に確認してください。'),
  ],
  'office-led-lighting-lease-or-buy': [
    ('水銀に関する国際的な取り決め（水俣条約）の改正により、直管形・コンパクト形の蛍光ランプは、おおよそ2026年から2027年末をめどに製造と輸出入が段階的に終わる方向で進んでいます。最新の期限は年度によって整理が変わるので、環境省や照明工業会の公表資料で必ず確認してください。',
     '水銀に関する国際的な取り決め（水俣条約）の決定を受けて、一般照明用の蛍光ランプは種類ごとに製造と輸出入が禁止されます。環境省の案内（2026年9月時点）では、コンパクト形は2027年1月1日から、オフィスに多い直管形と環形は2028年1月1日から（ハロりん酸塩蛍光体を使ったものは2027年1月1日から）です。つまり直管形も、2027年末で新しく作られなくなります。期限は見直されることがあるので、環境省「一般照明用の蛍光ランプの規制について」で最新の情報を確かめてください。'),
    ('含有する場合は通常の廃棄ができず、法令で定められた期限内に専用の処分ルートが必要です。',
     '含有する場合は通常の廃棄ができません。高濃度PCBを含む安定器の処分期間はすでに終わっており、見つかった場合は都道府県（または政令市）の担当窓口へすぐに届け出て、指示を受けることになります。低濃度PCB廃棄物の処分期限は2027年3月31日です（出典：環境省。2026年9月時点）。'),
    ('ここで絶対に外せない実務が一つあります。', 'ここで外せない実務が一つあります。'),
    ('色の違いが必ず苦情になります。', '色の違いは苦情になりやすいです。'),
    ('省エネ設備の補助金には、照明が対象になるものと、ならないものがあります。',
     '補助金は年度ごとに中身が変わります。ここに書くのは2026年時点の一般的な傾向です。省エネ設備の補助金には、照明が対象になるものと、ならないものがあります。'),
    ('事務所衛生基準規則で執務空間の照度の下限が定められているので、その水準を下回っていないかも確認してください。',
     '事務所衛生基準規則で作業面の照度の下限が定められています（2022年12月の改正後は、一般的な事務作業で300ルクス以上、付随的な事務作業で150ルクス以上。出典：厚生労働省）。その水準を下回っていないかも確認してください。'),
    ('制限されるのは新規の製造と輸出入で、おおよそ2026年から2027年末をめどに段階的に進む方向です。',
     '制限されるのは新規の製造と輸出入で、直管形は2027年末で製造・輸出入が終わります（2026年9月時点の環境省の案内）。'),
  ],
  'corporate-electricity-switch-checklist': [
    ('入るときより やめるときに', '入るときより、やめるときに'),
    ('そしてもう一つ。万一どことも契約できない状態になっても、最終保障供給という受け皿があります。ただし料金は割高な設計です。',
     'そしてもう一つ。高圧・特別高圧の契約なら、万一どことも契約できない状態になっても、地域の送配電事業者による最終保障供給という受け皿があります（低圧はこの制度の対象外です）。ただし料金は標準的なメニューより割高な設計です。'),
    ('次の契約先を探すことになりますが、間が空いても最終保障供給という受け皿の仕組みがあります。',
     '次の契約先を探すことになります。高圧・特別高圧の契約なら、間が空いても最終保障供給という受け皿の仕組みがあります（低圧は対象外）。'),
  ],
  'office-internet-wifi-contract': [],
  'corporate-mobile-phone-contract-checklist': [
    ('法人携帯は「1台いくら」で決めると、あとで必ず困ります。', '法人携帯は「1台いくら」で決めると、あとで困りやすくなります。'),
    ('20年分の失敗を先にお渡しします。', ''),
    ('という案は、必ず誰かが言い出します。', 'という案は、たいてい誰かが言い出します。'),
    ('法人携帯の相談で最も多いのは', '法人携帯の見直しでよくあるのは'),
  ],
}

def load(slug):
    d = json.load(open(os.path.join(ARTICLES, slug + '.json'), encoding='utf-8'))
    blob = json.dumps(d, ensure_ascii=False)
    for old, new in EDITS.get(slug, []):
        o = json.dumps(old, ensure_ascii=False)[1:-1]
        n = json.dumps(new, ensure_ascii=False)[1:-1]
        if o not in blob:
            raise SystemExit(f'直しの元の文が見つかりません: {slug}: {old[:40]}')
        blob = blob.replace(o, n)
    blob = blob.replace('この記事', 'この章')
    d = json.loads(blob)
    d['lead'] = d['lead'].strip()
    return d

# ── 前後の文章（クロが書いたもの） ──
HAJIMENI = """この本は、従業員10〜100人ほどの会社で総務・管理部門を担う方が、**リースや継続契約に判を押す前に確かめること**をまとめたものです。

複合機、社内パソコン、社用車、LED照明、法人携帯、ネット回線、法人電力。どれも「よく分からないまま、勧められた条件で契約してしまう」ことが起きやすい買いものです。

一度契約すると、数年単位で毎月お金が出ていきます。しかも、途中でやめると解約金や残りのリース料がかかるものが多い。だから、判を押す前の確認がいちばん効きます。

この本には、「どの製品が一番よいか」は書いてありません。会社によって正解が違うためです。書いてあるのは**確かめる順番**です。確かめる順番は、どの会社でもほとんど同じです。

各章は独立しています。**いま契約しようとしているものの章から**読んでください。序章だけは、どの章にも共通する考え方なので、最初に目を通していただくと各章が読みやすくなります。

各章の終わりには、次の3つを付けています。

- **買う前に確かめること**：稟議の前に見返すためのチェックリスト
- **選択肢と費用の目安**：どんな形の契約があるか、おおよその金額の幅
- **よくある質問**：社内で聞かれやすいこと

### この本の情報について

- 金額、制度、期限は **2026年9月時点** の情報です。制度や相場は年によって変わります。数字は必ず見積書と公式の情報で確かめてください。
- 本書は一般的な情報をまとめたもので、個別の会社への税務・法律・労務の助言ではありません。自社に当てはめるときの判断は、顧問の税理士・社会保険労務士・弁護士などの専門家にご相談ください。
- 本書に出てくる費用の目安は、特定の事業者の価格ではなく、一般的な幅を示したものです。
- 本書の原稿は、AIを使って作成し、編集部が内容を確認しています。"""

JOSHO = """各章に入る前に、7つの契約すべてに共通する確かめごとを5つにまとめます。章ごとに言い方は違いますが、中身はこの5つの繰り返しです。

## 1. 月額ではなく、終わるまでの総額で比べる

リースや継続契約の見積書は、月額がいちばん目立つように作られています。けれども実際に払うのは、**契約期間の総額と、そのあとの処分・返却にかかる費用**です。

複合機ならカウンター料金、パソコンならキッティングとデータ消去、社用車なら駐車場と保険、LEDなら古いランプの処分費。月額の外側にある費用を足すと、順位が入れ替わることは珍しくありません。

## 2. 「やめるとき」の条件を、入る前に書面で聞く

入るときの説明は、こちらが聞かなくても丁寧にしてもらえます。やめるときの説明は、こちらから聞かないと出てきません。

- 中途解約はできるか。できるなら、いくらかかるか（計算式まで）
- 自動更新はあるか。止めるには、いつまでに何をすればよいか
- 返却・撤去の費用は、どちらが持つか

この3つを**口約束ではなく書面で**もらってください。担当者が替わっても残るのは紙だけです。

## 3. 見積書に出てこない「手間」を、誰が持つか決める

新しい機械や回線が入った日から、設定、台帳の管理、故障の一次対応、退職者からの回収といった手間が発生します。ここを決めずに契約すると、たいてい総務の誰か一人に集まります。**費用と同じくらい、担当者を先に決める**ことが大切です。

## 4. 建物と契約書の「前提」を先に確かめる

賃貸のオフィスでは、ビルの都合で回線が引けない、電力会社を選べない、照明器具を勝手に替えられない、といったことが起こります。見積もりを集める前に、**賃貸借契約書と管理会社への確認**を済ませておくと、手戻りが減ります。

## 5. 稟議は「安くなる」より「止まらない」「説明できる」で書く

決裁者が気にするのは、金額の差そのものより「あとで自分が説明を求められる事故」です。稟議書には、

- 現状の課題（故障、管理できていない状態、期限の迫り）
- 条件をそろえた2〜3案の比較（5年総額と、途中でやめる場合の費用）
- 悪いほうの想定
- 移行作業の担当と日程

を並べると通りやすくなります。「現状維持」も比較の1案として残すのがこつです。

それでは、各章に進みます。"""

OWARINI = """7つの契約は、扱うものは違っても、確かめることはほとんど同じでした。**総額で比べる、やめるときの条件を書面でもらう、手間の担当を決める、建物の前提を確かめる、稟議は止まらない理由で書く。**

契約書に判を押す前の確認は、数日から数週間です。契約期間は5年前後です。確認の手間は、契約期間の長さに比べればわずかです。

このシリーズでは、ほかの継続契約についても同じ形でまとめる予定です。

- 第2巻（予定）：業務システム編 ─ 勤怠管理・会計ソフト・電子契約・給与計算の外部委託・eラーニング・福利厚生
- 第3巻（予定）：人と制度編 ─ 助成金・補助金、求人媒体、産業医、社労士との顧問契約、オフィス移転、防災備蓄

### 最新の情報はサイトで

本書のもとになった記事と、補助金の締切カレンダーは、Webサイト「オフィスの選びかた」で更新しています。制度や金額が変わったときは、サイト側を先に直します。

"""

SOURCES = [
    ('環境省「一般照明用の蛍光ランプの規制について」', 'https://www.env.go.jp/chemi/tmms/lamp.html'),
    ('環境省「低濃度PCB廃棄物早期処理情報サイト」', 'https://policies.env.go.jp/recycle/pcb/teinoudo-soukishori/'),
    ('警察庁「安全運転管理者の業務の拡充等」', 'https://www.npa.go.jp/bureau/traffic/insyu/index-2.html'),
    ('厚生労働省「職場における労働衛生基準が変わりました」（事務所衛生基準規則の照度）', 'https://www.mhlw.go.jp/content/11300000/000905329.pdf'),
    ('資源エネルギー庁「最終保障供給について」（2023年3月 審議会資料）', 'https://www.meti.go.jp/shingikai/enecho/denryoku_gas/denryoku_gas/pdf/060_04_00.pdf'),
]

# ── 簡易マークダウン → XHTML ──
def inline(s):
    s = html.escape(s, quote=False)
    s = re.sub(r'\*\*(.+?)\*\*', r'<strong>\1</strong>', s)
    return s

def md_to_xhtml(text):
    out, para, lst, ol = [], [], None, None
    def flush():
        nonlocal para, lst, ol
        if para:
            out.append('<p>' + '<br/>'.join(inline(x) for x in para) + '</p>'); para = []
        if lst is not None:
            out.append('<ul>' + ''.join(f'<li>{inline(x)}</li>' for x in lst) + '</ul>'); lst = None
        if ol is not None:
            out.append('<ol>' + ''.join(f'<li>{inline(x)}</li>' for x in ol) + '</ol>'); ol = None
    for line in text.split('\n'):
        t = line.strip()
        if not t:
            flush(); continue
        m_ul = re.match(r'^(?:・|- )(.*)$', t)
        m_ol = re.match(r'^\d+\.\s*(.*)$', t)
        if t.startswith('### '):
            flush(); out.append(f'<h3>{inline(t[4:])}</h3>')
        elif t.startswith('## '):
            flush(); out.append(f'<h2>{inline(t[3:])}</h2>')
        elif m_ul:
            if para or ol is not None: flush()
            lst = (lst or []) + [m_ul.group(1)]
        elif m_ol:
            if para or lst is not None: flush()
            ol = (ol or []) + [m_ol.group(1)]
        else:
            if lst is not None or ol is not None: flush()
            para.append(t)
    flush()
    return '\n'.join(out)

def chapter_md(n, d):
    title = d['title']
    parts = [f'# 第{n}章　{title}', '', d['lead'], '']
    for s in d['sections']:
        parts += [f'## {s["heading"]}', '', s['body'].strip(), '']
    parts += ['## 買う前に確かめること', '']
    parts += ['- □ ' + c for c in d['checklist']] + ['']
    parts += ['## 選択肢と費用の目安（2026年9月時点）', '',
              '特定の事業者の価格ではなく、一般的な幅です。実際の金額は見積書で確かめてください。', '']
    for p in d['products']:
        parts += [f'### {p["name"]}', '', f'**目安：{p["price_range"]}**', '', p['why'], '']
    parts += ['## よくある質問', '']
    for f in d['faq']:
        parts += [f'### {f["q"]}', '', f['a'], '']
    return '\n'.join(parts)

def build():
    chapters = [load(s) for s in CHAPTERS]
    # 仕上げ原稿（人が読む用のマークダウン）
    md = [f'# {TITLE}', '', f'## {SUBTITLE}', '', f'{AUTHOR}', '', '---', '', '# はじめに', '', HAJIMENI, '',
          '# 序章　7つの契約に共通する、5つの確かめごと', '', JOSHO, '']
    for i, d in enumerate(chapters, 1):
        md += [chapter_md(i, d), '']
    md += ['# おわりに', '', OWARINI, f'{SITE}', '', '# 参考にした公的な情報', '']
    md += [f'- {a}　{u}' for a, u in SOURCES]
    md_text = '\n'.join(md)
    open(os.path.join(HERE, '原稿_第1巻.md'), 'w', encoding='utf-8').write(md_text)

    # ── EPUB ──
    css = """body{font-family:serif;line-height:1.8;margin:0 0.5em;}
h1{font-size:1.5em;line-height:1.4;margin:1em 0 1em;padding-bottom:0.3em;border-bottom:2px solid #C0341C;}
h2{font-size:1.2em;line-height:1.4;margin:1.8em 0 0.6em;padding-left:0.5em;border-left:5px solid #1B2A3A;}
h3{font-size:1.05em;line-height:1.4;margin:1.2em 0 0.4em;}
p{margin:0 0 0.9em;text-indent:0;}
ul,ol{margin:0 0 1em 1.2em;padding-left:0.8em;}
li{margin-bottom:0.4em;}
.lead{background:#F2F4F7;padding:0.8em 1em;margin-bottom:1.2em;}
.check li{list-style:none;}
.title-page{text-align:center;margin-top:3em;}
.title-page .t{font-size:1.8em;font-weight:bold;line-height:1.4;}
.title-page .s{font-size:1.05em;margin-top:1em;}
.title-page .a{margin-top:3em;}
.small{font-size:0.9em;}
.colophon p{margin:0 0 0.3em;}
"""
    def page(title, body):
        return ('<?xml version="1.0" encoding="UTF-8"?>\n<!DOCTYPE html>\n'
                '<html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops" xml:lang="ja" lang="ja">\n'
                f'<head><meta charset="UTF-8"/><title>{html.escape(title)}</title>'
                '<link rel="stylesheet" type="text/css" href="style.css"/></head>\n'
                f'<body>\n{body}\n</body></html>\n')

    files = []  # (id, href, title, xhtml, in_toc)
    files.append(('cover', 'cover.xhtml', '表紙',
                  page('表紙', '<div style="text-align:center;margin:0;padding:0;"><img src="cover.jpg" alt="表紙" style="max-width:100%;height:auto;"/></div>'), False))
    files.append(('titlepage', 'title.xhtml', '扉',
                  page(TITLE, f'<div class="title-page"><p class="t">{html.escape(TITLE)}</p>'
                              f'<p class="s">{html.escape(SUBTITLE)}</p><p class="a">{html.escape(AUTHOR)}</p></div>'), False))
    files.append(('hajimeni', 'hajimeni.xhtml', 'はじめに', page('はじめに', '<h1>はじめに</h1>\n' + md_to_xhtml(HAJIMENI)), True))
    files.append(('josho', 'josho.xhtml', '序章　7つの契約に共通する、5つの確かめごと',
                  page('序章', '<h1>序章　7つの契約に共通する、5つの確かめごと</h1>\n' + md_to_xhtml(JOSHO)), True))
    for i, d in enumerate(chapters, 1):
        body = f'<h1>第{i}章　{html.escape(d["title"])}</h1>\n<div class="lead"><p>{inline(d["lead"])}</p></div>\n'
        for s in d['sections']:
            body += f'<h2>{inline(s["heading"])}</h2>\n' + md_to_xhtml(s['body']) + '\n'
        body += '<h2>買う前に確かめること</h2>\n<ul class="check">' + ''.join(f'<li>□ {inline(c)}</li>' for c in d['checklist']) + '</ul>\n'
        body += ('<h2>選択肢と費用の目安（2026年9月時点）</h2>\n<p class="small">特定の事業者の価格ではなく、一般的な幅です。実際の金額は見積書で確かめてください。</p>\n')
        for p in d['products']:
            body += f'<h3>{inline(p["name"])}</h3>\n<p><strong>目安：{inline(p["price_range"])}</strong></p>\n<p>{inline(p["why"])}</p>\n'
        body += '<h2>よくある質問</h2>\n'
        for f in d['faq']:
            body += f'<h3>Q. {inline(f["q"])}</h3>\n<p>{inline(f["a"])}</p>\n'
        files.append((f'ch{i}', f'ch{i:02d}.xhtml', f'第{i}章　{d["title"]}', page(f'第{i}章', body), True))
    owari = '<h1>おわりに</h1>\n' + md_to_xhtml(OWARINI) + f'\n<p><a href="{html.escape(SITE)}">オフィスの選びかた（soumu-choice.com）</a></p>'
    files.append(('owarini', 'owarini.xhtml', 'おわりに', page('おわりに', owari), True))
    src = '<h1>参考にした公的な情報</h1>\n<p>本文中の制度・期限は、2026年9月時点で次の公表資料を確かめて書いています。</p>\n<ul>' + \
          ''.join(f'<li>{html.escape(a)}<br/><a href="{html.escape(u)}">{html.escape(u)}</a></li>' for a, u in SOURCES) + '</ul>'
    files.append(('sources', 'sources.xhtml', '参考にした公的な情報', page('参考にした公的な情報', src), True))
    colo = ('<div class="colophon"><h1>奥付</h1>'
            f'<p><strong>{html.escape(TITLE)}</strong></p><p>{html.escape(SUBTITLE)}</p>'
            f'<p>{html.escape(SERIES)}</p><p>著者：{html.escape(AUTHOR)}</p><p>発行：2026年（電子書籍版）</p>'
            '<p class="small">本書は一般的な情報の提供を目的としたもので、特定の会社への税務・法律・労務上の助言ではありません。'
            '制度・金額は2026年9月時点の情報です。本書の内容を用いた判断の結果について、著者は責任を負いかねます。'
            '本書の原稿はAIを使って作成し、編集部が確認しています。</p>'
            '<p class="small">本書の無断転載・複製を禁じます。</p></div>')
    files.append(('colophon', 'colophon.xhtml', '奥付', page('奥付', colo), True))

    nav_items = ''.join(f'<li><a href="{h}">{html.escape(t)}</a></li>' for _, h, t, _, toc in files if toc)
    nav = page('目次', f'<nav epub:type="toc" id="toc"><h1>目次</h1><ol>{nav_items}</ol></nav>\n'
                     '<nav epub:type="landmarks" hidden=""><ol>'
                     '<li><a epub:type="cover" href="cover.xhtml">表紙</a></li>'
                     '<li><a epub:type="toc" href="nav.xhtml">目次</a></li>'
                     '<li><a epub:type="bodymatter" href="josho.xhtml">本文</a></li></ol></nav>')
    ncx_points = ''.join(
        f'<navPoint id="np{k}" playOrder="{k}"><navLabel><text>{html.escape(t)}</text></navLabel><content src="{h}"/></navPoint>'
        for k, (_, h, t, _, toc) in enumerate([f for f in files if f[4]], 1))
    ncx = ('<?xml version="1.0" encoding="UTF-8"?>\n<ncx xmlns="http://www.daisy.org/z3986/2005/ncx/" version="2005-1" xml:lang="ja">'
           f'<head><meta name="dtb:uid" content="{BOOK_ID}"/></head><docTitle><text>{html.escape(TITLE)}</text></docTitle>'
           f'<navMap>{ncx_points}</navMap></ncx>')
    modified = datetime.datetime.now(datetime.timezone.utc).strftime('%Y-%m-%dT%H:%M:%SZ')
    manifest = ''.join(f'<item id="{i}" href="{h}" media-type="application/xhtml+xml"/>' for i, h, _, _, _ in files)
    spine = ''.join(f'<itemref idref="{i}"/>' for i, *_ in files)
    opf = f"""<?xml version="1.0" encoding="UTF-8"?>
<package xmlns="http://www.idpf.org/2007/opf" version="3.0" unique-identifier="bookid" xml:lang="ja">
<metadata xmlns:dc="http://purl.org/dc/elements/1.1/">
<dc:identifier id="bookid">{BOOK_ID}</dc:identifier>
<dc:title id="t1">{html.escape(TITLE)}</dc:title>
<meta refines="#t1" property="title-type">main</meta>
<dc:title id="t2">{html.escape(SUBTITLE)}</dc:title>
<meta refines="#t2" property="title-type">subtitle</meta>
<dc:creator id="c1">{html.escape(AUTHOR)}</dc:creator>
<meta refines="#c1" property="role" scheme="marc:relators">aut</meta>
<dc:language>ja</dc:language>
<dc:publisher>{html.escape(AUTHOR)}</dc:publisher>
<dc:date>{PUB_DATE}</dc:date>
<meta property="dcterms:modified">{modified}</meta>
<meta name="cover" content="cover-image"/>
</metadata>
<manifest>
<item id="nav" href="nav.xhtml" media-type="application/xhtml+xml" properties="nav"/>
<item id="ncx" href="toc.ncx" media-type="application/x-dtbncx+xml"/>
<item id="css" href="style.css" media-type="text/css"/>
<item id="cover-image" href="cover.jpg" media-type="image/jpeg" properties="cover-image"/>
{manifest}
</manifest>
<spine toc="ncx" page-progression-direction="ltr">
<itemref idref="cover" linear="yes"/>{spine.replace('<itemref idref="cover"/>', '').replace('<itemref idref="titlepage"/>', '<itemref idref="titlepage"/><itemref idref="nav"/>')}
</spine>
<guide><reference type="cover" title="表紙" href="cover.xhtml"/><reference type="toc" title="目次" href="nav.xhtml"/><reference type="text" title="本文" href="josho.xhtml"/></guide>
</package>"""
    container = ('<?xml version="1.0" encoding="UTF-8"?>\n<container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container">'
                 '<rootfiles><rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/></rootfiles></container>')

    # 形の点検（XMLとして読めるか）
    for name, x in [('content.opf', opf), ('nav.xhtml', nav), ('toc.ncx', ncx), ('container.xml', container)] + [(h, x) for _, h, _, x, _ in files]:
        try:
            minidom.parseString(x.encode('utf-8'))
        except Exception as e:
            raise SystemExit(f'XMLが壊れています: {name}: {e}')

    cover = os.path.join(HERE, '表紙.jpg')
    out = os.path.join(HERE, '中小企業の総務が契約の前に確かめること_第1巻.epub')
    with zipfile.ZipFile(out, 'w') as z:
        z.writestr(zipfile.ZipInfo('mimetype'), 'application/epub+zip', compress_type=zipfile.ZIP_STORED)
        z.writestr('META-INF/container.xml', container, compress_type=zipfile.ZIP_DEFLATED)
        z.writestr('OEBPS/content.opf', opf, compress_type=zipfile.ZIP_DEFLATED)
        z.writestr('OEBPS/nav.xhtml', nav, compress_type=zipfile.ZIP_DEFLATED)
        z.writestr('OEBPS/toc.ncx', ncx, compress_type=zipfile.ZIP_DEFLATED)
        z.writestr('OEBPS/style.css', css, compress_type=zipfile.ZIP_DEFLATED)
        z.write(cover, 'OEBPS/cover.jpg', compress_type=zipfile.ZIP_STORED)
        for _, h, _, x, _ in files:
            z.writestr('OEBPS/' + h, x, compress_type=zipfile.ZIP_DEFLATED)

    body_chars = len(re.sub(r'\s', '', md_text))
    print('字数（空白を除く）:', body_chars)
    print('EPUB:', out, os.path.getsize(out), 'bytes')

if __name__ == '__main__':
    build()
