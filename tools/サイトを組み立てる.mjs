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
import { 補助金ページ一式を作る } from './補助金のページを作る.mjs'

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

/**
 * 提携先（2026-08-31）。A8.netで提携が承認された窓口を、記事ごとに出します。
 * ここに無い記事には申込先を出しません。**提携していない先へは案内しない。**
 */
const 提携先の場所 = join(作業場, '提携先.json')
const 提携先 = existsSync(提携先の場所) ? JSON.parse(readFileSync(提携先の場所, 'utf8')) : []
const 提携先を引く = slug => 提携先.filter(x => (x.記事 ?? []).includes(slug))

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
/**
 * 広告の1行は、**その記事に実際にAmazonリンクがあるときだけ**Amazonの話をする。
 * サービスだけの記事に「商品リンクはAmazonの…」と書くと、実態と違う表示になる（景品表示法）。
 */
const 広告の1行を作る = 記事 => {
  const 物がある = (記事.products ?? []).some(p => (p.amazon_keyword ?? '').trim())
  const 申込先がある = 提携先を引く(記事.slug).length > 0
  // **提携が済んだ記事は、はっきり広告と書く**（2026-08-31）。ステマ規制。
  if (申込先がある) {
    return 物がある
      ? '<p class="ad-notice">この記事には広告（アフィリエイトのリンク）が含まれます。申込先とAmazonのリンクから申し込まれると、当サイトに紹介料が入ります。<strong>お支払い額が上がることはありません。</strong></p>'
      : '<p class="ad-notice">この記事には広告（アフィリエイトのリンク）が含まれます。記事の下の申込先から申し込まれると、当サイトに紹介料が入ります。<strong>お支払い額が上がることはありません。</strong></p>'
  }
  if (!物がある) return '<p class="ad-notice">この記事で紹介しているのは、申し込む形のサービスです。現在、アフィリエイトの提携はありません。</p>'
  return アフィリ有効
    ? '<p class="ad-notice">この記事には広告（Amazonアソシエイトのリンク）が含まれます。</p>'
    : '<p class="ad-notice">この記事の商品リンクはAmazonの検索結果へのリンクです（現在、アフィリエイトの提携はありません）。</p>'
}

/**
 * 月額のご案内。
 * ---------------------------------------------------------------------------
 * **補助金のページにだけ出します。**記事のページには出しません。
 * 補助金を見に来た方は「締切を見逃したくない」と思って来ています。
 * そこにだけ置くのが、いちばん自然で、いちばん効きます。
 *
 * **設定に note のURLが無ければ、何も出しません。**
 * 「準備中」と出すくらいなら、出さないほうがよい。
 */
function 月額のご案内(type) {
  const url = (設定['noteマガジンURL'] ?? '').trim()
  if (!url || type !== '補助金') return ''
  return `
<aside class="offer">
  <p class="offer-lead">締切を見逃さないために</p>
  <p>受付中の補助金を<strong>毎月まとめて</strong>お届けしています。締切の近い順に並べ、公式ページへの直リンク付き。</p>
  <p><a class="offer-btn" href="${e(url)}" target="_blank" rel="noopener">月額の購読を見る</a></p>
  <p class="small">出典はデジタル庁「Jグランツ」の公開データです。まず無料の号をご覧いただけます。</p>
</aside>`
}

const 下の帯 = `
<footer class="foot">
  <p><a href="{{ROOT}}index.html">${e(サイト名)}</a> ・ <a href="{{ROOT}}disclosure.html">広告と免責について</a></p>
  ${設定['AIが書いたことを明記する'] ? '<p class="small">この記事はAIが下書きしています。ご購入前には必ずメーカーの公式情報をご確認ください。</p>' : ''}
</footer>`

/**
 * 構造化データ（JSON-LD）を作る。
 *
 * **2026年の検索は、人だけでなくAIが読む。**AI Overviews に引用されるかどうかで
 * 流入が変わるため、記事の「何者か・いつ書いたか・どんな問いに答えているか」を
 * 機械が読める形で置く。とくに FAQPage は、質問と答えの対応がそのまま伝わる。
 *
 * **本文に無いことを書かない。**タイトル・説明・FAQは、実際にページに出ている
 * ものだけをそのまま入れる（構造化データだけ盛るのは、検索側のガイドライン違反）。
 */
