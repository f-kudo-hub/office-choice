/* SNSの1枚を作る（1080×1920の縦長PNG。文字と数字だけ・写真なし・¥0）
 *
 * なぜ作ったか
 *   2026-09-13 常務のご指摘 ①「今のクライアントは文字を読みたくない。画像・動画で理解したい」
 *   ②同じ日にTikTokの広告をご共有いただき「これも参考にして！」
 *
 *   ⚠ **2回言われたので、ここで形にする**（CLAUDE.md「同じ判断が2回以上出て、はじめてルールとして固める」）。
 *
 *   お預かりした広告は、**1枚の画像だけで「誰向け・何ができる・どうなる」まで全部伝えて**いた。
 *   リンクを踏ませる前に、画像の中で売り切っている。そこは真似する。
 *
 *   ⚠ **真似しないところ。**あの広告の文字は「売れる」「初心者でもできる」「これだけでOK」。
 *   **うちは根拠のない断定を書かない**（CLAUDE.md 5-5・景品表示法）。
 *   代わりに置くのは**日付のある公的データ**で、そこが唯一の強みでもある。
 *   同じ土俵で煽り文句を競っても、専業の情報商材には勝てない。
 *
 * なぜ縦長か
 *   TikTok・リール・ストーリーズは縦。OGP（1200×630）は**リンクを貼ったときの絵**で、
 *   **それ自体を投稿する絵ではない。**別物なので分けて作る。
 *
 * なぜ毎日作れるか
 *   締切は毎日動く。**中身がひとりでに変わるので、投稿のネタが尽きない。**
 *   記事の告知は週1本しかネタが無いが、これは毎朝ある。
 *
 * 使い方
 *   node tools/SNSの1枚を作る.mjs            … docs/ogp/sns-今週の締切.png を作る
 *   node tools/SNSの1枚を作る.mjs --日数 14  … 何日以内を数えるか（既定 30）
 *
 * ⚠ 元にするのは データ/補助金_掲載済み.json（**サイトに実際に出ている一覧**）。
 *   生のJグランツから数え直さない。数え直すと、サイトの件数と投稿の件数が食い違う。
 */
import { createCanvas, GlobalFonts } from '@napi-rs/canvas'
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { 折る } from './OGP画像を作る.mjs'

const ここ = dirname(fileURLToPath(import.meta.url))
const 作業場 = join(ここ, '..')
GlobalFonts.registerFromPath(join(ここ, 'fonts', 'NotoSansJP-Bold.otf'), 'Noto Sans JP')
GlobalFonts.registerFromPath(join(ここ, 'fonts', 'NotoSansJP-Regular.otf'), 'Noto Sans JP')

/**
 * 1枚を書き出す。**組み立ての最後から呼ばれる**ので、
 * 締切が動けば絵も動く。人が思い出して打つ必要はない。
 * @param {number} [何日以内] 何日以内に締切のものを数えるか
 * @returns {string|null} 書いた先（作らなかったときは null）
 */
