/* 入口ごとの成績を出す（どの自動化が稼いでいるか）
 *
 * なぜ作ったか（2026-09-11 常務のご指示）
 *   「ありとあらゆる形で自動化できるものは全部自動化して、
 *    **どの自動化が早く多く稼げるか！検証もできる！**
 *    財布となる入口が少なすぎる！もっともっとやるべき！」
 *
 *   ⚠ **入口を10個作っても、どれが効いたか分からなければ検証になりません。**
 *   増やすより先に、測れる形にします。
 *
 * 測り方
 *   入口ごとに印（UTM）を付けたURLを配り、GA4で「どの印から来たか」を数えます。
 *   印の付け方は `入口の台帳.json`。**入口を足したら、まずここに1行足すこと。**
 *
 * 何を出すか
 *   | 入口 | 送った数 | 来た人 | クリック | 成果 | 1人あたり |
 *   **「送った数」まで見ます。**来た人だけ見ると、
 *   「そもそも配っていない入口」と「配ったが来ない入口」の区別が付きません。
 *
 * 使い方
 *   node tools/入口ごとの成績を出す.mjs          … 今週ぶん
 *   node tools/入口ごとの成績を出す.mjs --全部    … 始めてからの合計
 * 出すもの: 00_入口ごとの成績.md
 */
import fs from 'node:fs'
import path from 'node:path'

const 全部 = process.argv.includes('--全部')
const 今日 = new Date().toLocaleDateString('ja-JP', { timeZone: 'Asia/Tokyo' })

const 台帳の道 = 'tools/入口の台帳.json'
let 台帳
try {
  台帳 = JSON.parse(fs.readFileSync(台帳の道, 'utf8'))
} catch {
  console.error(`⚠ ${台帳の道} が読めません。`)
  process.exit(1)
}

/* ── 配った数を数える（こちら側の記録） ──────────────────
   ⚠ **来た人だけ見ると、配っていない入口と配ったが来ない入口の区別が付きません。**
   道具が配るたびに `データ/配った記録.jsonl` へ1行足す約束にしてあります。 */
function 配った数を数える() {
  const 数 = {}
  let 中身
  try { 中身 = fs.readFileSync('データ/配った記録.jsonl', 'utf8') } catch { return 数 }
  const 境 = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()
  for (const 行 of 中身.split('\n')) {
    if (!行.trim()) continue
    let r; try { r = JSON.parse(行) } catch { continue }
    if (!全部 && r.日時 < 境) continue
    数[r.入口] = (数[r.入口] ?? 0) + 1
  }
  return 数
}

/* ── 来た人を数える（GA4） ────────────────────────────
   ⚠ **鍵が無いときは、0ではなく「まだ測れません」と出すこと。**
   0と出すと「配ったのに誰も来ていない」と読み違えます
   （無事と、確かめていないことは別物）。 */
async function 来た人を数える() {
  const 鍵 = process.env.GA4_SERVICE_KEY
  const 物件 = process.env.GA4_PROPERTY_ID
  if (!鍵 || !物件) return null
  try {
    const { BetaAnalyticsDataClient } = await import('@google-analytics/data')
    const client = new BetaAnalyticsDataClient({ credentials: JSON.parse(鍵) })
    const [res] = await client.runReport({
      property: `properties/${物件}`,
      dateRanges: [{ startDate: 全部 ? '2026-08-31' : '7daysAgo', endDate: 'today' }],
      dimensions: [{ name: 'sessionSource' }, { name: 'sessionMedium' }],
      metrics: [{ name: 'sessions' }, { name: 'activeUsers' }],
    })
    const 表 = {}
    for (const r of res.rows ?? []) {
      const 印 = `${r.dimensionValues[0].value}/${r.dimensionValues[1].value}`
      表[印] = { 回: Number(r.metricValues[0].value), 人: Number(r.metricValues[1].value) }
    }
    return 表
  } catch (e) {
    console.error('  GA4に聞けませんでした:', e.message)
    return null
  }
}

