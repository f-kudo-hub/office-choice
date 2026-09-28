# -*- coding: utf-8 -*-
"""第2巻・第3巻（書き下ろし）のEPUBを、各巻フォルダの 原稿.md から組み立てる。
使い方:  python 作る_書き下ろし.py 2   /   python 作る_書き下ろし.py 3
入力:    第N巻\\原稿.md  第N巻\\表紙.jpg（先に 表紙を作る.py N を走らせる）
出力:    第N巻\\中小企業の総務が契約の前に確かめること_第N巻.epub

第1巻（作る.py）はサイトの記事JSONから組むが、2巻・3巻はKDPセレクト（Kindle Unlimited）に
入れるため、サイトの文を使わず書き下ろした原稿.mdだけから組む。記事JSONは読まない。

原稿.md の決まり:
  1行目 "# 書名"、次の "## " が副題。最初の "---" より後が本文。
  "# " で始まる行ごとに1ファイル（はじめに／序章／第N章／おわりに／参考にした公的な情報）。
  章（"# 第"で始まる）の最初の段落は、囲みのリード文にする。
"""
import os, re, sys, html, uuid, zipfile, datetime
from xml.dom import minidom

HERE = os.path.dirname(os.path.abspath(__file__))
TITLE = '中小企業の総務が、契約の前に確かめること'
AUTHOR = 'オフィスの選びかた編集部'
PUB_DATE = '2026-09-28'

VOL = sys.argv[1] if len(sys.argv) > 1 else '2'
if VOL not in ('2', '3'):
    raise SystemExit('巻は 2 か 3 を指定してください')
DIR = os.path.join(HERE, f'第{VOL}巻')
SERIES = f'総務の契約前チェック {VOL}'
SITE = f'https://soumu-choice.com/?utm_source=kindle&utm_medium=ebook&utm_campaign=vol{VOL}'
BOOK_ID = 'urn:uuid:' + str(uuid.uuid5(uuid.NAMESPACE_URL, f'soumu-choice.com/kindle/vol{VOL}'))

URL_RE = re.compile(r'(https?://[^\s　）)」]+)')

def inline(s):
    s = html.escape(s, quote=False)
    s = re.sub(r'\*\*(.+?)\*\*', r'<strong>\1</strong>', s)
    s = URL_RE.sub(lambda m: f'<a href="{m.group(1)}">{m.group(1)}</a>', s)
    return s

def md_to_xhtml(text):
    out, para, lst, ol = [], [], None, None
    def flush():
        nonlocal para, lst, ol
        if para:
            out.append('<p>' + '<br/>'.join(inline(x) for x in para) + '</p>'); para = []
        if lst is not None:
            cls = ' class="check"' if all(x.startswith('□') for x in lst) else ''
            out.append(f'<ul{cls}>' + ''.join(f'<li>{inline(x)}</li>' for x in lst) + '</ul>'); lst = None
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

def parse():
    src = open(os.path.join(DIR, '原稿.md'), encoding='utf-8').read()
    head, body = src.split('\n---\n', 1)
    subtitle = re.search(r'^## (.+)$', head, re.M).group(1).strip()
    parts = re.split(r'^# (.+)$', body, flags=re.M)
    sections = [(parts[i].strip(), parts[i + 1].strip()) for i in range(1, len(parts), 2)]
    return subtitle, sections, src

