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
import { OGP画像を出す } from './OGP画像を作る.mjs'
import { SNSの1枚を出す } from './SNSの1枚を作る.mjs'

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
/**
 * ⚠ **2026-09-07、ここは一度も表示されていませんでした。**
 * 条件が `type !== '補助金'` でしたが、補助金のページは `type: '記事'` か type なしで
 * 作られています。**どのページにも当てはまらず、書いた日からずっと空文字を返していた。**
 * ビルドは通り、画面も壊れず、エラーも出ないので、誰にも気づけない壊れ方でした。
 * **「置いた」と「出ている」は別物です。**置いたら、実際に出ているかを数えること。
 * いまは呼ぶ側が `案内を出す: true` と明示します（type に頼らない）。
 */
function 月額のご案内(案内を出す) {
  const url = (設定['noteマガジンURL'] ?? '').trim()
  if (!url || !案内を出す) return ''
  return `
<aside class="offer">
  <p class="offer-lead">締切を見逃さないために</p>
  <p>受付中の補助金を<strong>毎月まとめて</strong>お届けしています。締切の近い順に並べ、公式ページへの直リンク付き。</p>
  <p><a class="offer-btn" href="${e(url)}" target="_blank" rel="noopener">月額の購読を見る</a></p>
  <p class="small">出典はデジタル庁「Jグランツ」の公開データです。まず無料の号をご覧いただけます。</p>
</aside>`
}

/**
 * 無料の「締切アラート」登録口（名簿を作る階）
 * ---------------------------------------------------------------------------
 * **これが計画の①です。**アフィリエイトは単発報酬で積み上がりません。
 * 積み上がるのは名簿だけです。補助金を見に来た方は「締切を見逃したくない」と
 * 思って来ているので、**その場が唯一いちばん自然な登録口**になります。
 *
 * ⚠ **登録先が設定に無ければ、ページも案内も出しません。**
 * 「準備中」のフォームほど信用を落とすものはない（月額のご案内と同じ考え方）。
 *
 * 設定.json：
 *   "締切アラート_GoogleフォームURL": "https://docs.google.com/forms/d/e/.../viewform"
 *       … いちばん良い形。ページの中に埋め込みます（登録者は名簿として残ります）
 *   "締切アラート_受付メール": "you@example.com"
 *       … フォームが無いときの控え。メールソフトが開くだけなので取りこぼしますが、
 *         **アカウントを1つも作らずに今日から動きます。**
 * 両方あるときはフォームを使います。
 */
const アラート登録先 = () => {
  const form = (設定['締切アラート_GoogleフォームURL'] ?? '').trim()
  if (form) return { 種類: 'フォーム', url: form }
  const mail = (設定['締切アラート_受付メール'] ?? '').trim()
  if (mail) return { 種類: 'メール', url: mail }
  return null
}

/** Googleフォームは ?embedded=true を付けると枠だけになる（公式の作法） */
const 埋め込みURL = u => u + (u.includes('?') ? '&' : '?') + 'embedded=true'

const メールの下書き = mail => {
  const 件名 = '締切アラートの登録'
  const 本文 = [
    '「オフィスの選びかた」の締切アラートに登録します。',
    '',
    '会社名：',
    '都道府県：',
    '従業員数：',
    '興味のある使いみち（設備投資 / IT導入 / 販路拡大 / 人材・研修 / 省エネ など）：',
    '',
    '※このまま送信していただければ登録します。',
  ].join('\n')
  return `mailto:${mail}?subject=${encodeURIComponent(件名)}&body=${encodeURIComponent(本文)}`
}

/** 補助金のページの下に出す、無料アラートへの短い案内 */
function 無料アラートのご案内(案内を出す) {
  const 先 = アラート登録先()
  if (!先 || !案内を出す) return ''
  return `
<aside class="offer">
  <p class="offer-lead">締切を見逃さないために（無料）</p>
  <p>お住まいの都道府県と会社の規模を教えていただければ、<strong>使えそうな補助金の締切が近づいたときだけ</strong>お知らせします。毎朝データを取り直しているので、締切の変更もそのまま反映されます。</p>
  <p><a class="offer-btn" href="{{ROOT}}alert/index.html">無料の締切アラートに登録する</a></p>
  <p class="small">費用はかかりません。配信は止められます。お名前と会社名は必須ではありません。</p>
</aside>`
}

