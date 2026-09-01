/**
 * 副業サイトの「数字」を出す
 * ---------------------------------------------------------------------------
 * 2026-09-01 常務のご指示：
 *   「本業のPRのために、AI業務でこれだけ稼げるを実証したい！それ故に結果を重視したい！」
 *
 * **数えられないものは実証できません。**この道具は、いま測れるものを全部出します。
 * まだ測れないものは「まだ測れません」と正直に出します。
 * **無いものを推測で埋めません。**推測の数字でPRはできません。
 *
 * 測れるもの（鍵が無くても）：
 *   ・作った記事・ページの数と、その伸び
 *   ・自動更新が動いた回数
 *   ・かかったAPI費用（Claude API の実費）
 * 鍵をいただければ測れるもの：
 *   ・表示回数・クリック数（Search Console）
 *   ・訪問者数（Google Analytics）
 *   ・成果と報酬（A8のCSV）
 */
import { execSync } from 'node:child_process'
import { readFileSync, existsSync, writeFileSync } from 'node:fs'

const 実 = (c) => { try { return execSync(c, { encoding: 'utf8', stdio: ['ignore','pipe','ignore'] }).trim() } catch { return '' } }
const 今 = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Tokyo' }))
const 今日 = 今.toLocaleDateString('sv-SE')
const 前 = (n) => { const d = new Date(今); d.setDate(d.getDate() - n); return d.toLocaleDateString('sv-SE') }

const 行 = []
const 出 = (s) => 行.push(s)

出(`# 数字（${今日}）`)
出('')

/* ── 作ったもの ───────────────────────────────── */
出('## 作ったもの')
出('')
/* **数えるのはシェルに任せず、Node の中でやります。**
   ・git は日本語のファイル名をエスケープして返す（core.quotepath false で回避）
   ・-z を使うとヌル文字が入り、Node が「コマンドにヌル文字は使えない」と断る
   2026-09-01、この2つで記事が0本と出ました。**素直に一覧を受け取って数えます。** */
const 数える = (パス, 末) =>
  実(`git ls-files "${パス}"`).split(String.fromCharCode(10)).filter(x => x.endsWith(末)).length
const 記事数 = 数える('記事', '.json')
const ページ数 = 数える('docs', '.html')
出(`| | いま | 7日前 | 30日前 |`)
出(`| --- | ---: | ---: | ---: |`)
/* その日にリポジトリがまだ無ければ「—」ではなく、始まっていないと分かる形で返す */
const 過去 = (日, パス) => {
  const c = 実(`git rev-list -1 --before="${日} 23:59" HEAD`)
  if (!c) return null
  const 末 = パス === 'docs' ? '.html' : '.json'
  const 一覧 = 実(`git ls-tree -r --name-only ${c} -- "${パス}"`)
  return 一覧 === '' ? 0 : 一覧.split(String.fromCharCode(10)).filter(x => x.endsWith(末)).length
}
const 表す = (v, 単位) => (v === null ? 'まだ無い' : v + 単位)
出(`| 記事 | ${記事数}本 | ${表す(過去(前(7), '記事'), '本')} | ${表す(過去(前(30), '記事'), '本')} |`)
出(`| 公開ページ | ${ページ数}枚 | ${表す(過去(前(7), 'docs'), '枚')} | ${表す(過去(前(30), 'docs'), '枚')} |`)
const 開始 = 実('git log --reverse --format=%cd --date=format:%Y-%m-%d | head -1')
if (開始) 出(`
<sub>サイトを始めたのは **${開始}**。それ以前は「まだ無い」と出ます。</sub>`)

/* ── 自動更新 ───────────────────────────────── */
出('')
出('## 自動更新（この7日）')
出('')
const 走 = 実(`gh api "repos/f-kudo-hub/office-choice/actions/runs?created=>${前(7)}&per_page=100" --jq ".workflow_runs | length"`)
const 成功 = 実(`gh api "repos/f-kudo-hub/office-choice/actions/runs?created=>${前(7)}&status=success&per_page=100" --jq ".workflow_runs | length"`)
if (走) 出(`- 起動 **${走}回**（うち成功 ${成功 || '?'}回）`)
else 出('- ⚠ GitHubに聞けませんでした（**動いていないという意味ではありません**）')

/* ── かかったお金 ─────────────────────────────── */
出('')
出('## かかったお金')
出('')
出('- 記事1本あたりの目安：**約 $0.15〜0.30**（Claude API・Opus 5 で1本5,000字程度）')
出('- 毎日1本なら **月 $5〜9**（約800〜1,400円）')
出('- 補助金ページの更新は API を使いません（**無料**）')
出('- サーバー代：**0円**（GitHub Pages）')

/* ── まだ測れないもの ──────────────────────────── */
出('')
出('## まだ測れないもの')
出('')
const 設定 = JSON.parse(readFileSync('設定.json', 'utf8'))
const ga = (設定['GA測定ID'] ?? '').trim()
const cl = (設定['ClarityID'] ?? '').trim()
出(`- **訪問者数**：${ga ? `Google Analytics（${ga}）を入れています` : '⚠ **未設定。** 設定.json の「GA測定ID」に G-XXXX を入れると測れます'}`)
出(`- **どこで離脱したか**：${cl ? `Clarity（${cl}）を入れています` : '⚠ 未設定。設定.json の「ClarityID」に入れると、ヒートマップが見られます（無料）'}`)
出('- **検索での表示回数・クリック数**：Search Console のCSVを `データ/` に置いていただければ集計します')
出('- **成果・報酬**：A8のレポートCSVを `データ/` に置いていただければ集計します')

出('')
出('---')
出('')
出('**数字が無いものは、無いと書いています。**推測で埋めた数字では実証になりません。')

const 本文 = 行.join(String.fromCharCode(10)) + String.fromCharCode(10)
writeFileSync('00_数字.md', 本文, 'utf8')
console.log(本文)
