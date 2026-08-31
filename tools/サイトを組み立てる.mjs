/**
 * 記事データ（記事/*.json）から、公開するサイト一式（docs/）を作り直す
 *
 * **毎回まるごと作り直します。**差分で足していくと、設定を変えたときに
 * 古い記事だけ古いままになります。全部作り直せば、いつ見ても全ページが同じ規則です。
 *
 * **広告の表示について。**
 * アフィリエイトは広告です。ステマ規制（景品表示法）上、広告であることが
 * 一般の人に分かる形で示されている必要があります。そこで、
 *   ・全記事の本文が始まる前に「広告を含む」の1行
 *   ・全ページの下に開示ページへのリンク
 * を、こちらで機械的に入れます。書き手（AI）の判断には任せません。
 * 任せると、書き忘れた記事だけが違反になります。
 *
 * Amazonトラッキングidが空のときは、アフィリエイトの文言を出さず、
 * タグなしのふつうの検索リンクにします（事実と違う表示をしないため）。
 *
 * 使い方： node tools/サイトを組み立てる.mjs
 */
import { readFileSync, writeFileSync, readdirSync, existsSync, mkdirSync, rmSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const ここ = dirname(fileURLToPath(import.meta.url))
const 作業場 = join(ここ, '..')
const 記事置き場 = join(作業場, '記事')
const 公開先 = join(作業場, 'docs')
const 設定 = JSON.parse(readFileSync(join(作業場, '設定.json'), 'utf8'))

const タグ = (設定.Amazonトラッキングid ?? '').trim()
const アフィリ有効 = タグ.length > 0
const サイト名 = 設定.サイト名
const 公開URL = (設定.公開URL ?? '').trim().replace(/\/+$/, '')

// ── 文字の始末 ────────────────────────────────────────────────────
const e = s =>
  String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')

/** 本文（空行で段落、行頭「・」で箇条書き）をHTMLにする */
function 本文をHTMLに(text) {
  const 段落 = String(text ?? '').split(/\n\s*\n/)
  return 段落
    .map(p => {
      const 行 = p.split('\n').map(l => l.trim()).filter(Boolean)
      if (行.length && 行.every(l => l.startsWith('・'))) {
        return `<ul>${行.map(l => `<li>${e(l.slice(1).trim())}</li>`).join('')}</ul>`
      }
      return `<p>${e(行.join(''))}</p>`
    })
    .join('\n')
}

const Amazonリンク = keyword => {
  const q = encodeURIComponent(keyword)
  return アフィリ有効
    ? `https://www.amazon.co.jp/s?k=${q}&tag=${encodeURIComponent(タグ)}`
    : `https://www.amazon.co.jp/s?k=${q}`
}

// ── 記事を読む（新しい順） ────────────────────────────────────────
if (!existsSync(記事置き場)) mkdirSync(記事置き場, { recursive: true })
const 記事一覧 = readdirSync(記事置き場)
  .filter(f => f.endsWith('.json'))
  .map(f => JSON.parse(readFileSync(join(記事置き場, f), 'utf8')))
  .sort((a, b) => String(b.published ?? '').localeCompare(String(a.published ?? '')) || String(a.slug).localeCompare(String(b.slug)))

// ── ひな型 ────────────────────────────────────────────────────────
const 広告の1行 = アフィリ有効
  ? '<p class="ad-notice">この記事には広告（Amazonアソシエイトのリンク）が含まれます。</p>'
  : '<p class="ad-notice">この記事の商品リンクはAmazonの検索結果へのリンクです（現在、アフィリエイトの提携はありません）。</p>'

const 下の帯 = `
<footer class="foot">
  <p><a href="{{ROOT}}index.html">${e(サイト名)}</a> ・ <a href="{{ROOT}}disclosure.html">広告と免責について</a></p>
  ${設定['AIが書いたことを明記する'] ? '<p class="small">この記事はAIが下書きしています。ご購入前には必ずメーカーの公式情報をご確認ください。</p>' : ''}
</footer>`

function ページ({ title, description, body, root, canonical }) {
  return `<!doctype html>
<html lang="ja">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${e(title)}</title>
<meta name="description" content="${e(description)}">
${canonical ? `<link rel="canonical" href="${e(canonical)}">` : ''}
<meta property="og:title" content="${e(title)}">
<meta property="og:description" content="${e(description)}">
<meta property="og:type" content="article">
<link rel="stylesheet" href="${root}style.css">
</head>
<body>
<header class="head">
  <a class="brand" href="${root}index.html">${e(サイト名)}</a>
  <p class="tagline">${e(設定.サイトの説明)}</p>
</header>
<main>
${body}
</main>
${下の帯.replaceAll('{{ROOT}}', root)}
</body>
</html>
`
}

// ── 記事ページ ────────────────────────────────────────────────────
function 記事ページ(k) {
  const 目次 = k.sections.map((s, i) => `<li><a href="#s${i + 1}">${e(s.heading)}</a></li>`).join('')

  const 本編 = k.sections
    .map((s, i) => `<section id="s${i + 1}"><h2>${e(s.heading)}</h2>${本文をHTMLに(s.body)}</section>`)
    .join('\n')

  const 商品 = k.products
    .map(
      p => `<div class="item">
  <h3>${e(p.name)}</h3>
  <p class="price">目安：${e(p.price_range)}</p>
  <p>${e(p.why)}</p>
  <p><a class="btn" href="${e(Amazonリンク(p.amazon_keyword))}" target="_blank" rel="nofollow sponsored noopener">Amazonで「${e(p.amazon_keyword)}」を見る</a></p>
</div>`
    )
    .join('\n')

  const 確認 = k.checklist.map(c => `<li>${e(c)}</li>`).join('')
  const 質問 = k.faq.map(f => `<div class="qa"><h3>${e(f.q)}</h3><p>${e(f.a)}</p></div>`).join('\n')

  const body = `
<article>
  <h1>${e(k.title)}</h1>
  <p class="meta">${e(k.published)}　${k.tags.map(t => `<span class="tag">${e(t)}</span>`).join('')}</p>
  ${広告の1行}
  <p class="lead">${e(k.lead)}</p>

  <nav class="toc"><p class="toc-title">この記事の中身</p><ol>${目次}</ol></nav>

  ${本編}

  <section>
    <h2>買う前に確かめること</h2>
    <ul class="check">${確認}</ul>
  </section>

  <section>
    <h2>候補になる分類</h2>
    ${商品}
  </section>

  <section>
    <h2>よくある質問</h2>
    ${質問}
  </section>
</article>
<p class="back"><a href="../index.html">← 記事の一覧にもどる</a></p>
`
  return ページ({
    title: `${k.title}｜${サイト名}`,
    description: k.description,
    body,
    root: '../',
    canonical: 公開URL ? `${公開URL}/kiji/${k.slug}.html` : ''
  })
}

// ── 一覧ページ ────────────────────────────────────────────────────
function 一覧ページ() {
  const 中身 = 記事一覧.length
    ? 記事一覧
        .map(
          k => `<li class="card">
  <p class="date">${e(k.published)}</p>
  <h2><a href="kiji/${e(k.slug)}.html">${e(k.title)}</a></h2>
  <p>${e(k.description)}</p>
  <p class="tags">${k.tags.map(t => `<span class="tag">${e(t)}</span>`).join('')}</p>
</li>`
        )
        .join('\n')
    : '<li class="card"><p>まだ記事がありません。毎週月曜の朝に1本ずつ増えます。</p></li>'

  return ページ({
    title: `${サイト名}｜${設定.サイトの説明}`,
    description: 設定.サイトの説明,
    body: `<h1 class="sr">記事の一覧</h1>\n<ul class="cards">\n${中身}\n</ul>`,
    root: './',
    canonical: 公開URL ? `${公開URL}/` : ''
  })
}

// ── 開示ページ ────────────────────────────────────────────────────
function 開示ページ() {
  const アマゾン文 = アフィリ有効
    ? `<h2>Amazonアソシエイトについて</h2>
<p>当サイトは、Amazon.co.jpを宣伝しリンクすることによってサイトが紹介料を獲得できる手段を提供することを目的に設定されたアフィリエイトプログラムである、Amazonアソシエイト・プログラムの参加者です。</p>
<p>記事内の商品リンクをたどってご購入いただいた場合、当サイトに紹介料が支払われることがあります。お客様のお支払い額が増えることはありません。</p>`
    : `<h2>広告について</h2>
<p>現在、当サイトはアフィリエイトプログラムに参加していません。記事内の商品リンクは、Amazonの検索結果への通常のリンクです。今後、提携を開始した場合は、このページと各記事の冒頭で改めてお知らせします。</p>`

  const body = `
<article>
<h1>広告と免責について</h1>
${アマゾン文}

<h2>記事の作られ方</h2>
<p>当サイトの記事は、生成AI（Claude）が下書きしたものを公開しています。事実関係・価格・仕様は変わることがあります。ご購入の前には、必ずメーカーや販売店の公式情報をご確認ください。</p>

<h2>免責</h2>
<p>当サイトの情報は、正確さを期していますが、内容を保証するものではありません。当サイトの情報を用いて行われた判断・行為によって生じたいかなる損害についても、責任を負いかねます。</p>
<p>特定の商品について「これが最良である」と断定する意図はありません。価格・在庫・仕様は執筆時点のもので、現在と異なる場合があります。</p>

<h2>お問い合わせ</h2>
<p>記事内容の誤りのご指摘は、掲載元のGitHubリポジトリのIssueよりお願いいたします。</p>
</article>
`
  return ページ({ title: `広告と免責について｜${サイト名}`, description: '当サイトの広告表示と免責事項', body, root: './' })
}

// ── CSS ───────────────────────────────────────────────────────────
const CSS = `:root{--ink:#1c1c1e;--sub:#6b6b70;--line:#e3e3e6;--bg:#fff;--accent:#0b6b5b;--card:#fafafa}
@media (prefers-color-scheme:dark){:root{--ink:#e8e8ea;--sub:#a0a0a6;--line:#2e2e33;--bg:#151517;--accent:#4fd1b5;--card:#1d1d20}}
*{box-sizing:border-box}
body{margin:0;background:var(--bg);color:var(--ink);font-family:-apple-system,BlinkMacSystemFont,"Hiragino Kaku Gothic ProN","Yu Gothic",Meiryo,sans-serif;line-height:1.85;font-size:17px}
main{max-width:44rem;margin:0 auto;padding:0 1.2rem 4rem}
.head{max-width:44rem;margin:0 auto;padding:2rem 1.2rem 1.4rem;border-bottom:1px solid var(--line)}
.brand{font-size:1.15rem;font-weight:700;color:var(--ink);text-decoration:none;letter-spacing:.02em}
.tagline{margin:.4rem 0 0;color:var(--sub);font-size:.86rem}
h1{font-size:1.7rem;line-height:1.45;margin:2rem 0 .6rem;letter-spacing:.01em}
h2{font-size:1.22rem;margin:2.6rem 0 .8rem;padding-top:.4rem;border-top:1px solid var(--line)}
h3{font-size:1.02rem;margin:1.6rem 0 .4rem}
p{margin:0 0 1.1rem}
a{color:var(--accent)}
.sr{position:absolute;left:-9999px}
.meta{color:var(--sub);font-size:.84rem;margin-bottom:1.2rem}
.tag{display:inline-block;background:var(--card);border:1px solid var(--line);border-radius:999px;padding:.08rem .6rem;margin-right:.3rem;font-size:.76rem;color:var(--sub)}
.ad-notice{background:var(--card);border:1px solid var(--line);border-left:3px solid var(--accent);padding:.7rem .9rem;font-size:.84rem;color:var(--sub);margin-bottom:1.4rem}
.lead{font-size:1.05rem}
.toc{background:var(--card);border:1px solid var(--line);border-radius:8px;padding:1rem 1.2rem;margin:1.6rem 0}
.toc-title{font-size:.8rem;color:var(--sub);margin:0 0 .4rem;letter-spacing:.08em}
.toc ol{margin:0;padding-left:1.2rem}
.toc li{margin:.2rem 0}
ul,ol{padding-left:1.3rem}
li{margin:.3rem 0}
.check li{margin:.5rem 0}
.item{border:1px solid var(--line);border-radius:8px;padding:1rem 1.2rem;margin:1rem 0;background:var(--card)}
.item h3{margin-top:0}
.price{color:var(--sub);font-size:.86rem;margin-bottom:.6rem}
.btn{display:inline-block;background:var(--accent);color:#fff;text-decoration:none;padding:.55rem 1.1rem;border-radius:6px;font-size:.9rem}
.qa h3{font-size:.98rem}
.cards{list-style:none;padding:0;margin:2rem 0}
.card{border-bottom:1px solid var(--line);padding:1.6rem 0}
.card h2{border:0;margin:.2rem 0 .5rem;font-size:1.16rem;padding-top:0}
.card h2 a{color:var(--ink);text-decoration:none}
.card h2 a:hover{color:var(--accent)}
.date{color:var(--sub);font-size:.8rem;margin:0}
.back{margin-top:3rem;font-size:.9rem}
.foot{max-width:44rem;margin:0 auto;padding:1.6rem 1.2rem 3rem;border-top:1px solid var(--line);color:var(--sub);font-size:.84rem}
.foot p{margin:.3rem 0}
.small{font-size:.78rem}
`

// ── 書き出し ──────────────────────────────────────────────────────
rmSync(公開先, { recursive: true, force: true })
mkdirSync(join(公開先, 'kiji'), { recursive: true })

writeFileSync(join(公開先, '.nojekyll'), '', 'utf8')
writeFileSync(join(公開先, 'style.css'), CSS, 'utf8')
writeFileSync(join(公開先, 'index.html'), 一覧ページ(), 'utf8')
writeFileSync(join(公開先, 'disclosure.html'), 開示ページ(), 'utf8')
for (const k of 記事一覧) writeFileSync(join(公開先, 'kiji', `${k.slug}.html`), 記事ページ(k), 'utf8')

// サイトマップとrobots（公開URLが分かっているときだけ）
if (公開URL) {
  const url = (loc, d) => `  <url><loc>${e(loc)}</loc>${d ? `<lastmod>${e(d)}</lastmod>` : ''}</url>`
  const 中身 = [
    url(`${公開URL}/`),
    url(`${公開URL}/disclosure.html`),
    ...記事一覧.map(k => url(`${公開URL}/kiji/${k.slug}.html`, k.published))
  ].join('\n')
  writeFileSync(
    join(公開先, 'sitemap.xml'),
    `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${中身}\n</urlset>\n`,
    'utf8'
  )
  writeFileSync(join(公開先, 'robots.txt'), `User-agent: *\nAllow: /\nSitemap: ${公開URL}/sitemap.xml\n`, 'utf8')
} else {
  writeFileSync(join(公開先, 'robots.txt'), 'User-agent: *\nAllow: /\n', 'utf8')
  console.log('※ 設定.json の「公開URL」が空のため、sitemap.xml は作りませんでした。')
}

console.log(`組み立てました：記事 ${記事一覧.length} 本 → docs/`)
console.log(アフィリ有効 ? `Amazonタグ：${タグ}（有効）` : 'Amazonタグ：未設定（タグなしリンクで出力）')
