/* Blueskyに知らせる（記事を出したら、自動で告知する）
 *
 * 2026-09-15 常務のご指示「とにかく、宣伝が大事！いろんなところに宣伝して！自動化で！」
 *
 * 形は tools/Xに知らせる.mjs と同じ（題名＋見出し3つ＋URL。宣伝文にしない）。
 * 違うのは送り先だけ。Bluesky は開発者登録が要らず、アプリパスワード1つで送れる。
 *
 * 鍵：BSKY_HANDLE / BSKY_APP_PASSWORD（無ければ文面だけ出して素通り。失敗にしない）
 * 記録：データ/Blueskyに知らせた.json（済み）／データ/配った記録.jsonl（入口ごとの成績に効く）
 *
 * 使い方
 *   node tools/Blueskyに知らせる.mjs            … まだ知らせていない記事を1本
 *   node tools/Blueskyに知らせる.mjs --下書き   … 送らずに文面だけ
 */
import fs from 'node:fs'
import path from 'node:path'

const 下書きだけ = process.argv.includes('--下書き')
const サイト = 'https://soumu-choice.com'
const 印 = '?utm_source=bluesky&utm_medium=social'
const 記事の場所 = 'docs/kiji'
const 済みの道 = 'データ/Blueskyに知らせた.json'

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
/* Bluesky は 300字まで。URLは見た目のまま数えられるので、題と見出しが長ければ見出しを減らす */
let 本文 = [題, '', ...三つ.map(x => `・${x}`), '', url].join('\n').trim()
while ([...本文].length > 300 && 三つ.length) { 三つ.pop(); 本文 = [題, '', ...三つ.map(x => `・${x}`), '', url].join('\n').trim() }

if (下書きだけ) { console.log('── 送らずに、文面だけ ──\n' + 本文 + `\n（${[...本文].length}字／上限300）`); process.exit(0) }

const handle = process.env.BSKY_HANDLE, pw = process.env.BSKY_APP_PASSWORD
if (!handle || !pw) {
  console.log('⚠ Blueskyの鍵が入っていません。文面だけ作りました：\n──\n' + 本文 + '\n──')
  process.exit(0)
}

const s = await fetch('https://bsky.social/xrpc/com.atproto.server.createSession', {
  method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ identifier: handle, password: pw }),
})
if (!s.ok) { console.error(`⚠ Blueskyにログインできません（${s.status}）`); process.exit(1) }
const sess = await s.json()
const te = new TextEncoder()
const facets = []
for (const m of 本文.matchAll(/https?:\/\/\S+/g)) {
  const start = te.encode(本文.slice(0, m.index)).length
  facets.push({ index: { byteStart: start, byteEnd: start + te.encode(m[0]).length }, features: [{ $type: 'app.bsky.richtext.facet#link', uri: m[0] }] })
}
const r = await fetch('https://bsky.social/xrpc/com.atproto.repo.createRecord', {
  method: 'POST', headers: { 'content-type': 'application/json', Authorization: `Bearer ${sess.accessJwt}` },
  body: JSON.stringify({ repo: sess.did, collection: 'app.bsky.feed.post', record: { $type: 'app.bsky.feed.post', text: 本文, facets, createdAt: new Date().toISOString(), langs: ['ja'] } }),
})
if (!r.ok) {
  /* ⚠ 失敗したら済みに入れない。入れるとその記事は二度と流れない */
  console.error(`⚠ 送れませんでした（${r.status}）:`, (await r.text()).slice(0, 300))
  process.exit(1)
}
済み.push(選んだ)
fs.mkdirSync('データ', { recursive: true })
fs.writeFileSync(済みの道, JSON.stringify(済み, null, 2), 'utf8')
fs.appendFileSync('データ/配った記録.jsonl', JSON.stringify({ 日時: new Date().toISOString(), 入口: 'Bluesky（記事の告知）', 記事: 選んだ }) + '\n', 'utf8')
console.log(`送りました：${題}\n  ${url}`)