/**
 * アクセス解析のタグ。
 * ---------------------------------------------------------------------------
 * **これが無いと、誰も見ていないのか、見られているのに売れないのかが分かりません。**
 * 2026-09-01 常務のご指示「AI業務でこれだけ稼げるを実証したい。結果を重視したい」。
 * 数えられないものは、実証できません。
 *
 * 設定.json に測定IDを書けば入ります。**書いていなければ何も入りません**
 * （空のタグを出すと、あとで「入れたのに動かない」と悩むので、いっそ出しません）。
 *
 *   "GA測定ID": "G-XXXXXXXXXX"       … Google Analytics
 *   "Clarity ID": "xxxxxxxxxx"       … Microsoft Clarity（無料・ヒートマップが見られる）
 */
function アクセス解析() {
  const 出 = []
  const ga = (設定['GA測定ID'] ?? '').trim()
  if (ga) {
    出.push(`<script async src="https://www.googletagmanager.com/gtag/js?id=${ga}"></script>`)
    出.push(`<script>window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments)}gtag('js',new Date());gtag('config','${ga}')</script>`)
  }
  const cl = (設定['ClarityID'] ?? '').trim()
  if (cl) {
    出.push(`<script>(function(c,l,a,r,i,t,y){c[a]=c[a]||function(){(c[a].q=c[a].q||[]).push(arguments)};t=l.createElement(r);t.async=1;t.src="https://www.clarity.ms/tag/"+i;y=l.getElementsByTagName(r)[0];y.parentNode.insertBefore(t,y)})(window,document,"clarity","script","${cl}")</script>`)
  }
  return 出.join(String.fromCharCode(10))
}

function 構造化データ({ type, title, description, canonical, published, faq }) {
  if (!canonical) return ''
  const 物 = []

  物.push({
    '@context': 'https://schema.org',
    '@type': type === '記事' ? 'BlogPosting' : 'WebSite',
    headline: title,
    description,
    url: canonical,
    inLanguage: 'ja',
    ...(published ? { datePublished: published, dateModified: published } : {}),
    ...(公開URL ? { isPartOf: { '@type': 'WebSite', name: サイト名, url: `${公開URL}/` } } : {}),
  })

  // FAQは「ページに実際に出ている質問と答え」だけ
  if (Array.isArray(faq) && faq.length) {
    物.push({
      '@context': 'https://schema.org',
      '@type': 'FAQPage',
      mainEntity: faq.map(f => ({
        '@type': 'Question',
        name: f.q ?? f.question ?? '',
        acceptedAnswer: { '@type': 'Answer', text: f.a ?? f.answer ?? '' },
      })).filter(x => x.name && x.acceptedAnswer.text),
    })
  }

  if (type === '記事' && 公開URL) {
    物.push({
      '@context': 'https://schema.org',
      '@type': 'BreadcrumbList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: サイト名, item: `${公開URL}/` },
        { '@type': 'ListItem', position: 2, name: title, item: canonical },
      ],
    })
  }

  // </script> が本文に混ざるとHTMLが壊れるので必ず割る
  return 物
    .map(o => `<script type="application/ld+json">${JSON.stringify(o).replaceAll('</', '<\\/')}</script>`)
    .join('\n')
}

