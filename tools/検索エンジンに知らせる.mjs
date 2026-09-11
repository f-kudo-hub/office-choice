/**
 * IndexNow で検索エンジンに「ページを出した／直した」を知らせる
 *
 * ── なぜ要るか ────────────────────────────────────────────────
 * 新しいドメインは、放っておくとクロールが来るまで数週間かかる。
 * **記事を出しても、読まれるまでの時間がそのまま損**になる。
 * IndexNow は、こちらから「このURLを見に来て」と伝える仕組み。
 *
 * ── なぜこれを選んだか ──────────────────────────────────────
 * **アカウントもログインも要らない。**鍵ファイルをサイトに置くだけ。
 * Google Search Console は本人のGoogleアカウントが要るのでこちらでは触れないが、
 * IndexNow なら自動実行の中に入れられる。
 *   対応：Bing / Yandex / Naver / Seznam（Googleは非対応）
 *   https://www.indexnow.org/
 *
 * ── 仕組み ────────────────────────────────────────────────────
 * 1. ランダムな鍵を作り、docs/<鍵>.txt として置く（中身は鍵そのもの）
 * 2. api.indexnow.org へ URL の一覧を投げる
 * 3. 向こうが鍵ファイルを読みに来て、そのサイトの持ち主か確かめる
 *
 * **鍵は一度作ったら変えない。**変えると検証が通らなくなる。
 *
 * ── 正直に ────────────────────────────────────────────────────
 * **Googleには効きません。**Googleのシェアを考えると、これは補助でしかない。
 * Google向けは Search Console への登録が要り、それは本人しかできない。
 *
 * 使い方： node tools/検索エンジンに知らせる.mjs
 */
import { readFileSync, writeFileSync, existsSync, readdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { randomBytes } from 'node:crypto'

const ここ = dirname(fileURLToPath(import.meta.url))
const 作業場 = join(ここ, '..')
const 公開先 = join(作業場, 'docs')
const 設定 = JSON.parse(readFileSync(join(作業場, '設定.json'), 'utf8'))
const 公開URL = (設定.公開URL ?? '').trim().replace(/\/+$/, '')

if (!公開URL) {
  console.error('設定.json の「公開URL」が空です。先に入れてください')
  process.exit(1)
}

const ホスト = new URL(公開URL).host

// ── 鍵をつくる（初回だけ）───────────────────────────────────
const 鍵置き場 = join(作業場, 'データ', 'indexnow_鍵.txt')
let 鍵
if (existsSync(鍵置き場)) {
  鍵 = readFileSync(鍵置き場, 'utf8').trim()
} else {
  鍵 = randomBytes(16).toString('hex')
  writeFileSync(鍵置き場, 鍵 + '\n', 'utf8')
  console.log('鍵を新しく作りました（次からは同じものを使います）')
}
// サイト側にも同じ鍵を置く。向こうがこれを読みに来て持ち主か確かめる
writeFileSync(join(公開先, `${鍵}.txt`), 鍵, 'utf8')

// ── 知らせるURLを集める（sitemapから）──────────────────────
const sm = join(公開先, 'sitemap.xml')
if (!existsSync(sm)) {
  console.error('docs/sitemap.xml がありません。先に node tools/サイトを組み立てる.mjs を実行してください')
  process.exit(1)
}
const urls = [...readFileSync(sm, 'utf8').matchAll(/<loc>(.*?)<\/loc>/g)].map(m => m[1])

if (!urls.length) {
  console.error('sitemap.xml にURLがありませんでした')
  process.exit(1)
}

// ── 同じURLを毎日投げない ──────────────────────────────────
//
// 補助金のページには「あと◯日」が入っているため、**中身が毎日変わる。**
// そのまま毎朝走らせると、100本を超えるURLを毎日投げ続けることになる。
// IndexNow の案内には「実際に中身が変わったURLだけを送ること」とあり、
// 変わっていないURLを送り続けると、送信そのものを無視されるようになる。
//
// **本当に知らせたいのは、新しくできたページ。**残り日数が1日減っただけのページを
// 毎朝知らせても、向こうにとっては同じページで、こちらの信用が減るだけ。
//
// そこで：初めて出すURLは必ず送る。前に送ったURLは30日たつまで送らない。
const 記録の場所 = join(作業場, 'データ', 'indexnow_知らせた.json')
const 記録 = existsSync(記録の場所) ? JSON.parse(readFileSync(記録の場所, 'utf8')) : {}
const 今日 = new Date(Date.now() + 9 * 60 * 60 * 1000).toISOString().slice(0, 10)
const 日数差 = d => Math.round((new Date(今日) - new Date(d)) / 86400000)

const 送るURL = urls.filter(u => !記録[u] || 日数差(記録[u]) >= 30)
const 初めて = urls.filter(u => !記録[u]).length

// **サイトマップから消えたURLは記録からも消す。**受付の終わった補助金のページは
// noindex にしてサイトマップから外している。記録に残し続けると際限なく増える
for (const u of Object.keys(記録)) if (!urls.includes(u)) delete 記録[u]

if (!送るURL.length) {
  console.log(`知らせるURLはありません（サイトマップ ${urls.length}件は、すべて30日以内に知らせ済みです）`)
  writeFileSync(記録の場所, JSON.stringify(記録, null, 2), 'utf8')
  process.exit(0)
}

// ── 知らせる ────────────────────────────────────────────────
const body = {
  host: ホスト,
  key: 鍵,
  keyLocation: `${公開URL}/${鍵}.txt`,
  urlList: 送るURL,
}

const res = await fetch('https://api.indexnow.org/indexnow', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json; charset=utf-8' },
  body: JSON.stringify(body),
})

// **「送った」で終わらせない。**向こうが受け取ったかを見る
const 文 = await res.text().catch(() => '')
console.log(`IndexNow へ ${送るURL.length}件のURLを知らせました（うち初めて出すもの ${初めて}件／サイトマップ全体は ${urls.length}件）`)
console.log(`  返答：HTTP ${res.status} ${文.slice(0, 120)}`)

if (res.status === 200 || res.status === 202) {
  console.log('  受け付けられました（Bing / Yandex などが見に来ます）')
  // **受け付けられたときだけ記録する。**弾かれた分を「知らせ済み」にすると、
  // そのURLは30日間もう一度送られず、静かに漏れる
  for (const u of 送るURL) 記録[u] = 今日
  writeFileSync(記録の場所, JSON.stringify(記録, null, 2), 'utf8')
} else if (res.status === 403) {
  console.log('  ⚠️ 鍵ファイルが読めていません。docs/ を公開してから、もう一度実行してください')
} else {
  console.log('  ⚠️ 受け付けられませんでした。上の返答をご確認ください')
}
console.log('※ Googleには届きません。Google向けは Search Console への登録が要ります（本人のみ）')