def build():
    subtitle, sections, src = parse()
    names = [n for n, _ in sections]
    for need in ('はじめに', 'おわりに', '参考にした公的な情報'):
        if need not in names:
            raise SystemExit(f'原稿に「{need}」がありません')
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
a{word-break:break-all;}
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
                              f'<p class="s">{html.escape(subtitle)}</p><p class="a">{html.escape(AUTHOR)}</p></div>'), False))
    ch = 0
    first_body = None
    for name, text in sections:
        if name.startswith('第'):
            ch += 1
            fid, href = f'ch{ch}', f'ch{ch:02d}.xhtml'
            lead, rest = (text.split('\n\n', 1) + [''])[:2]
            body = f'<h1>{inline(name)}</h1>\n<div class="lead"><p>{inline(lead.strip())}</p></div>\n' + md_to_xhtml(rest)
        elif name == 'はじめに':
            fid, href = 'hajimeni', 'hajimeni.xhtml'; body = f'<h1>{inline(name)}</h1>\n' + md_to_xhtml(text)
        elif name.startswith('序章'):
            fid, href = 'josho', 'josho.xhtml'; body = f'<h1>{inline(name)}</h1>\n' + md_to_xhtml(text)
        elif name == 'おわりに':
            fid, href = 'owarini', 'owarini.xhtml'
            body = (f'<h1>{inline(name)}</h1>\n' + md_to_xhtml(text) +
                    f'\n<p><a href="{html.escape(SITE)}">オフィスの選びかた（soumu-choice.com）</a></p>')
        elif name == '参考にした公的な情報':
            fid, href = 'sources', 'sources.xhtml'; body = f'<h1>{inline(name)}</h1>\n' + md_to_xhtml(text)
        else:
            raise SystemExit(f'知らない見出しです: {name}')
        if first_body is None and fid in ('josho', 'ch1'):
            first_body = href
        files.append((fid, href, name, page(name, body), True))
    colo = ('<div class="colophon"><h1>奥付</h1>'
            f'<p><strong>{html.escape(TITLE)}</strong></p><p>{html.escape(subtitle)}</p>'
            f'<p>{html.escape(SERIES)}</p><p>著者：{html.escape(AUTHOR)}</p><p>発行：2026年（電子書籍版）</p>'
            '<p class="small">本書は一般的な情報の提供を目的としたもので、特定の会社への税務・法律・労務上の助言ではありません。'
            '個別の判断は、税理士・社会保険労務士・弁護士などの専門家にご相談ください。'
            '制度・金額は2026年9月時点の情報です。本書の内容を用いた判断の結果について、著者は責任を負いかねます。'
            '本書の原稿はAIを使って作成し、編集部が確認しています。</p>'
            '<p class="small">本書の無断転載・複製を禁じます。</p></div>')
    files.append(('colophon', 'colophon.xhtml', '奥付', page('奥付', colo), True))

    nav_items = ''.join(f'<li><a href="{h}">{html.escape(t)}</a></li>' for _, h, t, _, toc in files if toc)
    nav = page('目次', f'<nav epub:type="toc" id="toc"><h1>目次</h1><ol>{nav_items}</ol></nav>\n'
                     '<nav epub:type="landmarks" hidden=""><ol>'
                     '<li><a epub:type="cover" href="cover.xhtml">表紙</a></li>'
                     '<li><a epub:type="toc" href="nav.xhtml">目次</a></li>'
                     f'<li><a epub:type="bodymatter" href="{first_body}">本文</a></li></ol></nav>')
    ncx_points = ''.join(
        f'<navPoint id="np{k}" playOrder="{k}"><navLabel><text>{html.escape(t)}</text></navLabel><content src="{h}"/></navPoint>'
        for k, (_, h, t, _, toc) in enumerate([f for f in files if f[4]], 1))
    ncx = ('<?xml version="1.0" encoding="UTF-8"?>\n<ncx xmlns="http://www.daisy.org/z3986/2005/ncx/" version="2005-1" xml:lang="ja">'
           f'<head><meta name="dtb:uid" content="{BOOK_ID}"/></head><docTitle><text>{html.escape(TITLE)}</text></docTitle>'
           f'<navMap>{ncx_points}</navMap></ncx>')
    modified = datetime.datetime.now(datetime.timezone.utc).strftime('%Y-%m-%dT%H:%M:%SZ')
    manifest = ''.join(f'<item id="{i}" href="{h}" media-type="application/xhtml+xml"/>' for i, h, _, _, _ in files)
    spine = ''.join(f'<itemref idref="{i}"/>' for i, *_ in files if i != 'cover')
    spine = spine.replace('<itemref idref="titlepage"/>', '<itemref idref="titlepage"/><itemref idref="nav"/>')
    opf = f"""<?xml version="1.0" encoding="UTF-8"?>
<package xmlns="http://www.idpf.org/2007/opf" version="3.0" unique-identifier="bookid" xml:lang="ja">
<metadata xmlns:dc="http://purl.org/dc/elements/1.1/">
<dc:identifier id="bookid">{BOOK_ID}</dc:identifier>
<dc:title id="t1">{html.escape(TITLE)}</dc:title>
<meta refines="#t1" property="title-type">main</meta>
<dc:title id="t2">{html.escape(subtitle)}</dc:title>
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
<itemref idref="cover" linear="yes"/>{spine}
</spine>
<guide><reference type="cover" title="表紙" href="cover.xhtml"/><reference type="toc" title="目次" href="nav.xhtml"/><reference type="text" title="本文" href="{first_body}"/></guide>
</package>"""
    container = ('<?xml version="1.0" encoding="UTF-8"?>\n<container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container">'
                 '<rootfiles><rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/></rootfiles></container>')

    for name, x in [('content.opf', opf), ('nav.xhtml', nav), ('toc.ncx', ncx), ('container.xml', container)] + [(h, x) for _, h, _, x, _ in files]:
        try:
            minidom.parseString(x.encode('utf-8'))
        except Exception as e:
            raise SystemExit(f'XMLが壊れています: {name}: {e}')

    # 誇大表現の点検（本文に残っていたら止める）
    ng = [w for w in ('必ず儲', '絶対', 'No.1', 'ナンバーワン', '最安', '業界一', '日本一') if w in src]
    if ng:
        raise SystemExit(f'誇大表現が残っています: {ng}')

    cover = os.path.join(DIR, '表紙.jpg')
    out = os.path.join(DIR, f'中小企業の総務が契約の前に確かめること_第{VOL}巻.epub')
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

    body = src.split('\n---\n', 1)[1]
    body = body.split('\n# 参考にした公的な情報', 1)[0]
    chars = len(re.sub(r'[\s#*\-□]', '', body))
    print('章:', ch, '／ 本文の字数（空白・記号を除く、参考資料を除く）:', chars)
    print('EPUB:', out, os.path.getsize(out), 'bytes')

if __name__ == '__main__':
    build()
