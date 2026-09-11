/* Xに知らせる（記事を出したら、自動で告知する）
 *
 * なぜ作ったか（2026-09-11 常務のご指示）
 *   「財布となる入口が少なすぎる！もっともっとやるべき！」
 *
 *   ⚠ **いま入口はGoogle検索1本で、そこが詰まっています。**
 *   Googleは新しいサイトを拾うのに数ヶ月かかります。**その間、待つしかない。**
 *   Xは**その日のうちに人が来る**唯一の入口です。
 *
 * ⚠ **宣伝文にしないこと。**
 *   「新記事を公開しました！ぜひご覧ください」は誰も読みません。
 *   **題名＋見出し3つ**を箇条書きで出します。見出しは記事の骨格なので、短くて具体的です。
 *   読んだ人が「それは知らなかった」と思ったときだけ、リンクが押されます。
 *
 * ⚠ **印（utm）を必ず付けること。**付けないと、Xから何人来たか分かりません。
 *   入口を増やしても測れなければ、どれが効いたか永久に分かりません。
 *
 * 鍵（常務にお願いする分）
 *   X の開発者ページで作る4つ。`.env` に置いてください。
 *     X_API_KEY / X_API_SECRET / X_ACCESS_TOKEN / X_ACCESS_SECRET
 *   ⚠ 無料枠は**書き込み 月500件**まで。1日1本なら月31件なので、十分に収まります。
 *
 * 使い方
 *   node tools/Xに知らせる.mjs            … まだ知らせていない記事を1本
 *   node tools/Xに知らせる.mjs --下書き   … 送らずに、文面だけ見る
 * 記録: データ/配った記録.jsonl（入口ごとの成績に効きます）
 */
import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'

const 下書きだけ = process.argv.includes('--下書き')
const サイト = 'https://soumu-choice.com'
const 印 = '?utm_source=x&utm_medium=social'
const 記事の場所 = 'docs/kiji'
const 済みの道 = 'データ/Xに知らせた.json'

/* ── まだ知らせていない記事を1本選ぶ ─────────────────── */
let 済み = []
try { 済み = JSON.parse(fs.readFileSync(済みの道, 'utf8')) } catch { /* はじめて */ }

const 記事たち = fs.readdirSync(記事の場所).filter(f => f.endsWith('.html'))
const まだ = 記事たち.filter(f => !済み.includes(f))
if (!まだ.length) {
  console.log('知らせていない記事はありません。')
  process.exit(0)
}
/* 新しいものから。古い記事を今さら流しても効きません */
まだ.sort((a, b) =>
  fs.statSync(path.join(記事の場所, b)).mtimeMs - fs.statSync(path.join(記事の場所, a)).mtimeMs)
const 選んだ = まだ[0]
const html = fs.readFileSync(path.join(記事の場所, 選んだ), 'utf8')
const 題 = (html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/) || [])[1]?.replace(/<[^>]+>/g, '').trim() ?? ''

/* ⚠ **本文から1文を抜くのはやめました**（2026-09-11）。
   最初そうしたら「1ID月額が数百円でも、年間では無視できない額になります。」が選ばれた。
   **当たり前のことで、誰も押しません。**しかも文の途中から切れていた。

   **見出し（h2）を使います。**見出しは記事の骨格なので、短くて具体的です。
   題名＋見出し3つを箇条書きにすると、
   **「それは知らなかった」が起きたときだけ**リンクが押される形になります。 */
function 見出しを拾う(html) {
  const 本体 = (html.match(/<article[\s\S]*?<\/article>/) || html.match(/<main[\s\S]*?<\/main>/) || [html])[0]
  const 出 = []
  const re = /<h2[^>]*>([\s\S]*?)<\/h2>/g
  let m
  while ((m = re.exec(本体))) {
    const t = m[1].replace(/<[^>]+>/g, '').trim()
    /* まとめ・関連記事のような、中身の無い見出しは外す */
    if (!t || /まとめ|関連|この記事|目次|よくある質問/.test(t)) continue
    if (t.length > 34) continue
    出.push(t)
  }
  return 出
}