export function SNSの1枚を出す(何日以内 = 30) {

  const 幅 = 1080, 高 = 1920
  const 色 = { 地: '#ffffff', 墨: '#14201b', 灰: '#5a6a63', 線: '#dbe3de', 差し: '#0b6b5b', 薄: '#eef6f4', 急ぎ: '#8f2f33' }
  const 書体 = (太さ, px) => `${太さ} ${px}px "Noto Sans JP"`

  const 今日 = new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Tokyo' })
  const 残り = 締切 =>
    Math.round((new Date(締切 + 'T00:00:00+09:00') - new Date(今日 + 'T00:00:00+09:00')) / 86400000)

  const 一覧 = JSON.parse(readFileSync(join(作業場, 'データ', '補助金_掲載済み.json'), 'utf8')).掲載 ?? []
  const 受付中 = 一覧
    .filter(k => k.締切 && 残り(k.締切) >= 0)
    .sort((a, b) => new Date(a.締切) - new Date(b.締切))
  const 間近 = 受付中.filter(k => 残り(k.締切) <= 何日以内)

  if (!間近.length) {
    console.error(`${何日以内}日以内に締切のものがありません。1枚は作りません。`)
    return null
  }

  /** 上限額は0で入っていることがある。**0を「上限0円」と書かない**（未公表として扱う） */
  const 金額 = 円 => {
    if (!円) return '上限は未公表'
    if (円 >= 100_000_000) return `上限 ${(円 / 100_000_000).toFixed(円 % 100_000_000 ? 1 : 0)}億円`
    return `上限 ${Math.round(円 / 10_000).toLocaleString('ja-JP')}万円`
  }

  const c = createCanvas(幅, 高)
  const x = c.getContext('2d')
  x.fillStyle = 色.地; x.fillRect(0, 0, 幅, 高)

  // ── 上の帯：どこの誰が出しているか ──────────────────────────
  x.fillStyle = 色.差し; x.fillRect(0, 0, 幅, 132)
  x.fillStyle = '#ffffff'; x.font = 書体(700, 40)
  x.fillText('オフィスの選びかた', 64, 70)
  x.font = 書体(400, 26); x.fillStyle = '#cfe6df'
  x.fillText('中小企業の総務のための、補助金の締切一覧　毎朝更新', 64, 110)

  const 左 = 64
  let y = 132 + 96

  // ── 見出しと、いちばん大きい数字 ──────────────────────────
  x.fillStyle = 色.灰; x.font = 書体(400, 30)
  x.fillText(`${今日.replace(/-/g, '/')} 時点`, 左, y)
  y += 74
  x.fillStyle = 色.墨; x.font = 書体(700, 62)
  x.fillText(`あと${何日以内}日以内に`, 左, y); y += 78
  x.fillText('締切がくる補助金', 左, y); y += 40

  x.fillStyle = 色.差し; x.font = 書体(700, 168)
  const 件数 = String(間近.length)
  x.fillText(件数, 左, y + 150)
  const w = x.measureText(件数).width
  x.font = 書体(700, 52); x.fillText('件', 左 + w + 16, y + 150)
  y += 210

  x.fillStyle = 色.線; x.fillRect(左, y, 幅 - 左 * 2, 3)
  y += 72

  // ── 締切の近い順に6件 ───────────────────────────────────
  x.fillStyle = 色.墨; x.font = 書体(700, 34)
  x.fillText('締切がいちばん近いもの', 左, y)
  y += 56

  // 下の帯に食い込む手前で止める。件数を決め打ちにすると、名称が2行になった日だけ
  // 最後の1件が帯に切られる（**その日は誰も気づけない**）。
  const 帯の上 = 高 - 210 - 32
  for (const k of 間近.slice(0, 6)) {
    if (y + 160 > 帯の上) break
    const 日 = 残り(k.締切)
    const 急ぎ = 日 <= 7

    // 残り日数の札。7日以内だけ色を変える（毎行が赤いと、どれが急ぎか分からなくなる）
    const 札文 = 日 === 0 ? '今日' : `あと${日}日`
    x.font = 書体(700, 34)
    const 札幅 = x.measureText(札文).width + 36
    x.fillStyle = 急ぎ ? 色.急ぎ : 色.薄
    x.fillRect(左, y - 6, 札幅, 54)
    x.fillStyle = 急ぎ ? '#ffffff' : 色.差し
    x.fillText(札文, 左 + 18, y + 32)

    x.fillStyle = 色.灰; x.font = 書体(400, 30)
    x.fillText(`${k.地域 ?? k.対象地域 ?? '全国'}　${金額(k.上限額)}`, 左 + 札幅 + 20, y + 32)

    y += 72
    x.fillStyle = 色.墨; x.font = 書体(700, 38)
    for (const 行 of 折る(x, k.名称, 幅 - 左 * 2, 2)) { x.fillText(行, 左, y + 30); y += 52 }

    y += 24
    x.fillStyle = 色.線; x.fillRect(左, y, 幅 - 左 * 2, 1)
    y += 40
  }

  // ── 下の帯：出どころとURL。**ここが煽り文句の代わり** ──────────
  const 帯高 = 210 // ⚠ 上の「帯の上」と揃える
  x.fillStyle = 色.薄; x.fillRect(0, 高 - 帯高, 幅, 帯高)
  x.fillStyle = 色.差し; x.font = 書体(700, 40)
  x.fillText(`受付中の${受付中.length}件は、すべてこちらに`, 左, 高 - 帯高 + 68)
  x.font = 書体(700, 46); x.fillStyle = 色.墨
  x.fillText('soumu-choice.com', 左, 高 - 帯高 + 128)
  x.fillStyle = 色.灰; x.font = 書体(400, 26)
  x.fillText('出どころ：デジタル庁「Jグランツ」の公開データ（毎朝取り直しています）', 左, 高 - 帯高 + 172)

  const 出し先 = join(作業場, 'docs', 'ogp')
  if (!existsSync(出し先)) mkdirSync(出し先, { recursive: true })
  const 先 = join(出し先, 'sns-今週の締切.png')
  const 絵 = c.toBuffer('image/png')
  if (!existsSync(先) || !readFileSync(先).equals(絵)) writeFileSync(先, 絵)

  console.log(`SNSの1枚：docs/ogp/sns-今週の締切.png（${何日以内}日以内 ${間近.length}件／受付中 ${受付中.length}件）`)
  console.log('　そのまま X・Instagram・TikTok・Threads に投稿できます。')
  return 先

}

// 直に打たれたときだけ動く（import では動かない）
if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  const 引数 = name => { const i = process.argv.indexOf(name); return i > -1 ? process.argv[i + 1] : null }
  const 先 = SNSの1枚を出す(Number(引数('--日数') ?? 30))
  if (!先) process.exit(1)
}
