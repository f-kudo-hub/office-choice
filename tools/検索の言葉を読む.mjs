/**
 * Search Console の書き出し（CSV）を読んで、「次に直す記事」を出す
 * ---------------------------------------------------------------------------
 * 2026-09-02 常務のご指示「（データが）出たら朝の点検で拾えるようにしておいて」。
 *
 * **なぜ要るか。**
 * GA4は「来た人」しか見えません。**「検索結果に出たのに、来なかった」が見えない。**
 * そこが見えないと、記事を何本増やしても当てずっぽうです。
 * Search Console だけが、そこを教えてくれます。
 *
 * **この道具が答えるのは1つだけ：次にどの記事の、どの言葉を直すか。**
 * 順位表を眺めるための道具ではありません。
 *
 * 使い方：
 *   1. 🔗 https://search.google.com/search-console →「検索パフォーマンス」
 *   2. 右上の「エクスポート」→「CSVをダウンロード」（zipで落ちてきます）
 *   3. zipを展開して、中のCSVを丸ごと `データ/` に入れる
 *   4. node tools/検索の言葉を読む.mjs
 *
 * **ファイル名は気にしなくて大丈夫です。**日本語（クエリ.csv・ページ.csv）でも
 * 英語（Queries.csv・Pages.csv）でも、中の見出しを見て判断します。
 *
 * 出力：00_検索の言葉.md
 */

