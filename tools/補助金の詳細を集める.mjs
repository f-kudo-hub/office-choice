/**
 * 補助金1件ずつの「中身」を取ってくる
 *
 * ── なぜ要るか ────────────────────────────────────────────────
 * 一覧のAPI（tools/補助金を集める.mjs）で取れるのは、名称・締切・地域・上限だけ。
 * それだけでは1件ぶんのページを作れない（中身の無いページを並べると、
 * Googleのスパムポリシー「大量生成された低品質コンテンツ」に当たり、サイトごと消える）。
 *
 * 詳細のAPIには、ページの土台になる項目が入っている：
 *   use_purpose … 「設備整備・IT導入をしたい」など、その補助金で何をするための金か
 *   subsidy_rate … 補助率（自己負担の計算に使う）
 *   industry … 対象業種
 *   target_area_detail … 市町村まで絞った対象地域
 *   project_end_deadline … 事業をやり終える期限（締切とは別物）
 *
 * ── どこから取るか ──────────────────────────────────────────
 * デジタル庁「Jグランツ」公開API（認証不要・一次情報）
 *   GET https://api.jgrants-portal.go.jp/exp/v1/public/subsidies/id/{id}
 *
 * ── 写しを持たない ──────────────────────────────────────────
 * 毎回ぜんぶ取り直す。締切が延びたり、上限が変わったりするため。
 * 前回の値を持ち越すと、向こうが直した日にこちらだけ古いままになる。
 * 取れなかった件は「取れなかった」と記録する。**0件と取得失敗は別物。**
 *
 * 使い方： node tools/補助金の詳細を集める.mjs
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const ここ = dirname(fileURLToPath(import.meta.url))
const 作業場 = join(ここ, '..')
const データ = join(作業場, 'データ')

const API = 'https://api.jgrants-portal.go.jp/exp/v1/public/subsidies/id/'

/**
 * 相手は官公庁のAPI。同時に何十本も投げない。
 * **2026-08-31、同時4本で7件が HTTP 429（投げすぎ）で落ちた。**
 * 落ちた中に「ものづくり補助金」が入っていた。件数の多い日ほど、大事なものが落ちる。
 * 同時本数を減らし、429のときは間を空けて数回やり直す。
 */
const 同時本数 = 2
const やり直す回数 = 4

const 少し待つ = ms => new Promise(r => setTimeout(r, ms))

const 一覧 = JSON.parse(readFileSync(join(データ, '補助金_最新.json'), 'utf8'))
const 対象 = 一覧.補助金 ?? []

if (!対象.length) {
  console.error('データ/補助金_最新.json が空です。先に tools/補助金を集める.mjs を動かしてください。')
  process.exit(1)
}

/** HTMLのタグを外して、素の文にする（本文をそのまま載せるためではなく、要点を判断するため） */
function 素の文に(html) {
  return String(html ?? '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|div|li|tr|h\d)>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

async function 詳細を1件取る(id) {
  let r = null
  let 最後の理由 = ''
  for (let 回 = 0; 回 <= やり直す回数; 回++) {
    if (回) await 少し待つ(1000 * 2 ** 回) // 2秒 → 4秒 → 8秒 → 16秒
    try {
      const res = await fetch(API + id, { headers: { accept: 'application/json' } })
      if (res.status === 429) { 最後の理由 = 'HTTP 429（投げすぎ）'; continue }
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const j = await res.json()
      r = (j.result ?? [])[0]
      if (!r) throw new Error('中身が空')
      break
    } catch (e) {
      最後の理由 = e.message
    }
  }
  if (!r) throw new Error(最後の理由 || '取得できず')
  return {
    id,
    一言: r.subsidy_catch_phrase ?? null,
    用途: r.use_purpose ?? null,
    業種: r.industry ?? null,
    補助率: r.subsidy_rate ?? null,
    対象地域の詳細: r.target_area_detail ?? null,
    事業終了期限: r.project_end_deadline ? String(r.project_end_deadline).slice(0, 10) : null,
    複数申請可: r.is_enable_multiple_request ?? null,
    Jグランツで申請できる: r.request_reception_presence ?? null,
    公式ページ: r.front_subsidy_detail_page_url ?? `https://www.jgrants-portal.go.jp/subsidy/${id}`,
    説明: 素の文に(r.detail),
    取得日: new Date(Date.now() + 9 * 60 * 60 * 1000).toISOString().slice(0, 10),
  }
}

const 取れた = []
const 取れなかった = []

const 並び = [...対象]
async function 一列ぶん() {
  while (並び.length) {
    const r = 並び.shift()
    try {
      取れた.push(await 詳細を1件取る(r.id))
    } catch (e) {
      // **黙って飛ばさない。**取れなかった件はページを作らない（古い写しで作らないため）
      取れなかった.push({ id: r.id, 名称: r.名称, 理由: e.message })
    }
  }
}

await Promise.all(Array.from({ length: 同時本数 }, 一列ぶん))

const 今日 = new Date(Date.now() + 9 * 60 * 60 * 1000).toISOString().slice(0, 10)
writeFileSync(
  join(データ, '補助金_詳細.json'),
  JSON.stringify(
    {
      集めた日: 今日,
      出典: 'デジタル庁 jGrants 公開API（詳細）',
      件数: 取れた.length,
      取得できなかった件数: 取れなかった.length,
      取得できなかったもの: 取れなかった,
      詳細: 取れた,
    },
    null,
    2,
  ),
  'utf8',
)

console.log(`詳細を取りました：${取れた.length}件／取れなかった ${取れなかった.length}件`)
if (取れなかった.length) console.log(取れなかった.map(x => `  - ${x.名称}：${x.理由}`).join('\n'))
console.log('→ データ/補助金_詳細.json')
