/**
 * 補助金カレンダーの元データを作る（月額会員 ¥2,980 の心臓部）
 *
 * ── なぜ要るか ────────────────────────────────────────────────
 * 計画（第3版）の層②は「月額会員 ¥2,980・補助金カレンダー＋締切リマインド」。
 * ここが成り立つかどうかは、**毎月ひとりでに新しくなる中身があるか**で決まる。
 * 人が手で集める設計にすると、必ず止まる。止まった月に解約される。
 *
 * ── どこから取るか ──────────────────────────────────────────
 * デジタル庁「Jグランツ（jGrants）」の公開API。**認証は要らない。**
 *   https://developers.digital.go.jp/documents/jgrants/api/
 *   GET https://api.jgrants-portal.go.jp/exp/v1/public/subsidies
 *
 * **公的な一次情報をそのまま使う。**まとめサイトを写さない。
 * 写すと、向こうが間違えたときにこちらも間違え、直った日も分からない。
 *
 * ── 取れる項目（2026-08-31 に実際に確認）────────────────────
 *   title / name(番号) / acceptance_start_datetime / acceptance_end_datetime
 *   subsidy_max_limit(上限額) / target_area_search(対象地域)
 *   target_number_of_employees(従業員数の条件) / id
 * **金額は0で入っていることがある。**0を「上限0円」と書かない（未公表として扱う）。
 *
 * ── 出すもの ────────────────────────────────────────────────
 *   データ/補助金_最新.json … 全件（機械が読む用）
 *   データ/補助金_締切カレンダー.md … 締切の近い順（人が読む用・会員へ出す原稿の土台）
 *
 * 使い方： node tools/補助金を集める.mjs
 */
import { writeFileSync, mkdirSync, existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const ここ = dirname(fileURLToPath(import.meta.url))
const 作業場 = join(ここ, '..')
const 出し先 = join(作業場, 'データ')

const API = 'https://api.jgrants-portal.go.jp/exp/v1/public/subsidies'

/**
 * jGrants は keyword が必須で、2文字以上でないと弾かれる。
 * **1語だけだと取りこぼす。**「補助金」で引くと「助成金」だけの制度が落ちるため、
 * 複数の語で引いて id で重ねる。
 */
const 検索語 = ['補助金', '助成金', '支援金', '給付金']

async function 引く(keyword) {
  const q = new URLSearchParams({
    keyword,
    sort: 'acceptance_end_datetime',
    order: 'ASC',
    acceptance: '1', // 受付中のものだけ
  })
  const res = await fetch(`${API}?${q}`, { headers: { accept: 'application/json' } })
  if (!res.ok) throw new Error(`${keyword}: HTTP ${res.status}`)
  const j = await res.json()
  return j.result ?? []
}

/** 日付だけにする。DBの日時は UTC で返るので、日本時間に直してから切る */
function 日付(v) {
  if (!v) return null
  const d = new Date(v)
  if (Number.isNaN(d.getTime())) return null
  return new Date(d.getTime() + 9 * 60 * 60 * 1000).toISOString().slice(0, 10)
}

const 円 = n => '¥' + Number(n).toLocaleString('ja-JP')

function 上限(n) {
  // **0 を「上限0円」と書かない。**未公表と、本当に0円は別物
  const v = Number(n)
  return Number.isFinite(v) && v > 0 ? 円(v) : '未公表'
}

function 残り日数(締切, 今日) {
  if (!締切) return null
  return Math.round((new Date(締切) - new Date(今日)) / 86400000)
}

const 今日 = 日付(new Date().toISOString())

const 集めた = new Map()
const 語ごと = []
for (const w of 検索語) {
  try {
    const rows = await 引く(w)
    語ごと.push(`${w}:${rows.length}件`)
    for (const r of rows) {
      if (!集めた.has(r.id)) {
        集めた.set(r.id, {
          id: r.id,
          番号: r.name ?? null,
          名称: r.title ?? '(名称なし)',
          実施機関: r.institution_name ?? null,
          受付開始: 日付(r.acceptance_start_datetime),
          締切: 日付(r.acceptance_end_datetime),
          上限額: Number(r.subsidy_max_limit) || 0,
          対象地域: r.target_area_search ?? null,
          従業員数の条件: r.target_number_of_employees ?? null,
          出典: `https://www.jgrants-portal.go.jp/subsidy/${r.id}`,
          見つけた日: 今日,
        })
      }
    }
  } catch (e) {
    // **取れなかった語を黙って飛ばさない。**「0件」と「取れなかった」は別物
    語ごと.push(`${w}:取得失敗(${e.message})`)
  }
}

const 全件 = [...集めた.values()].sort((a, b) => String(a.締切 ?? '9999').localeCompare(String(b.締切 ?? '9999')))

if (!existsSync(出し先)) mkdirSync(出し先, { recursive: true })

writeFileSync(
  join(出し先, '補助金_最新.json'),
  JSON.stringify({ 集めた日: 今日, 出典: 'デジタル庁 jGrants 公開API', 語ごとの件数: 語ごと, 件数: 全件.length, 補助金: 全件 }, null, 2),
  'utf8',
)

// ── 人が読むほう（会員へ出す原稿の土台）──────────────────────
const 締切あり = 全件.filter(r => r.締切)
const 区分 = [
  ['7日以内に締切', r => 残り日数(r.締切, 今日) <= 7],
  ['今月中（30日以内）', r => 残り日数(r.締切, 今日) <= 30],
  ['90日以内', r => 残り日数(r.締切, 今日) <= 90],
  ['それ以降', () => true],
]

let md = `# 補助金の締切カレンダー（${今日} 時点）\n\n`
md += `> 出典：デジタル庁「Jグランツ」公開API（一次情報）\n`
md += `> 受付中 **${全件.length}件**（うち締切の日付があるもの ${締切あり.length}件）\n`
md += `> 語ごとの件数：${語ごと.join(' / ')}\n\n`
md += `**この一覧は毎回この場で作り直しています。**前回の写しは持ちません。\n`
md += `金額の「未公表」は、APIが0を返したものです。**0円という意味ではありません。**\n\n---\n\n`

const 済 = new Set()
for (const [見出し, 条件] of 区分) {
  const 該当 = 締切あり.filter(r => !済.has(r.id) && 条件(r))
  該当.forEach(r => 済.add(r.id))
  if (!該当.length) continue
  md += `## ${見出し}（${該当.length}件）\n\n`
  md += `| 締切 | 残り | 補助金 | 上限額 | 対象地域 |\n| --- | ---: | --- | ---: | --- |\n`
  for (const r of 該当) {
    const d = 残り日数(r.締切, 今日)
    md += `| ${r.締切} | ${d}日 | [${r.名称}](${r.出典}) | ${上限(r.上限額)} | ${r.対象地域 ?? '—'} |\n`
  }
  md += '\n'
}

writeFileSync(join(出し先, '補助金_締切カレンダー.md'), md, 'utf8')

console.log(`受付中 ${全件.length}件（${語ごと.join(' / ')}）`)
console.log(`7日以内に締切：${締切あり.filter(r => 残り日数(r.締切, 今日) <= 7).length}件`)
console.log(`30日以内に締切：${締切あり.filter(r => 残り日数(r.締切, 今日) <= 30).length}件`)
console.log('→ データ/補助金_最新.json ／ データ/補助金_締切カレンダー.md')