/** 登録口そのもののページ */
function アラート登録ページ(受付中) {
  const 先 = アラート登録先()
  if (!先) return null

  const 入口 =
    先.種類 === 'フォーム'
      ? `<div class="formwrap">
  <iframe src="${e(埋め込みURL(先.url))}" width="100%" height="760" frameborder="0" marginheight="0" marginwidth="0" title="締切アラートの登録フォーム">読み込んでいます…</iframe>
</div>
<p class="small">フォームが表示されない場合は <a href="${e(先.url)}" target="_blank" rel="noopener">こちらから直接ご登録</a>いただけます。</p>`
      : `<p><a class="offer-btn" href="${e(メールの下書き(先.url))}">メールで登録する</a></p>
<p class="small">ボタンを押すと、メールソフトが下書きを開きます。<strong>中身を埋めて送信していただくだけ</strong>で登録は完了です。こちらから確認のご返信をお送りします。</p>`

  const body = `
<article>
<h1>補助金の締切アラート（無料）</h1>

<p class="lede">受付中の補助金は、いま <strong>${受付中}件</strong>あります。そのうち<strong>締切に間に合うもの</strong>は、会社の場所と規模によって変わります。ご登録いただければ、<strong>あてはまるものの締切が近づいたときだけ</strong>お知らせします。</p>

<h2>お送りするもの</h2>
<ul>
  <li><strong>締切の近づいたお知らせ</strong>— 対象になりそうなものだけ。締切の30日前と7日前</li>
  <li><strong>今月の補助金レポート</strong>— 受付中のものを締切順に並べた一覧（毎月1回）</li>
  <li><strong>新しく出た制度のお知らせ</strong>— その月に受付が始まったもの</li>
</ul>

<h2>お送りしないもの</h2>
<ul>
  <li>営業のご連絡、他社へのお客様情報の提供は<strong>いたしません</strong></li>
  <li>申請の代行は行いません（有償の申請代行は行政書士の業務です）。お出しするのは<strong>締切と条件の情報まで</strong>です</li>
</ul>

<h2>情報の出どころ</h2>
<p>デジタル庁「Jグランツ」の公開API（公的な一次情報）です。まとめサイトの写しではありません。<strong>毎朝取り直しています。</strong>制度の中身はこちらで言い換えていませんので、申請の前には必ず各制度の公式ページをご確認ください。</p>

<h2>ご登録</h2>
${入口}

<p class="small">配信の停止はいつでもできます。いただいた情報は、補助金のお知らせをお送りする目的にのみ使います。</p>
</article>
`
  return ページ({
    title: `補助金の締切アラート（無料）｜${サイト名}`,
    description: `受付中${受付中}件の補助金から、お使いになれそうなものの締切が近づいたときだけお知らせします。デジタル庁の公開データを毎朝取り直しています。登録は無料です。`,
    body,
    root: '../',
    canonical: 公開URL ? `${公開URL}/alert/` : '',
  })
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

/**
 * og画像：'ogp/xxx.png'（docs からの相対）。無ければ og:image を出さない。
 * ⚠ 2026-09-13 まで og:image が1枚も無く、X・note・LINE に流れても絵が出なかった（常務のご指摘）。
 */
function ページ({ title, description, body, root, canonical, type, published, faq, 案内を出す, og画像 }) {
  const og画像URL = og画像 && 公開URL ? `${公開URL}/${og画像}` : ''
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
${og画像URL ? `<meta property="og:image" content="${e(og画像URL)}">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:image" content="${e(og画像URL)}">` : `<meta name="twitter:card" content="summary">`}
${構造化データ({ type, title, description, canonical, published, faq })}
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Anton&family=Zen+Kaku+Gothic+New:wght@400;500;700&display=swap">
<link rel="stylesheet" href="${root}style.css">
${アクセス解析()}
</head>
<body>
<header class="head">
  <div class="head-in">
    <a class="brand" href="${root}index.html"><span class="brand-en">OFFICE CHOICE</span><span class="brand-ja">${e(サイト名)}</span></a>
    <nav class="nav" aria-label="サイト内">
      <a href="${root}hojo/index.html">補助金の締切</a>
      <a href="${root}hojo/checker.html">探す</a>
      <a href="${root}index.html#kiji">記事</a>
      <a class="nav-cta" href="${root}alert/index.html">無料アラート</a>
    </nav>
  </div>
</header>
<main class="${type === '記事' ? 'main-read' : 'main-wide'}">
${body}
${無料アラートのご案内(案内を出す).replaceAll('{{ROOT}}', root)}
${月額のご案内(案内を出す)}
</main>
${下の帯.replaceAll('{{ROOT}}', root)}
</body>
</html>
`
}

/* ── 要約カード（2026-09-13）────────────────────────────────
   常務のご指摘「文字を読みたくない。画像・動画で理解したい」。
   本文の前に、数字3つ（読む時間・確かめる点・候補の数）と、見出しの先頭3つを「先に結論」として置く。
   見出しは1文の主張として書かれているので、そのまま結論になる。AIに要約を書かせない（¥0・毎回同じ）。 */
function 要約カード(k) {
  const 字数 = k.sections.reduce((n, x) => n + String(x.body ?? '').length, 0) + String(k.lead ?? '').length
  const 分 = Math.max(1, Math.round(字数 / 600))
  const 結論 = k.sections.slice(0, 3).map((x, i) => `<li><a href="#s${i + 1}">${e(x.heading)}</a></li>`).join('')
  const 候補 = (k.products ?? []).length
  return `<aside class="tldr" aria-label="先に結論">
  <div class="tldr-nums">
    <div><span class="v">${分}</span><span class="u">分で読める</span></div>
    <div><span class="v">${k.sections.length}</span><span class="u">つの確かめる点</span></div>
    ${候補 ? `<div><span class="v">${候補}</span><span class="u">件の候補</span></div>` : ''}
  </div>
  <p class="tldr-title">先に結論</p>
  <ol>${結論}</ol>
</aside>`
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

  ${要約カード(k)}
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
    og画像: OGP画像を出す({ 出し先: 公開先, 名前: `kiji-${k.slug}`, 小見出し: サイト名, 題: k.title, 帯: 設定.サイトの説明 }),
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
  const 三十日 = 分布.find(x => x.名 === '30日以内')?.件数 ?? 0
  const 分布の図 = 分布.length
    ? `<figure class="fig">
      <svg viewBox="0 0 600 ${40 + 分布.length * 34}" role="img" aria-label="締切までの残り日数ごとの件数。${分布.map(x => `${x.名}が${x.件数}件`).join('、')}。">
        <text x="0" y="16" font-size="12.5" fill="var(--ink-3)">締切までの残り日数（受付中 ${受付中}件）</text>
${分布.map((x, i) => {
  const y = 34 + i * 34
  const w = Math.max(2, Math.round(430 * (x.件数 / 最大)))
  return `        <text x="0" y="${y + 15}" font-size="13" fill="var(--ink-3)">${e(x.名)}</text>
        <rect x="112" y="${y + 3}" width="430" height="16" rx="3" fill="var(--rule-2)"></rect>
        <rect class="bar" x="112" y="${y + 3}" width="${w}" height="16" rx="3" fill="${i === 0 ? 'var(--ac)' : 'var(--br-700)'}"></rect>
        <text x="600" y="${y + 15}" text-anchor="end" font-size="13" font-weight="700" fill="var(--ink)">${x.件数}件</text>`
}).join('')}
      </svg>
      <figcaption>デジタル庁「Jグランツ」の公開データから、中小企業が使えるものだけを抜き出して数えています。毎朝取り直しています。</figcaption>
    </figure>`
    : ''
  /* 締切がいちばん近い5件。**件数より、名前のほうが自分ごとになる。**
     日数を主役に、単位は小さく添える（数字が主役の版面）。 */
  const 間近の表 = 間近.length
    ? `<ol class="soon">
${間近.map(k => `      <li class="soon-card${k.日数 <= 7 ? ' hot' : ''}"><a href="${e(k.先)}"><span class="days"><small>あと</small><b>${k.日数}</b><small>日</small></span><span class="name">${e(k.名称)}</span><span class="pl">${e(k.地域 || '全国')}</span></a></li>`).join('\n')}
    </ol>`
    : ''
  /* 2026-09-13 常務「見た目は今のままでいいのか？」→ 数字と絵で先に伝える形に作り替えた。
     文字で説明する前に、件数と日数を大きく見せる。 */
  return `<section class="hero">
  <p class="eyebrow">SUBSIDY DEADLINES ／ 毎朝6時に更新</p>
  <h1>いま受付中の補助金を、<br>締切の近い順に。</h1>
  <p class="hero-sub">デジタル庁「Jグランツ」の公開データから、中小企業の設備投資・IT導入・販路拡大・職場環境の改善に使えるものだけを抜き出しています。1件ずつのページに、<strong>自己負担の目安</strong>と<strong>締切から逆算した段取り</strong>を置いています。</p>
  <div class="stats">
    <a class="stat" href="hojo/index.html"><span class="n">${受付中}</span><span class="u">件</span><span class="l">いま受付中</span></a>
    <a class="stat hot" href="hojo/index.html"><span class="n">${三十日}</span><span class="u">件</span><span class="l">30日以内に締切</span></a>
    <a class="stat" href="#kiji"><span class="n">${記事一覧.length}</span><span class="u">本</span><span class="l">決裁の目線で書いた記事</span></a>
  </div>
  <p class="hero-cta"><a class="btn-primary" href="hojo/checker.html">都道府県とやりたいことから探す</a><a class="btn-ghost" href="hojo/index.html">${受付中}件をすべて見る</a></p>
</section>
<section class="band">
  <div class="band-in">
    <p class="eyebrow">CLOSING SOON</p>
    <h2 class="sec-h">締切がいちばん近いもの</h2>
    ${間近の表}
    ${分布の図}
  </div>
</section>`
}

function 一覧ページ(補助金の受付中, 間近, 分布) {
  const 中身 = 記事一覧.length
    ? 記事一覧
        .map(
          k => `<li class="card">
  <a class="card-a" href="kiji/${e(k.slug)}.html">
    <p class="date">${e(k.published)}</p>
    <h3>${e(k.title)}</h3>
    <p class="desc">${e(k.description)}</p>
    <p class="tags">${k.tags.map(t => `<span class="tag">${e(t)}</span>`).join('')}</p>
  </a>
</li>`
        )
        .join('\n')
    : '<li class="card"><p>まだ記事がありません。毎週月曜の朝に1本ずつ増えます。</p></li>'

  return ページ({
    title: `${サイト名}｜${設定.サイトの説明}`,
    description: 設定.サイトの説明,
    body: `<h1 class="sr">記事の一覧</h1>\n${補助金への案内(補助金の受付中, 間近, 分布)}\n<section class="kiji" id="kiji"><p class="eyebrow">ARTICLES</p><h2 class="sec-h">契約と買いものを、決裁した側の目線で</h2><ul class="cards">\n${中身}\n</ul></section>`,
    root: './',
    canonical: 公開URL ? `${公開URL}/` : '',
    案内を出す: true,
    og画像: OGP画像を出す({
      出し先: 公開先, 名前: 'top', 小見出し: サイト名, 題: '中小企業の総務が決裁する「契約」と「買いもの」を、決裁した側の目線で選ぶ',
      数字: [{ ラベル: '受付中の補助金', 値: String(補助金の受付中), 単位: '件' }, { ラベル: '更新', 値: '毎朝', 単位: '自動' }, { ラベル: '記事', 値: String(記事一覧.length), 単位: '本' }],
      帯: '補助金の締切・上限額・自己負担の目安を、公開データから毎朝計算しています',
    }),
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
const CSS = `/* ── 見た目の型（2026-09-13 作り替え）───────────────────────────
   常務「サイトの作り、見た目は今のままでいいのか？」→ 数字と絵で先に伝える形へ。
   決まりは 00_ClaudeCode/00_context/見た目の型.md と同じ：
   ①色は役割で持つ（主色4段＋差し色1＋紙3枚＋文字3段＋罫2段）
   ②面で章を分ける。濃い面は1画面に1つ（ヘッダーだけ）
   ③字は2種類（見出し・本文＝Zen Kaku Gothic New／数字＝Anton）。数字は大きく、単位は小さく添える
   ④余白4段・角丸1つ・影3段
   ⚠ 色そのものは参考サイトから写していない。このサイトの緑を主色に置いた。 */
:root{
  --br-900:#0d2f28;--br-800:#124a3f;--br-700:#0b6b5b;--br-600:#178a76;--br-100:#d5ebe4;--br-050:#eef7f3;
  --ac:#b7791f;--ac-l:#f3dfb4;
  --paper:#f6f4ee;--paper-2:#ffffff;--paper-3:#ece8df;
  --ink:#17201d;--ink-2:#3d4a45;--ink-3:#6b7672;
  --rule:#d5d0c5;--rule-2:#e6e2d9;
  --s1:6px;--s2:10px;--s3:16px;--s4:26px;--r:14px;
  --sh-0:0 1px 2px rgba(0,0,0,.06);
  --sh-1:0 1px 2px rgba(0,0,0,.06),0 3px 8px rgba(0,0,0,.06),0 10px 22px rgba(0,0,0,.06);
  --sh-2:0 1px 2px rgba(0,0,0,.07),0 6px 14px rgba(0,0,0,.09),0 20px 44px rgba(0,0,0,.11);
  --ease:cubic-bezier(.2,.7,.3,1);
  /* 古いクラスが参照している名前。役割の変数へ寄せる */
  --sub:var(--ink-3);--line:var(--rule-2);--bg:var(--paper-2);--accent:var(--br-700);--card:var(--paper);
}
@media (prefers-color-scheme:dark){:root{
  --br-900:#06201b;--br-800:#0d3a31;--br-700:#3fbca0;--br-600:#5cd1b7;--br-100:#123f35;--br-050:#0f2b25;
  --ac:#e2b464;--ac-l:#4a3610;
  --paper:#131816;--paper-2:#0e1211;--paper-3:#1b2320;
  --ink:#e9ecea;--ink-2:#b9c2be;--ink-3:#8b9591;
  --rule:#2c3733;--rule-2:#232c29;
}}
*{box-sizing:border-box}
html{scroll-behavior:smooth}
body{margin:0;background:var(--paper-2);color:var(--ink);font-family:"Zen Kaku Gothic New",-apple-system,BlinkMacSystemFont,"Hiragino Kaku Gothic ProN","Yu Gothic",Meiryo,sans-serif;line-height:1.85;font-size:17px;-webkit-text-size-adjust:100%}
a{color:var(--br-700)}
.sr{position:absolute;left:-9999px}
.small{font-size:.78rem}
.eyebrow{font-family:Anton,"Zen Kaku Gothic New",sans-serif;font-weight:400;font-size:.78rem;letter-spacing:.14em;color:var(--br-700);margin:0 0 var(--s1);text-transform:uppercase}
.sec-h{font-size:clamp(1.25rem,2.4vw,1.7rem);line-height:1.4;margin:0 0 var(--s3);padding:0;border:0;letter-spacing:.01em}

/* ── ヘッダー（濃い面はここだけ）────────────────────────────── */
.head{background:var(--br-900);color:#fff}
.head-in{max-width:64rem;margin:0 auto;padding:var(--s3) 1.2rem;display:flex;align-items:center;justify-content:space-between;gap:var(--s3);flex-wrap:wrap}
.brand{display:flex;flex-direction:column;text-decoration:none;color:#fff;line-height:1.2}
.brand-en{font-family:Anton,sans-serif;font-size:.7rem;letter-spacing:.2em;color:var(--ac-l);opacity:.9}
.brand-ja{font-size:1.2rem;font-weight:700;letter-spacing:.03em}
.nav{display:flex;gap:var(--s1) var(--s3);flex-wrap:wrap;align-items:center;font-size:.9rem}
.nav a{color:#fff;text-decoration:none;opacity:.88;padding:.25rem 0;border-bottom:2px solid transparent;transition:border-color .18s var(--ease),opacity .18s var(--ease)}
.nav a:hover{opacity:1;border-bottom-color:var(--ac-l)}
.nav .nav-cta{background:var(--ac);color:#111;opacity:1;padding:.4rem .9rem;border-radius:999px;font-weight:700;border:0}
.nav .nav-cta:hover{background:var(--ac-l)}
@media (max-width:560px){.head-in{padding:var(--s2) 1rem}.brand-ja{font-size:1.05rem}.nav{font-size:.84rem;gap:var(--s1) var(--s2)}}

/* ── 本文の幅。読むページは狭く、並べるページは広く ───────── */
main{margin:0 auto;padding:0 1.2rem 4rem}
.main-read{max-width:44rem}
.main-wide{max-width:64rem}
h1{font-size:clamp(1.5rem,3vw,2.1rem);line-height:1.4;margin:2rem 0 .6rem;letter-spacing:.01em}
h2{font-size:clamp(1.15rem,2.1vw,1.5rem);line-height:1.45;margin:2.6rem 0 .8rem;padding-top:.6rem;border-top:3px solid var(--ink)}
h3{font-size:1.02rem;margin:1.6rem 0 .4rem}
p{margin:0 0 1.1rem}
ul,ol{padding-left:1.3rem}
li{margin:.3rem 0}
strong{color:var(--ink)}

/* ── トップ：数字が主役 ─────────────────────────────────── */
.hero{padding:clamp(1.6rem,4vw,3rem) 0 var(--s4)}
.hero h1{margin:.2rem 0 var(--s3);font-size:clamp(1.7rem,4.2vw,2.7rem);line-height:1.3}
.hero-sub{max-width:44rem;color:var(--ink-2);font-size:clamp(.95rem,1.3vw,1.04rem);margin-bottom:var(--s4)}
.stats{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:var(--s2);margin:0 0 var(--s4)}
.stat{display:grid;grid-template-columns:auto auto;grid-template-rows:auto auto;justify-content:start;align-items:baseline;column-gap:.35rem;background:var(--paper);border:1px solid var(--rule-2);border-radius:var(--r);padding:var(--s3) var(--s3) var(--s2);text-decoration:none;color:var(--ink);box-shadow:var(--sh-0);transition:transform .18s var(--ease),box-shadow .18s var(--ease)}
a.stat:hover{transform:translateY(-2px);box-shadow:var(--sh-1)}
.stat .n{font-family:Anton,sans-serif;font-size:clamp(2.4rem,6vw,4rem);line-height:1;letter-spacing:.01em;color:var(--br-800);font-variant-numeric:tabular-nums}
.stat .u{font-size:.95rem;color:var(--ink-3);align-self:end;padding-bottom:.3rem}
.stat .l{grid-column:1/3;font-size:.84rem;color:var(--ink-2);margin-top:.2rem;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.stat.hot{border-color:var(--ac);background:var(--paper-2)}
.stat.hot .n{color:var(--ac)}
@media (max-width:560px){.stats{grid-template-columns:1fr 1fr}.stat:last-child{grid-column:1/3}.stat .n{font-size:2.6rem}}
.hero-cta{display:flex;gap:var(--s2);flex-wrap:wrap;margin:0}
.btn-primary,.btn-ghost{display:inline-block;text-decoration:none;padding:.7rem 1.3rem;border-radius:999px;font-weight:700;font-size:.95rem;transition:transform .18s var(--ease),background .18s var(--ease)}
.btn-primary{background:var(--br-700);color:#fff;box-shadow:var(--sh-1)}
.btn-primary:hover{background:var(--br-600);transform:translateY(-1px)}
.btn-ghost{border:1.5px solid var(--rule);color:var(--ink-2)}
.btn-ghost:hover{border-color:var(--ink-2);color:var(--ink)}

/* 面で章を分ける：締切の近いもの＝生成りの全幅 */
.band{background:var(--paper);margin:0 -1.2rem;padding:var(--s4) 1.2rem}
.band-in{max-width:64rem;margin:0 auto}
.soon{list-style:none;padding:0;margin:0 0 var(--s4);display:grid;grid-template-columns:repeat(auto-fill,minmax(17rem,1fr));gap:var(--s2)}
.soon-card a{display:grid;grid-template-columns:auto minmax(0,1fr);grid-template-rows:auto auto;column-gap:var(--s3);align-items:center;background:var(--paper-2);border:1px solid var(--rule-2);border-radius:var(--r);padding:var(--s2) var(--s3);text-decoration:none;color:var(--ink);box-shadow:var(--sh-0);transition:transform .18s var(--ease),box-shadow .18s var(--ease);height:100%}
.soon-card a:hover{transform:translateY(-2px);box-shadow:var(--sh-1)}
.soon-card .days{grid-row:1/3;display:flex;align-items:baseline;gap:.15rem;color:var(--br-800);min-width:4.6rem}
.soon-card .days b{font-family:Anton,sans-serif;font-weight:400;font-size:2.4rem;line-height:1;font-variant-numeric:tabular-nums}
.soon-card .days small{font-size:.72rem;color:var(--ink-3)}
.soon-card .name{font-size:.94rem;font-weight:500;line-height:1.5;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}
.soon-card .pl{font-size:.78rem;color:var(--ink-3);margin-top:.15rem}
.soon-card.hot .days{color:var(--ac)}
.soon-card.hot a{border-color:var(--ac)}

/* 図（数字を帯で見せる）。画像ファイルは使わずSVGを直接書く */
.fig{margin:0;padding:var(--s3) var(--s3) var(--s2);border:1px solid var(--rule-2);border-radius:var(--r);background:var(--paper-2)}
.fig svg{display:block;width:100%;height:auto}
.fig figcaption{color:var(--ink-3);font-size:.78rem;margin:.55rem 0 0;line-height:1.7}
.fig .bar{transform-box:fill-box;transform-origin:left center;animation:figgrow .85s var(--ease) both}
@keyframes figgrow{from{transform:scaleX(0)}to{transform:scaleX(1)}}
@media (prefers-reduced-motion:reduce){.fig .bar{animation:none}.stat,.soon-card a,.card-a{transition:none}}

/* 記事は並べる */
.kiji{padding-top:var(--s4)}
.cards{list-style:none;padding:0;margin:0;display:grid;grid-template-columns:repeat(auto-fill,minmax(19rem,1fr));gap:var(--s3)}
.card{margin:0}
.card-a{display:flex;flex-direction:column;height:100%;background:var(--paper-2);border:1px solid var(--rule-2);border-radius:var(--r);padding:var(--s3) var(--s3) var(--s2);text-decoration:none;color:var(--ink);box-shadow:var(--sh-0);transition:transform .18s var(--ease),box-shadow .18s var(--ease)}
.card-a:hover{transform:translateY(-2px);box-shadow:var(--sh-1)}
.card h3{margin:.2rem 0 .5rem;font-size:1.06rem;line-height:1.5}
.card .desc{font-size:.88rem;color:var(--ink-2);margin:0 0 var(--s2);display:-webkit-box;-webkit-line-clamp:3;-webkit-box-orient:vertical;overflow:hidden}
.card .tags{margin:auto 0 0}
.date{color:var(--ink-3);font-size:.78rem;margin:0}
.tag{display:inline-block;background:var(--br-050);border:1px solid var(--br-100);border-radius:999px;padding:.05rem .6rem;margin:0 .3rem .3rem 0;font-size:.74rem;color:var(--br-800)}

/* ── 記事ページ ─────────────────────────────────────────── */
.meta{color:var(--ink-3);font-size:.84rem;margin-bottom:1.2rem}
.ad-notice{background:var(--paper);border:1px solid var(--rule-2);border-left:3px solid var(--br-700);border-radius:var(--r);padding:.7rem .9rem;font-size:.84rem;color:var(--ink-3);margin-bottom:1.4rem}
.lead{font-size:1.05rem}
.tldr{border:1px solid var(--rule-2);border-radius:var(--r);padding:var(--s3) var(--s4);margin:1.6rem 0;background:var(--paper);box-shadow:var(--sh-0)}
.tldr-nums{display:flex;flex-wrap:wrap;gap:.6rem 1.8rem;margin-bottom:.8rem}
.tldr-nums div{display:flex;align-items:baseline;gap:.3rem;min-width:0}
.tldr-nums .v{font-family:Anton,sans-serif;font-size:2.2rem;line-height:1;color:var(--br-800);font-variant-numeric:tabular-nums}
.tldr-nums .u{font-size:.82rem;color:var(--ink-3);white-space:nowrap}
.tldr-title{margin:0 0 .3rem;font-family:Anton,sans-serif;font-size:.78rem;color:var(--br-700);letter-spacing:.14em}
.tldr ol{margin:0;padding-left:1.3rem;font-size:.98rem;line-height:1.7}
.tldr ol li{margin:.15rem 0}
.tldr ol a{color:var(--ink);text-decoration:none;font-weight:600}
.tldr ol a:hover{text-decoration:underline}
.toc{background:var(--paper);border:1px solid var(--rule-2);border-radius:var(--r);padding:1rem 1.2rem;margin:1.6rem 0}
.toc-title{font-size:.8rem;color:var(--ink-3);margin:0 0 .4rem;letter-spacing:.08em}
.toc ol{margin:0;padding-left:1.2rem}
.toc li{margin:.2rem 0}
.check li{margin:.5rem 0}
.item{border:1px solid var(--rule-2);border-radius:var(--r);padding:1rem 1.2rem;margin:1rem 0;background:var(--paper)}
.item h3{margin-top:0}
.price{color:var(--ink-3);font-size:.86rem;margin-bottom:.6rem}
.btn{display:inline-block;background:var(--br-700);color:#fff;text-decoration:none;padding:.55rem 1.1rem;border-radius:999px;font-size:.9rem;font-weight:700}
.qa h3{font-size:.98rem}
.back{margin-top:3rem;font-size:.9rem}
blockquote{margin:1rem 0;padding:.2rem 0 .2rem 1rem;border-left:3px solid var(--rule);color:var(--ink-3)}
blockquote p{margin:0}
.lead-in{border:1px solid var(--rule-2);border-radius:var(--r);background:var(--paper);padding:1rem 1.2rem;margin:1.8rem 0 0}
.lead-in h2{border:0;padding-top:0;margin:0 0 .4rem;font-size:1.1rem}
.lead-in h2 a{text-decoration:none}
.lead-in p{margin:0;font-size:.9rem}
.lead-in-mini{background:var(--paper);border:1px solid var(--rule-2);border-left:3px solid var(--br-700);border-radius:var(--r);padding:.7rem .9rem;font-size:.95rem}
.lead-in-mini a{text-decoration:none}

/* ── 補助金のページ ───────────────────────────────────────── */
.crumb{font-size:.84rem;color:var(--ink-3);margin:1.4rem 0 0}
.note{font-size:.86rem;color:var(--ink-3)}
.spec{width:100%;border-collapse:collapse;margin:1rem 0;font-size:.92rem}
.spec th,.spec td{border:1px solid var(--rule-2);padding:.55rem .7rem;text-align:left;vertical-align:top}
.spec th{background:var(--paper);color:var(--ink-3);font-weight:600;width:11rem}
/* 狭い画面では、見出しと中身を上下に積む（390pxで「実施機関」が1文字ずつ縦に割れるため） */
@media (max-width:560px){
  .spec{font-size:.88rem}
  .spec:not(.list),.spec:not(.list) tbody,.spec:not(.list) tr,.spec:not(.list) th,.spec:not(.list) td{display:block;width:auto}
  .spec:not(.list) tr{border:1px solid var(--rule-2);border-radius:var(--r);margin:.6rem 0;padding:.5rem .8rem;background:var(--paper)}
  .spec:not(.list) th{border:0;padding:0;font-size:.78rem;white-space:nowrap;background:none}
  .spec:not(.list) td{border:0;padding:.1rem 0 .1rem;background:transparent}
}
.spec.list th{width:auto}
.spec.list td:first-child{white-space:nowrap;width:6.5rem}
@media (max-width:560px){
  .spec.list,.spec.list tbody,.spec.list tr,.spec.list td{display:block;width:auto}
  .spec.list tr:first-child{display:none}
  .spec.list tr{border:1px solid var(--rule-2);border-radius:var(--r);margin:.7rem 0;padding:.6rem .8rem;background:var(--paper)}
  .spec.list td{border:0;padding:.15rem 0}
  .spec.list td:first-child{white-space:normal;width:auto;color:var(--ink-3);font-size:.84rem}
  .spec.list td:first-child br{display:none}
  .spec.list td:first-child .small::before{content:"・"}
  .spec.list td:nth-child(2){font-size:.95rem;margin:.2rem 0}
  .spec.list td:last-child{color:var(--ink-3);font-size:.84rem}
}
.closed{background:var(--paper);border:1px solid var(--rule-2);border-left:3px solid var(--ink-3);border-radius:var(--r);padding:.8rem 1rem;margin:1.2rem 0;font-size:.92rem}
.urgent{background:var(--paper-2);border:1px solid var(--ac);border-left:5px solid var(--ac);border-radius:var(--r);padding:.8rem 1rem;margin:1.2rem 0;font-size:1rem}
.ok{background:var(--paper);border:1px solid var(--rule-2);border-left:3px solid var(--br-700);border-radius:var(--r);padding:.8rem 1rem;margin:1.2rem 0;font-size:.95rem}

/* ── 探す道具 ─────────────────────────────────────────────── */
.pick{display:flex;flex-wrap:wrap;gap:.8rem;margin:1.6rem 0}
.pick label{display:flex;flex-direction:column;gap:.25rem;font-size:.82rem;color:var(--ink-3);flex:1 1 10rem;min-width:0}
/* 入力欄は16px以上。これより小さいとiPhoneが勝手に画面を拡大する */
.pick select{font-size:16px;padding:.6rem .7rem;border:1px solid var(--rule);border-radius:10px;background:var(--paper-2);color:var(--ink);width:100%}
.hit{border:1px solid var(--rule-2);border-radius:var(--r);padding:.8rem 1rem;margin:.8rem 0;background:var(--paper);box-shadow:var(--sh-0)}
.hit.soon{border-left:4px solid var(--ac);display:block}
.hit h2{border:0;padding-top:0;margin:.2rem 0 .4rem;font-size:1.05rem}
.hit h2 a{color:var(--ink);text-decoration:none}
.hit h2 a:hover{color:var(--br-700)}
.hit .date{color:var(--ink-3);font-size:.82rem;margin:0}
.hit .price{margin:.3rem 0 0;font-size:.85rem}
.hit .tags{margin:.3rem 0}

/* ── 締切アラートの登録口・ご案内 ─────────────────────────── */
.formwrap{border:1px solid var(--rule-2);border-radius:var(--r);overflow:hidden;margin:1rem 0;background:var(--paper-2)}
.formwrap iframe{display:block;width:100%;max-width:100%;border:0}
.lede{font-size:1.02rem;background:var(--paper);border-left:3px solid var(--br-700);border-radius:var(--r);padding:.8rem 1rem}
.offer{margin:3rem 0 0;padding:var(--s4);background:var(--br-050);border:1px solid var(--br-100);border-radius:var(--r)}
.offer-lead{font-family:Anton,"Zen Kaku Gothic New",sans-serif;font-size:.8rem;letter-spacing:.12em;color:var(--br-700);margin:0 0 .4rem}
.offer p{margin:0 0 .8rem;font-size:.95rem}
.offer .small{color:var(--ink-3);margin:0}
.offer-btn{display:inline-block;background:var(--br-700);color:#fff;text-decoration:none;padding:.7rem 1.3rem;border-radius:999px;font-weight:700;font-size:.95rem;box-shadow:var(--sh-1)}
.offer-btn:hover{background:var(--br-600)}

/* ── 下の帯 ─────────────────────────────────────────────── */
.foot{max-width:64rem;margin:0 auto;padding:1.6rem 1.2rem 3rem;border-top:3px solid var(--ink);color:var(--ink-3);font-size:.84rem}
.foot p{margin:.3rem 0}
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
    // ⚠ **CNAME（独自ドメインの札）も必ず残す**（2026-09-07 に追加）。
    //   これが消えると GitHub Pages の独自ドメイン設定が外れ、
    //   **soumu-choice.com が開かなくなります。**
    //   組み立ては毎朝走るので、忘れると翌朝サイトごと落ちます。
    //   買った当日に、実際に一度消えました。
    if (/^google[0-9a-f]+\.html$/i.test(f) || /^[0-9a-f]{16,64}\.txt$/i.test(f) || f === 'CNAME') {
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

// ── 無料の締切アラートの登録口 ──────────────────────────────────
// **登録先が設定に無ければ、ページごと作りません。**空のフォームを置かないため。
const アラート = アラート登録ページ(補助金.受付中 ?? 0)
if (アラート) {
  mkdirSync(join(公開先, 'alert'), { recursive: true })
  writeFileSync(join(公開先, 'alert', 'index.html'), アラート, 'utf8')
  console.log(`締切アラートの登録口：docs/alert/index.html（登録先＝${アラート登録先().種類}）`)
} else {
  console.log('締切アラートの登録口：設定.json に登録先が無いため作りませんでした')
}

// サイトマップとrobots（公開URLが分かっているときだけ）
if (公開URL) {
  const url = (loc, d) => `  <url><loc>${e(loc)}</loc>${d ? `<lastmod>${e(d)}</lastmod>` : ''}</url>`
  const 中身 = [
    url(`${公開URL}/`),
    url(`${公開URL}/disclosure.html`),
    ...(アラート ? [url(`${公開URL}/alert/`, 今日)] : []),
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

// ⚠ **必ず最後。**この1枚は docs/hojo を作ったあとの「掲載済み」を数えるので、
// 先に呼ぶと前日の件数で描いてしまう。別コマンドにすると、打ち忘れた日だけ
// 古い絵が投稿される（しかも絵は出るので、失敗として現れない）。
SNSの1枚を出す()

console.log(`組み立てました：記事 ${記事一覧.length} 本 → docs/`)
console.log(アフィリ有効 ? `Amazonタグ：${タグ}（有効）` : 'Amazonタグ：未設定（タグなしリンクで出力）')
