/**
 * 副業サイト「オフィスの選びかた」の毎朝の点検
 * ---------------------------------------------------------------------------
 * 常務のご指示（2026-09-01）：
 *   「しっかり自動で毎日動いて収益を上げているか！そこを毎日しっかり管理して！
 *     ダメな場合は何か手を打って！忘れずにお願い！副業だけどこれも主戦場だ！」
 *
 * **見るのは3つだけ。**
 *   ① 自動更新が動いたか（補助金＝毎朝／記事＝毎朝）
 *   ② サイトが生きているか・ページが増えているか
 *   ③ 収益につながる線（提携先・記事の本数）
 *
 * **「動いていない」と「確認できていない」を混ぜません。**
 * GitHubに聞けなかったときは、そう出します。無事と点検漏れは別物です。
 *
 * 使い方： node tools/毎朝の点検.mjs
 * 結果は 00_点検結果.md に書き出します（このリポジトリの中。作業場には書きません）
 */
import { execSync } from 'node:child_process'
import { writeFileSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

// **どこから呼ばれても同じ答えを返す。**作業場（00_ClaudeCode）から絶対パスで
// 呼ばれると、相対パスの `ls 記事` や `git ls-files` が空振りして
// 「記事0本・ページ数えられません」と出ていました（2026-09-02 に直した）
process.chdir(join(dirname(fileURLToPath(import.meta.url)), '..'))

const リポ = 'f-kudo-hub/office-choice'
const サイト = 'https://f-kudo-hub.github.io/office-choice/'
const 今 = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Tokyo' }))
const 今日 = 今.toLocaleDateString('sv-SE')

const gh = (path) => {
  try { return JSON.parse(execSync(`gh api "${path}"`, { encoding: 'utf8', stdio: ['ignore','pipe','ignore'] })) }
  catch { return null }
}

const 行 = []
const 要対応 = []
const 出す = (s) => 行.push(s)

出す(`# オフィスの選びかた｜毎朝の点検`)
出す('')
出す(`**${今日} ${今.getHours()}時 時点**`)
出す('')

/* ── ① 自動更新 ────────────────────────────────── */
出す('## 自動で動いているか')
出す('')
const 一覧 = gh(`repos/${リポ}/actions/workflows`)
if (!一覧) {
  出す('- ⚠ **点検できていません**（GitHubに聞けませんでした）')
  要対応.push('GitHubに聞けず、自動更新を確認できていません')
} else {
  for (const [名, パス, 間隔] of [
    ['補助金の更新', 'subsidy-refresh', '毎朝6時'],
    ['毎日の記事', 'post-daily', '毎朝7時'],
  ]) {
    const w = 一覧.workflows.find(x => x.path.includes(パス))
    if (!w) { 出す(`- ⚠ **${名}**：ワークフローが見つかりません`); 要対応.push(`${名}のワークフローがありません`); continue }
    if (w.state !== 'active') { 出す(`- ⚠ **${名}**：止まっています（${w.state}）`); 要対応.push(`${名}が止まっています`); continue }
    const runs = gh(`repos/${リポ}/actions/workflows/${w.id}/runs?per_page=5`)
    const 最新 = runs?.workflow_runs?.[0]
    if (!最新) { 出す(`- **${名}**（${間隔}）：まだ1度も走っていません`); continue }
    const 経過 = Math.floor((Date.now() - new Date(最新.created_at)) / 3600000)
    const 結果 = 最新.conclusion ?? 最新.status
    const 印 = 結果 === 'success' ? '○' : '✗'
    出す(`- ${印} **${名}**（${間隔}）：最後は ${String(最新.created_at).slice(0,16).replace('T',' ')} UTC・${結果}（${経過}時間前）`)
    if (結果 !== 'success') 要対応.push(`${名}が失敗しています（${結果}）`)
    // **定期実行の枠が本当に叩かれているかを見る。**手動だけ通っていても「動いている」ではない。
    // ワークフローの文法が壊れていると、GitHubは登録せず、schedule の回が1件も出ません
    // （2026-09-02、if: が二重で丸ごと登録されていませんでした）
    const 定期 = runs.workflow_runs.filter(r => r.event === 'schedule')
    if (定期.length === 0) {
      出す(`  - ⚠ 直近5回に**定期実行が1件もありません**（手で走らせた分だけです）`)
      要対応.push(`${名}の定期実行が登録されていません（文法エラーの疑い）`)
    }
    // 毎朝のものが30時間以上動いていなければ、止まっている
    if (パス === 'subsidy-refresh' && 経過 > 30) 要対応.push(`補助金の更新が${経過}時間動いていません`)
    // 毎朝のものが30時間以上動いていなければ、止まっている
    if (パス === 'post-daily' && 経過 > 30) 要対応.push(`毎日の記事が${経過}時間動いていません`)
  }
}

/* ── ② サイトの中身 ──────────────────────────────── */
出す('')
出す('## サイト')
出す('')
try {
  const 数 = execSync('git ls-files docs | grep -c "\.html$"', { encoding: 'utf8' }).trim()
  出す(`- 公開ページ：**${数}枚**`)
} catch { 出す('- 公開ページ：数えられませんでした') }
try {
  const 記事 = execSync('ls 記事 | wc -l', { encoding: 'utf8' }).trim()
  出す(`- 記事：**${記事}本**`)
} catch {}
try {
  const 提携 = JSON.parse(readFileSync('提携先.json', 'utf8'))
  const n = Array.isArray(提携) ? 提携.length : Object.values(提携)[0]?.length ?? '?'
  出す(`- 提携先：**${n}件**`)
} catch {}

/* ── ③ 収益 ─────────────────────────────────── */
出す('')
出す('## 収益')
出す('')
出す('- **A8の成果は、こちらからは読めません**（ログインが要ります）。')
出す('  🔗 https://pub.a8.net/ で「レポート → 発生状況」をご確認ください。')
出す('- アフィリエイトは**単発報酬**です。継続課金にするには自分が売り手になるしかありません。')

/* ── まとめ ─────────────────────────────────── */
出す('')
出す('---')
出す('')
if (要対応.length === 0) {
  出す('## 異常なし')
  出す('')
  出す('自動更新は動いています。')
} else {
  出す(`## 要対応 ${要対応.length}件`)
  出す('')
  for (const x of 要対応) 出す(`- ${x}`)
}

const 本文 = 行.join('\n') + '\n'
writeFileSync('00_点検結果.md', 本文, 'utf8')
console.log(本文)
process.exit(要対応.length ? 1 : 0)