function ページ({ title, description, body, root, canonical, type, published, faq }) {
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
<meta property="og:type" content="${type === '記事' ? 'article' : 'website'}">
${canonical ? `<meta property="og:url" content="${e(canonical)}">` : ''}
<meta property="og:site_name" content="${e(サイト名)}">
<meta name="twitter:card" content="summary">
${構造化データ({ type, title, description, canonical, published, faq })}
<link rel="stylesheet" href="${root}style.css">
${アクセス解析()}
</head>
<body>
<header class="head">
  <a class="brand" href="${root}index.html">${e(サイト名)}</a>
  <p class="tagline">${e(設定.サイトの説明)}</p>
</header>
<main>
${body}
${月額のご案内(type)}
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
  ${(p.amazon_keyword ?? '').trim()
    ? `<p><a class="btn" href="${e(Amazonリンク(p.amazon_keyword))}" target="_blank" rel="nofollow sponsored noopener">Amazonで「${e(p.amazon_keyword)}」を見る</a></p>`
    : 提携先を引く(k.slug).length > 0
      ? `<p class="note">これは申し込む形のサービスです。申込先は<a href="#apply">この記事の下</a>にまとめています。</p>`
      : `<p class="note">これは申し込む形のサービスです。提携が決まりしだい、ここに申込先を載せます。</p>`}
</div>`
    )
    .join('\n')

  const 申込先 = 提携先を引く(k.slug)
  const 申込先の節 = 申込先.length
    ? `
  <section id="apply" class="apply">
    <h2>申し込み先</h2>
    <p class="note">下は広告です。ここから申し込まれると当サイトに紹介料が入りますが、<strong>お支払い額は変わりません。</strong>金額や条件は必ず申込先の公式ページでご確認ください。</p>
    ${申込先
      .map(
        x => `<div class="item">
  <h3>${e(x.名前)}</h3>
  <p class="price">${e(x.会社)}</p>
  <p>${e(x.一言)}</p>
  <p><a class="btn" href="${e(x.url)}" target="_blank" rel="nofollow sponsored noopener">${e(x.名前)}を見る</a></p>
  ${x.計測 ? `<img src="${e(x.計測)}" width="1" height="1" alt="" style="border:0">` : ''}
</div>`
      )
      .join('')}
  </section>`
    : ''

  /**
   * 関連ページ（記事JSONの links）。**本文の中にリンクは書けません。**
   * 本文は丸ごと文字として扱う（HTMLを書けると、書き手が壊せてしまう）ため、
   * 「詳しくはこちら」を本文に書いても、ただの文字列になって押せません。
   * リンクにしたいものは、ここに分けて置きます。
   */
  const 関連 = (k.links ?? []).filter(x => x && x.url && x.name)
  const 関連の節 = 関連.length
    ? `
  <section id="related">
    <h2>あわせて使えるもの</h2>
    ${関連
      .map(x => `<div class="item">
  <h3><a href="${e(x.url)}">${e(x.name)}</a></h3>
  <p>${e(x.why ?? '')}</p>
</div>`)
      .join('')}
  </section>`
    : ''

  const 確認 = k.checklist.map(c => `<li>${e(c)}</li>`).join('')
  const 質問 = k.faq.map(f => `<div class="qa"><h3>${e(f.q)}</h3><p>${e(f.a)}</p></div>`).join('\n')

  const body = `
<article>
  <h1>${e(k.title)}</h1>
  <p class="meta">${e(k.published)}　${k.tags.map(t => `<span class="tag">${e(t)}</span>`).join('')}</p>
  ${広告の1行を作る(k)}
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
  ${申込先の節}
  ${関連の節}

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
    canonical: 公開URL ? `${公開URL}/kiji/${k.slug}.html` : '',
    type: '記事',
    published: k.published,
    faq: k.faq,
  })
}

// ── 一覧ページ ────────────────────────────────────────────────────
/**
 * 補助金の締切一覧への案内。
 * **トップから1クリックで行けないページは、無いのと同じです。**
 * 検索から直接ページに来た人にも、サイト全体で何をやっているかが伝わるように置きます。
 */
const 補助金への案内 = (受付中, 間近 = [], 分布 = []) => {
  if (!受付中) return ''
  /* 締切までの残り日数の分布。**「147件あります」は多さの自慢にしかならない。**
     「30日以内に締切が12件ある」と言えば、読む人は自分の予定と照らせる。 */
  const 最大 = Math.max(1, ...分布.map(x => x.件数))
  const 分布の図 = 分布.length
    ? `<figure class="fig">
      <svg viewBox="0 0 600 ${40 + 分布.length * 34}" role="img" aria-label="締切までの残り日数ごとの件数。${分布.map(x => `${x.名}が${x.件数}件`).join('、')}。">
        <text x="0" y="16" font-size="12.5" fill="var(--sub)">締切までの残り日数（受付中 ${受付中}件）</text>
${分布.map((x, i) => {
  const y = 34 + i * 34
  const w = Math.max(2, Math.round(430 * (x.件数 / 最大)))
  return `        <text x="0" y="${y + 15}" font-size="13" fill="var(--sub)">${e(x.名)}</text>
        <rect x="112" y="${y + 3}" width="430" height="16" rx="3" fill="var(--line)"></rect>
        <rect class="bar" x="112" y="${y + 3}" width="${w}" height="16" rx="3" fill="var(--accent)"></rect>
        <text x="600" y="${y + 15}" text-anchor="end" font-size="13" font-weight="700" fill="var(--ink)">${x.件数}件</text>`
}).join('')}
      </svg>
      <figcaption>デジタル庁「Jグランツ」の公開データから、中小企業が使えるものだけを抜き出して数えています。毎朝取り直しています。</figcaption>
    </figure>`
    : ''
  /* 締切がいちばん近い5件。**件数より、名前のほうが自分ごとになる。** */
  const 間近の表 = 間近.length
    ? `<ul class="soon">
${間近.map(k => `      <li><span class="d">あと${k.日数}日</span><a href="${e(k.先)}">${e(k.名称)}</a><span class="pl">${e(k.地域 || '全国')}</span></li>`).join('')}
    </ul>`
    : ''
  return `<section class="lead-in">
  <h2><a href="hojo/index.html">いま受付中の補助金の締切一覧（${受付中}件）</a></h2>
  <p>デジタル庁「Jグランツ」の公開データから、中小企業の設備投資・IT導入・販路拡大・職場環境の改善に使えるものだけを抜き出しています。1件ずつのページに、<strong>自己負担の目安</strong>と、<strong>締切から逆算した段取り</strong>をまとめました。毎朝更新しています。</p>
  ${分布の図}
  <h3 class="soon-h">締切がいちばん近いもの</h3>
  ${間近の表}
  <p><a href="hojo/index.html">▸ 受付中の${受付中}件をすべて見る</a>　／　<a href="hojo/checker.html"><strong>都道府県とやりたいことから探す（登録不要）</strong></a></p>
</section>`
}