const 見出したち = 見出しを拾う(html)
/* ⚠ **具体的なものから3つ。**数字や「〜しない」を含むものを前に出す */
const 点 = (s) =>
  (/\d/.test(s) ? 3 : 0) +
  (/円|年|ヶ月|日|割|%/.test(s) ? 2 : 0) +
  (/ない|注意|落とし穴|違約|解約|締切|前に/.test(s) ? 3 : 0)
const 三つ = 見出したち.slice().sort((a, b) => 点(b) - 点(a)).slice(0, 3)

const url = `${サイト}/kiji/${選んだ}${印}`
/* Xでは、URLは何文字でも23文字として数えられます */
const 本文 = [題, '', ...三つ.map(x => `・${x}`), '', url].join('\n').trim()

if (下書きだけ) {
  console.log('── 送らずに、文面だけ ──')
  console.log(本文)
  /* Xでの見た目の長さ。URLは何文字でも23文字として数えられます */
  console.log(`（見た目の長さ ${本文.replace(url, '').length + 23} 文字ぶん／上限280）`)
  process.exit(0)
}

/* ── 送る ───────────────────────────────────── */
const 鍵 = {
  key: process.env.X_API_KEY, secret: process.env.X_API_SECRET,
  token: process.env.X_ACCESS_TOKEN, tokenSecret: process.env.X_ACCESS_SECRET,
}
if (!鍵.key || !鍵.secret || !鍵.token || !鍵.tokenSecret) {
  console.log('⚠ Xの鍵が入っていません。文面だけ作りました：')
  console.log('──')
  console.log(本文)
  console.log('──')
  console.log('鍵を入れると、ここから自動で送ります（X_API_KEY／X_API_SECRET／X_ACCESS_TOKEN／X_ACCESS_SECRET）')
  process.exit(0)
}

/* OAuth 1.0a の署名。Xはここだけ古い作法のまま */
function 署名つきヘッダ(method, url, body) {
  const p = {
    oauth_consumer_key: 鍵.key,
    oauth_nonce: crypto.randomBytes(16).toString('hex'),
    oauth_signature_method: 'HMAC-SHA1',
    oauth_timestamp: Math.floor(Date.now() / 1000).toString(),
    oauth_token: 鍵.token,
    oauth_version: '1.0',
  }
  const enc = (s) => encodeURIComponent(s).replace(/[!*'()]/g, c => '%' + c.charCodeAt(0).toString(16).toUpperCase())
  const 並び = Object.keys(p).sort().map(k => `${enc(k)}=${enc(p[k])}`).join('&')
  const 素 = [method.toUpperCase(), enc(url), enc(並び)].join('&')
  const 鍵文字 = `${enc(鍵.secret)}&${enc(鍵.tokenSecret)}`
  p.oauth_signature = crypto.createHmac('sha1', 鍵文字).update(素).digest('base64')
  return 'OAuth ' + Object.keys(p).sort().map(k => `${enc(k)}="${enc(p[k])}"`).join(', ')
}

const api = 'https://api.twitter.com/2/tweets'
const r = await fetch(api, {
  method: 'POST',
  headers: { Authorization: 署名つきヘッダ('POST', api), 'content-type': 'application/json' },
  body: JSON.stringify({ text: 本文 }),
})
const j = await r.json().catch(() => ({}))

if (!r.ok) {
  /* ⚠ **失敗したら、済みに入れないこと。**入れると、その記事は二度と流れません */
  console.error(`⚠ 送れませんでした（${r.status}）:`, JSON.stringify(j).slice(0, 300))
  if (r.status === 429) console.error('  無料枠（月500件）を使い切った可能性があります。')
  process.exit(1)
}

済み.push(選んだ)
fs.mkdirSync('データ', { recursive: true })
fs.writeFileSync(済みの道, JSON.stringify(済み, null, 2), 'utf8')
fs.appendFileSync('データ/配った記録.jsonl',
  JSON.stringify({ 日時: new Date().toISOString(), 入口: 'X（記事の告知）', 記事: 選んだ }) + '\n', 'utf8')

console.log(`送りました：${題}`)
console.log(`  ${url}`)