import { readdirSync, readFileSync, writeFileSync, statSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

// **どこから呼ばれても同じ答えを返す**（作業場から絶対パスで呼ばれるため）
process.chdir(join(dirname(fileURLToPath(import.meta.url)), '..'))

const データ置き場 = 'データ'
const 出力先 = '00_検索の言葉.md'

/* ── CSVを読む ───────────────────────────────────────────── */

/**
 * 素直なCSVの読み手。Search Console の書き出しは
 * 引用符とカンマが混ざるので、そこだけは正しく扱います。
 */
function csvを行に(文字列) {
  const 行 = []
  let 欄 = '', いま = [], 引用中 = false
  for (let i = 0; i < 文字列.length; i++) {
    const c = 文字列[i]
    if (引用中) {
      if (c === '"') { if (文字列[i + 1] === '"') { 欄 += '"'; i++ } else 引用中 = false }
      else 欄 += c
    } else if (c === '"') 引用中 = true
    else if (c === ',') { いま.push(欄); 欄 = '' }
    else if (c === '\n') { いま.push(欄); 行.push(いま); いま = []; 欄 = '' }
    // BOM はどの欄に混ざっていても落とす。書き出し側の作り方に左右されないように
    else if (c !== '\r' && c !== '﻿') 欄 += c
  }
  if (欄 !== '' || いま.length) { いま.push(欄); 行.push(いま) }
  return 行.filter(r => r.some(x => x.trim() !== ''))
}

/** 「1,234」「12.3%」「3.5」を数にする。読めなければ null（**0にしない**） */
function 数にする(v) {
  if (v == null) return null
  const t = String(v).replace(/[,%\s]/g, '')
  if (t === '') return null
  const n = Number(t)
  return Number.isFinite(n) ? n : null
}

/** 見出しの並びから、欲しい列がどこにあるかを見つける（日本語・英語の両対応） */
function 列を見つける(見出し) {
  const 探す = (...候補) => 見出し.findIndex(h => {
    const t = String(h).trim().toLowerCase()
    return 候補.some(c => t === c || t.includes(c))
  })
  return {
    語: 探す('上位のクエリ', 'クエリ', 'top queries', 'query'),
    頁: 探す('上位のページ', 'ページ', 'top pages', 'page'),
    表示: 探す('表示回数', 'impressions'),
    click: 探す('クリック数', 'clicks'),
    順位: 探す('掲載順位', 'position'),
  }
}

const 行たち = []
const 要対応 = []
const 出す = s => 行たち.push(s)
const 今 = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Tokyo' }))
const 今日 = 今.toLocaleDateString('sv-SE')

/* ── データ置き場から、それらしいCSVを拾う ─────────────────── */

let csv一覧 = []
try {
  csv一覧 = readdirSync(データ置き場).filter(f => f.toLowerCase().endsWith('.csv'))
} catch { /* 置き場そのものが無い */ }

const 語の表 = []   // {語, 表示, click, 順位}
const 頁の表 = []   // {頁, 表示, click, 順位}
let 読んだファイル = []

for (const f of csv一覧) {
  const 中身 = readFileSync(join(データ置き場, f), 'utf8').replace(/^﻿/, '')
  const 行 = csvを行に(中身)
  if (行.length < 2) continue
  const 列 = 列を見つける(行[0])
  if (列.表示 < 0) continue                     // 表示回数が無い表は、この道具の対象外

  const 語か = 列.語 >= 0
  const 頁か = 列.頁 >= 0
  if (!語か && !頁か) continue

  読んだファイル.push(f)
  for (const r of 行.slice(1)) {
    const 中 = {
      表示: 数にする(r[列.表示]),
      click: 列.click >= 0 ? 数にする(r[列.click]) : null,
      順位: 列.順位 >= 0 ? 数にする(r[列.順位]) : null,
    }
    if (中.表示 == null) continue
    if (語か) 語の表.push({ 語: r[列.語], ...中 })
    else 頁の表.push({ 頁: r[列.頁], ...中 })
  }
}

/* ── 出す ───────────────────────────────────────────────── */

出す('# 検索の言葉（次にどの記事を直すか）')
出す('')

if (読んだファイル.length === 0) {
  出す(`**${今日}｜Search Console の書き出しが、まだ \`データ/\` にありません。**`)
  出す('')
  出す('**これは「数字が0」ではありません。「まだ受け取っていない」です。**')
  出す('')
  出す('1. 🔗 https://search.google.com/search-console →「検索パフォーマンス」')
  出す('2. 右上の**「エクスポート」→「CSVをダウンロード」**（zipで落ちてきます）')
  出す('3. zipを展開して、**中のCSVを丸ごと `データ/` に入れる**')
  出す('')
  出す('ファイル名は気にしなくて大丈夫です。中の見出しを見て判断します。')
  writeFileSync(出力先, 行たち.join('\n') + '\n', 'utf8')
  console.log('まだCSVがありません（データ/ に置いてください）')
  process.exit(0)
}

const 合計表示 = 語の表.concat(頁の表).reduce((a, b) => a + (b.表示 ?? 0), 0)
const 合計click = 語の表.concat(頁の表).reduce((a, b) => a + (b.click ?? 0), 0)

出す(`**${今日}｜読んだファイル：${読んだファイル.join('・')}**`)
出す('')
出す(`表示 **${合計表示.toLocaleString()}回**／クリック **${合計click.toLocaleString()}回**`)
出す('')

/* ① いちばん効くところ：表示はあるのに、クリックが0の語 */
// **ここが「読まれる前に負けている」場所です。**
// 検索結果には出ているのに選ばれていない。直すのは記事の中身ではなく、題名と説明文。
// **10位以内であることが条件です。**15位で0クリックは当たり前で、
// それを題名のせいにすると直す場所を間違えます（そちらは②の「順位」の問題）
const 惜しい = 語の表
  .filter(x => (x.表示 ?? 0) >= 5 && (x.click ?? 0) === 0 && (x.順位 == null || x.順位 <= 10))
  .sort((a, b) => b.表示 - a.表示)
  .slice(0, 12)

出す('## ① 出ているのに、選ばれていない言葉')
出す('')
if (惜しい.length === 0) {
  出す('該当なし（**10位以内**で表示5回以上、かつクリック0の語はありません）。')
} else {
  出す('**1ページ目に出ているのに、選ばれていません。**直すのは記事の中身ではなく、**題名と説明文**。')
  出す('（11位より下は、そもそも読まれません。そちらは②で扱います）')
  出す('')
  出す('| 検索された言葉 | 表示 | 順位 |')
  出す('| --- | ---: | ---: |')
  for (const x of 惜しい) 出す(`| ${x.語} | ${x.表示} | ${x.順位 == null ? '―' : x.順位.toFixed(1)} |`)
  要対応.push(`検索で出ているのにクリック0の言葉が${惜しい.length}件（題名を直せば拾えます）`)
}

/* ② あと一歩：11〜20位。ここは1ページ目に上げれば一気に増える */
const あと一歩 = 語の表
  .filter(x => x.順位 != null && x.順位 > 10 && x.順位 <= 20 && (x.表示 ?? 0) >= 3)
  .sort((a, b) => a.順位 - b.順位)
  .slice(0, 12)

出す('')
出す('## ② あと一歩（11〜20位）')
出す('')
if (あと一歩.length === 0) {
  出す('該当なし。')
} else {
  出す('**2ページ目はほぼ読まれません。**ここを1ページ目に上げるのが、いちばん費用対効果が高い直しです。')
  出す('その言葉を扱った記事に、実務の話を足して厚くします。')
  出す('')
  出す('| 検索された言葉 | 順位 | 表示 | クリック |')
  出す('| --- | ---: | ---: | ---: |')
  for (const x of あと一歩) 出す(`| ${x.語} | ${x.順位.toFixed(1)} | ${x.表示} | ${x.click ?? 0} |`)
}

/* ③ すでに当たっている記事。**同じ形を増やすのが次の一手** */
const 当たり = 頁の表
  .filter(x => (x.click ?? 0) > 0)
  .sort((a, b) => (b.click ?? 0) - (a.click ?? 0))
  .slice(0, 8)

出す('')
出す('## ③ すでに当たっている記事')
出す('')
if (当たり.length === 0) {
  出す('まだクリックされた記事はありません。**新しいサイトでは普通のことです。**')
} else {
  出す('**当たった記事と同じ形を増やすのが、いちばん確実な増やし方です。**')
  出す('')
  出す('| ページ | クリック | 表示 |')
  出す('| --- | ---: | ---: |')
  for (const x of 当たり) 出す(`| ${String(x.頁).replace('https://f-kudo-hub.github.io/office-choice/', '')} | ${x.click} | ${x.表示} |`)
}

出す('')
出す('---')
出す('')
出す('<sub>このファイルは `tools/検索の言葉を読む.mjs` が作ります。**直接書き換えても次に消えます。**')
出す('元は Search Console の書き出しCSV（`データ/`）です。**古いCSVを読めば古い答えが出ます。**月に1度は入れ替えてください。')
出す('**数字が無いものは、無いと書いています。**推測で埋めた数字では判断できません。</sub>')

writeFileSync(出力先, 行たち.join('\n') + '\n', 'utf8')
console.log(要対応.length ? `要対応 ${要対応.length}件：\n  - ${要対応.join('\n  - ')}` : `読めました（表示 ${合計表示}回・クリック ${合計click}回）`)