function 一覧ページ(補助金の受付中, 間近, 分布) {
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
    body: `<h1 class="sr">記事の一覧</h1>\n${補助金への案内(補助金の受付中, 間近, 分布)}\n<ul class="cards">\n${中身}\n</ul>`,
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
    : `<h2>Amazonについて</h2>
<p>現在、当サイトはAmazonアソシエイト・プログラムには参加していません。記事内の商品リンクは、Amazonの検索結果への通常のリンクです。参加した場合は、このページと各記事の冒頭で改めてお知らせします。</p>`

  // **提携が1件でもあれば、必ず広告表示を出す**（2026-08-31）。
  // A8.netでの提携が始まったので、「参加していません」と書き続けると事実と違います。
  const 提携文 = 提携先.length
    ? `<h2>アフィリエイトプログラムについて</h2>
<p>当サイトは、株式会社ファンコミュニケーションズが運営するアフィリエイト・サービス「A8.net」に参加しています。</p>
<p>記事の「申し込み先」に掲載しているリンクは広告です。リンクをたどってお申し込みいただいた場合、当サイトに紹介料が支払われることがあります。<strong>お客様のお支払い額が増えることはありません。</strong></p>
<p>掲載しているのは、当サイトが提携している窓口だけです。提携していない会社を、提携しているかのように書くことはしません。料金・条件は変わることがありますので、お申し込みの前に必ず各社の公式ページでご確認ください。</p>`
    : ''

  const body = `
<article>
<h1>広告と免責について</h1>
${提携文}
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
/* 図（数字を帯で見せる）。**画像ファイルは使わずSVGを直接書く。**
   写真を足すと表示が遅くなり、Core Web Vitals が落ちて検索に不利になるため。
   色はすべて上の変数なので、ダークモードでもそのまま合う。 */
.fig{margin:1.4rem 0;padding:1rem 1.1rem .9rem;border:1px solid var(--line);border-radius:8px;background:var(--card)}
.fig svg{display:block;width:100%;height:auto}
.fig figcaption{color:var(--sub);font-size:.78rem;margin:.55rem 0 0;line-height:1.7}
/* 帯は左から伸びる。**動きを控える設定の人には出さない**（検索から来た人は答えを探しに来ている） */
.fig .bar{transform-box:fill-box;transform-origin:left center;animation:figgrow .85s cubic-bezier(.2,.7,.3,1) both}
@keyframes figgrow{from{transform:scaleX(0)}to{transform:scaleX(1)}}
@media (prefers-reduced-motion:reduce){.fig .bar{animation:none}}
/* 締切がいちばん近いもの。**件数より、名前のほうが自分ごとになる。** */
.soon-h{font-size:.95rem;margin:1.6rem 0 .4rem;border:0;padding:0}
.soon{list-style:none;padding:0;margin:0}
.soon li{display:flex;gap:.7rem;align-items:baseline;flex-wrap:wrap;padding:.6rem 0;border-bottom:1px solid var(--line);font-size:.92rem}
.soon li:last-child{border-bottom:0}
.soon .d{flex:none;min-width:5.2em;font-weight:700;color:var(--accent);font-variant-numeric:tabular-nums}
.soon a{flex:1 1 14em;color:var(--ink)}
.soon .pl{flex:none;color:var(--sub);font-size:.8rem;max-width:9em;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}

/* ── 補助金のページ ───────────────────────────────────────── */
.crumb{font-size:.84rem;color:var(--sub);margin:1.4rem 0 0}
.note{font-size:.86rem;color:var(--sub)}
.spec{width:100%;border-collapse:collapse;margin:1rem 0;font-size:.92rem}
.spec th,.spec td{border:1px solid var(--line);padding:.55rem .7rem;text-align:left;vertical-align:top}
.spec th{background:var(--card);color:var(--sub);font-weight:600;width:11rem}
/* **狭い画面では、見出しと中身を上下に積む。**
   390pxで2列のまま出すと、見出しの幅が縮んで「実施機関」が
   実／施／機／関 と1文字ずつ縦に割れる（日本語は語の途中でも改行されるため）。
   幅を auto にするだけでは直らない。列をやめて積むのが確実。 */
@media (max-width:560px){
  .spec{font-size:.88rem}
  .spec:not(.list),.spec:not(.list) tbody,.spec:not(.list) tr,.spec:not(.list) th,.spec:not(.list) td{display:block;width:auto}
  .spec:not(.list) tr{border:1px solid var(--line);border-radius:8px;margin:.6rem 0;padding:.5rem .8rem;background:var(--card)}
  .spec:not(.list) th{border:0;padding:0;font-size:.78rem;white-space:nowrap;background:none}
  .spec:not(.list) td{border:0;padding:.1rem 0 .1rem;background:var(--bg)}
}
.spec.list th{width:auto}
.spec.list td:first-child{white-space:nowrap;width:6.5rem}
/* **3列の表は、狭い画面ではカードにする。**390pxで3列のまま出すと
   制度名が1文字ずつ折れて読めなくなる。横スクロールには逃がさない */
@media (max-width:560px){
  .spec.list,.spec.list tbody,.spec.list tr,.spec.list td{display:block;width:auto}
  .spec.list tr:first-child{display:none}
  .spec.list tr{border:1px solid var(--line);border-radius:8px;margin:.7rem 0;padding:.6rem .8rem;background:var(--card)}
  .spec.list td{border:0;padding:.15rem 0}
  .spec.list td:first-child{white-space:normal;width:auto;color:var(--sub);font-size:.84rem}
  /* 改行をやめる代わりに中黒で区切る。「2026-09-07あと7日」と続けて読ませない */
  .spec.list td:first-child br{display:none}
  .spec.list td:first-child .small::before{content:"・"}
  .spec.list td:nth-child(2){font-size:.95rem;margin:.2rem 0}
  .spec.list td:last-child{color:var(--sub);font-size:.84rem}
}
.closed{background:var(--card);border:1px solid var(--line);border-left:3px solid var(--sub);padding:.8rem 1rem;margin:1.2rem 0;font-size:.92rem}
.urgent{background:var(--card);border:1px solid var(--line);border-left:3px solid #c0392b;padding:.8rem 1rem;margin:1.2rem 0;font-size:.95rem}
.ok{background:var(--card);border:1px solid var(--line);border-left:3px solid var(--accent);padding:.8rem 1rem;margin:1.2rem 0;font-size:.95rem}
blockquote{margin:1rem 0;padding:.2rem 0 .2rem 1rem;border-left:3px solid var(--line);color:var(--sub)}
blockquote p{margin:0}
.lead-in{border:1px solid var(--line);border-radius:8px;background:var(--card);padding:1rem 1.2rem;margin:1.8rem 0 0}
.lead-in h2{border:0;padding-top:0;margin:0 0 .4rem;font-size:1.1rem}
.lead-in h2 a{text-decoration:none}
.lead-in p{margin:0;font-size:.9rem}
.lead-in-mini{background:var(--card);border:1px solid var(--line);border-left:3px solid var(--accent);border-radius:6px;padding:.7rem .9rem;font-size:.95rem}
.lead-in-mini a{text-decoration:none}

/* ── 探す道具 ─────────────────────────────────────────────── */
.pick{display:flex;flex-wrap:wrap;gap:.8rem;margin:1.6rem 0}
.pick label{display:flex;flex-direction:column;gap:.25rem;font-size:.82rem;color:var(--sub);flex:1 1 10rem;min-width:0}
/* **入力欄は16px以上。**これより小さいとiPhoneが勝手に画面を拡大する */
.pick select{font-size:16px;padding:.5rem .6rem;border:1px solid var(--line);border-radius:6px;background:var(--bg);color:var(--ink);width:100%}
.hit{border:1px solid var(--line);border-radius:8px;padding:.8rem 1rem;margin:.8rem 0;background:var(--card)}
.hit.soon{border-left:3px solid #c0392b}
.hit h2{border:0;padding-top:0;margin:.2rem 0 .4rem;font-size:1.05rem}
.hit h2 a{color:var(--ink);text-decoration:none}
.hit h2 a:hover{color:var(--accent)}
.hit .date{color:var(--sub);font-size:.82rem;margin:0}
.hit .price{margin:.3rem 0 0;font-size:.85rem}
.hit .tags{margin:.3rem 0}
`

// ── 書き出し ──────────────────────────────────────────────────────
//
// **消してはいけないファイルを、消す前に手元に退避する。**
//
// docs/ は毎回まるごと作り直す（差分で足すと、設定を変えたときに古い記事だけ
// 古いまま残るため）。だが次の2つは、こちらが作るものではないのに
// **消えると外の仕組みが壊れる。**
//
//   ・google〇〇.html … Google Search Console の所有確認ファイル。
//     Googleは「確認後も削除しないでください」と明記している。消すと確認が外れ、
//     検索順位のデータも sitemap の送信も止まる
//   ・〇〇.txt（IndexNowの鍵）… 消えると検証が通らず、通知が403で弾かれる
//
// **2026-08-31、実際にこれで消える寸前だった。**気づかず週次が走っていたら、
// Googleの確認が外れたことに誰も気づけない（画面には何も出ない）。
const 守るファイル = []
if (existsSync(公開先)) {
  for (const f of readdirSync(公開先)) {
    // Googleの所有確認ファイル と IndexNowの鍵（32桁の英数字.txt）
    if (/^google[0-9a-f]+\.html$/i.test(f) || /^[0-9a-f]{16,64}\.txt$/i.test(f)) {
      守るファイル.push({ 名前: f, 中身: readFileSync(join(公開先, f)) })
    }
  }
}

rmSync(公開先, { recursive: true, force: true })
mkdirSync(join(公開先, 'kiji'), { recursive: true })

for (const f of 守るファイル) {
  writeFileSync(join(公開先, f.名前), f.中身)
  console.log(`残しました：${f.名前}（消すと外の仕組みが壊れるため）`)
}

writeFileSync(join(公開先, '.nojekyll'), '', 'utf8')
writeFileSync(join(公開先, 'style.css'), CSS, 'utf8')
writeFileSync(join(公開先, 'disclosure.html'), 開示ページ(), 'utf8')
for (const k of 記事一覧) writeFileSync(join(公開先, 'kiji', `${k.slug}.html`), 記事ページ(k), 'utf8')

// ── 補助金のページ（ロングテール集客の本体）────────────────────
// 記事より先に作る。トップの案内に「受付中◯件」と出すのに件数が要るため。
const 今日 = new Date(Date.now() + 9 * 60 * 60 * 1000).toISOString().slice(0, 10)
const 補助金 = 補助金ページ一式を作る({ 作業場, 公開先, ページ, e, 提携先, 公開URL, 今日 })

writeFileSync(join(公開先, 'index.html'), 一覧ページ(補助金.受付中 ?? 0, 補助金.間近 ?? [], 補助金.分布 ?? []), 'utf8')

// サイトマップとrobots（公開URLが分かっているときだけ）
if (公開URL) {
  const url = (loc, d) => `  <url><loc>${e(loc)}</loc>${d ? `<lastmod>${e(d)}</lastmod>` : ''}</url>`
  const 中身 = [
    url(`${公開URL}/`),
    url(`${公開URL}/disclosure.html`),
    ...記事一覧.map(k => url(`${公開URL}/kiji/${k.slug}.html`, k.published)),
    // **受付が終わったものはここに入れない。**古い情報で人を呼ばない
    ...(補助金.サイトマップ ?? []).map(loc => url(loc, 今日)),
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
