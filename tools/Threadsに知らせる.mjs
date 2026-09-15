/* Threadsに知らせる（記事を出したら、自動で告知する）
 *
 * 2026-09-15 常務のご指示「とにかく、宣伝が大事！いろんなところに宣伝して！自動化で！」
 * Xは有料化（リンク入り1本 $0.20）されたので、無料のThreads APIを使う（常務のご選択「C」）。
 *
 * 形は tools/Xに知らせる.mjs と同じ（題名＋見出し3つ＋URL。宣伝文にしない）。
 * 鍵：THREADS_USER_ID / THREADS_ACCESS_TOKEN（無ければ文面だけ出して素通り。失敗にしない）
 *   ⚠ 鍵は60日で切れる。kuroyuki の PC タスク「Threadsの鍵を延ばす」が毎週入れ直す。
 * 記録：データ/Threadsに知らせた.json（済み）／データ/配った記録.jsonl（入口ごとの成績に効く）
 *
 * 使い方
 *   node tools/Threadsに知らせる.mjs            … まだ知らせていない記事を1本
 *   node tools/Threadsに知らせる.mjs --下書き   … 送らずに文面だけ
 */
import fs from 'node:fs'
import path from 'node:path'

const 下書きだけ = process.argv.includes('--下書き')
const サイト = 'https://soumu-choice.com'
const 印 = '?utm_source=threads&utm_medium=social'
const 記事の場所 = 'docs/kiji'
const 済みの道 = 'データ/Threadsに知らせた.json'

let 済み = []
try { 済み = JSON.parse(fs.readFileSync(済みの道, 'utf8')) } catch { /* はじめて */ }

const 記事たち = fs.readdirSync(記事の場所).filter(f => f.endsWith('.html'))
const まだ = 記事たち.filter(f => !済み.includes(f))
if (!まだ.length) { console.log('知らせていない記事はありません。'); process.exit(0) }
まだ.sort((a, b) => fs.statSync(path.join(記事の場所, b)).mtimeMs - fs.statSync(path.join(記事の場所, a)).mtimeMs)
const 選んだ = まだ[0]
const html = fs.readFileSync(path.join(記事の場所, 選んだ), 'utf8')
const 題 = (html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/) || [])[1]?.replace(/<[^>]+>/g, '').trim() ?? ''

function 見出しを拾う(html) {
  const 本体 = (html.match(/<article[\s\S]*?<\/article>/) || html.match(/<main[\s\S]*?<\/main>/) || [html])[0]
  const 出 = []
  const re = /<h2[^>]*>([\s\S]*?)<\/h2>/g
  let m
  while ((m = re.exec(本体))) {
    const t = m[1].replace(/<[^>]+>/g, '').trim()
    if (!t || /まとめ|関連|この記事|目次|よくある質問/.test(t)) continue
    if (t.length > 34) continue
    出.push(t)
  }
  return 出
}
const 点 = (s) => (/\d/.test(s) ? 3 : 0) + (/円|年|ヶ月|日|割|%/.test(s) ? 2 : 0) + (/ない|注意|落とし穴|違約|解約|締切|前に/.test(s) ? 3 : 0)
const 三つ = 見出しを拾う(html).slice().sort((a, b) => 点(b) - 点(a)).slice(0, 3)

const url = `${サイト}/kiji/${選んだ}${印}`
/* Threads は 500字まで */
const 本文 = [題, '', ...三つ.map(x => `・${x}`), '', url].join('\n').trim()

if (下書きだけ) { console.log('── 送らずに、文面だけ ──\n' + 本文 + `\n（${[...本文].length}字／上限500）`); process.exit(0) }

const uid = process.env.THREADS_USER_ID, tok = process.env.THREADS_ACCESS_TOKEN
if (!uid || !tok) {
  console.log('⚠ Threadsの鍵が入っていません。文面だけ作りました：\n──\n' + 本文 + '\n──')
  process.exit(0)
}
/* 2段階：入れ物を作って、公開する。link_attachment でカードが出る */
const q = new URLSearchParams({ media_type: 'TEXT', text: 本文, access_token: tok, link_attachment: url })
const c = await fetch(`https://graph.threads.net/v1.0/${uid}/threads`, { method: 'POST', body: q })
const cj = await c.json().catch(() => ({}))
if (!c.ok || !cj.id) { console.error(`⚠ 入れ物を作れませんでした（${c.status}）:`, JSON.stringify(cj).slice(0, 300)); process.exit(1) }
await new Promise(r => setTimeout(r, 3000))
const pr = await fetch(`https://graph.threads.net/v1.0/${uid}/threads_publish`, { method: 'POST', body: new URLSearchParams({ creation_id: cj.id, access_token: tok }) })
const pj = await pr.json().catch(() => ({}))
if (!pr.ok || !pj.id) {
  /* ⚠ 失敗したら済みに入れない。入れるとその記事は二度と流れない */
  console.error(`⚠ 公開できませんでした（${pr.status}）:`, JSON.stringify(pj).slice(0, 300))
  process.exit(1)
}
済み.push(選んだ)
fs.mkdirSync('データ', { recursive: true })
fs.writeFileSync(済みの道, JSON.stringify(済み, null, 2), 'utf8')
fs.appendFileSync('データ/配った記録.jsonl', JSON.stringify({ 日時: new Date().toISOString(), 入口: 'Threads（記事の告知）', 記事: 選んだ }) + '\n', 'utf8')
console.log(`送りました：${題}\n  ${url}`)