/* ── 稼いだ額（A8などのCSVを置いてもらう） ────────────── */
function 稼いだ額を読む() {
  const 表 = {}
  let ファイルたち
  try { ファイルたち = fs.readdirSync('データ') } catch { return 表 }
  for (const f of ファイルたち) {
    if (!/成果|報酬|レポート/.test(f) || !f.endsWith('.csv')) continue
    const 中 = fs.readFileSync(path.join('データ', f), 'utf8')
    /* ⚠ ASPごとに列がばらばらなので、金額らしき列を探して足すだけにしてある。
       **合わないときは、合わせにいかず「読めません」と出すこと。** */
    const 行たち = 中.split('\n').slice(1)
    let 合計 = 0, 件 = 0
    for (const 行 of 行たち) {
      const m = 行.match(/(\d{1,3}(?:,\d{3})*|\d+)\s*円/)
      if (m) { 合計 += Number(m[1].replace(/,/g, '')); 件++ }
    }
    if (件) 表[f.replace('.csv', '')] = { 円: 合計, 件 }
  }
  return 表
}

const 配った = 配った数を数える()
const 来た = await 来た人を数える()
const 稼ぎ = 稼いだ額を読む()

const 文 = []
文.push('# 入口ごとの成績', '')
文.push(`**${今日} 時点｜${全部 ? '始めてからの合計' : '直近7日'}**`, '')
文.push('⚠ **どの入口が稼いでいるかを見るための1枚です。**',
  '効かない入口は畳み、効く入口に寄せます。', '')

if (!来た) {
  文.push('## ⚠ まだ「来た人」を測れていません', '',
    'GA4の鍵（`GA4_SERVICE_KEY` と `GA4_PROPERTY_ID`）が入っていません。',
    '**0人ではなく、確かめていないという意味です。**', '')
}

文.push('## 入口ごと', '', '| 入口 | 印（utm_source） | 配った | 来た人 | 状態 |', '| --- | --- | ---: | ---: | --- |')
for (const 入口 of 台帳.入口) {
  const 印 = `${入口.utm_source}/${入口.utm_medium}`
  const c = 配った[入口.名] ?? 0
  const v = 来た ? (来た[印]?.人 ?? 0) : null
  let 状態
  if (!入口.動いている) 状態 = 'まだ動かしていません'
  else if (c === 0) 状態 = '⚠ **配れていません**'
  else if (v === null) 状態 = '来た人は測れていません'
  else if (v === 0) 状態 = '⚠ 配ったが、まだ誰も来ていません'
  else 状態 = '○'
  文.push(`| ${入口.名} | \`${入口.utm_source}\` | ${c} | ${v ?? '—'} | ${状態} |`)
}
文.push('')

文.push('## 稼いだ額', '')
if (Object.keys(稼ぎ).length === 0) {
  文.push('⚠ **まだ読めていません。**`データ/` にASPのレポートCSVを置いてください。',
    '- A8 … https://pub.a8.net/ の「レポート → 発生状況」→ CSV', '')
} else {
  文.push('| 出どころ | 件数 | 金額 |', '| --- | ---: | ---: |')
  for (const [名, x] of Object.entries(稼ぎ)) 文.push(`| ${名} | ${x.件} | ¥${x.円.toLocaleString('ja-JP')} |`)
  文.push('')
}

文.push('## 読み方', '',
  '| 見えたもの | 次の一手 |', '| --- | --- |',
  '| 配れていない | **道具が動いていません。**まずそこを直す |',
  '| 配ったが来ない | その入口は**届いていません。**畳むか、出し方を変える |',
  '| 来るが成果0 | 出口（提携先）が合っていません |',
  '| 来て成果が出た | **ここに寄せます** |', '')

fs.writeFileSync('00_入口ごとの成績.md', 文.join('\n') + '\n', 'utf8')
console.log(`入口 ${台帳.入口.length}件／うち動かしているもの ${台帳.入口.filter(x => x.動いている).length}件`)
console.log(来た ? '来た人：測れました' : '⚠ 来た人：まだ測れていません（GA4の鍵が要ります）')
console.log('→ 00_入口ごとの成績.md')
