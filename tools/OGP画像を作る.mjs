/* OGP画像を作る（1200×630のPNG。文字と数字だけで組む。写真なし・AIに描かせない・¥0）
 *
 * なぜ作ったか（2026-09-13 常務のご指摘）
 *   「今のクライアントは文字を読みたくない。画像・動画で理解したい」
 *   このサイトのページには og:image が無く、X・note・LINE に流れたとき**絵が出なかった**。
 *   絵が出ないリンクは、流れても止まらない。
 *
 * 方針
 *   ・主役は数字（締切まであと何日・上限額・地域）。単位は小さく添える
 *   ・写真もイラストも使わない。補助金の読者が知りたいのは「自社が対象か・いくら・いつまで」
 *   ・書体は同梱の Noto Sans JP（OFL）。GitHubのUbuntuでもWindowsでも同じ絵になる
 *   ・ページを組み立てるたびに描き直す（締切の残り日数が毎日変わるため）
 *
 * 使い方（他の道具から呼ぶ）
 *   import { OGP画像を出す } from './OGP画像を作る.mjs'
 *   OGP画像を出す({ 出し先, 名前: 'hojo-xxx', 題, 小見出し, 数字: [{ ラベル, 値, 単位 }], 帯 })
 *   → docs/ogp/<名前>.png を書き、'ogp/<名前>.png' を返す
 */
import { mkdirSync, writeFileSync, existsSync, readFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createCanvas, GlobalFonts } from '@napi-rs/canvas'

const ここ = dirname(fileURLToPath(import.meta.url))
GlobalFonts.registerFromPath(join(ここ, 'fonts', 'NotoSansJP-Bold.otf'), 'Noto Sans JP')
GlobalFonts.registerFromPath(join(ここ, 'fonts', 'NotoSansJP-Regular.otf'), 'Noto Sans JP')

const 幅 = 1200, 高 = 630
const 色 = { 地: '#ffffff', 墨: '#1c1c1e', 灰: '#6b6b70', 線: '#e3e3e6', 差し: '#0b6b5b', 薄: '#eef6f4' }
const 書体 = (太さ, px) => `${太さ} ${px}px "Noto Sans JP"`

/** 幅に収まるように折る。句読点のあとで折るのを先に試し、無理なら字で折る */
export function 折る(ctx, text, 最大幅, 最大行, 句読点で = true) {
  const 行 = []
  let 残り = String(text ?? '').replace(/\s+/g, ' ').trim()
  while (残り && 行.length < 最大行) {
    if (ctx.measureText(残り).width <= 最大幅) { 行.push(残り); 残り = ''; break }
    // 収まる最大の文字数を二分探索
    let lo = 1, hi = 残り.length
    while (lo < hi) { const mid = (lo + hi + 1) >> 1; if (ctx.measureText(残り.slice(0, mid)).width <= 最大幅) lo = mid; else hi = mid - 1 }
    let 切る = lo
    // 句読点・括弧閉じの直後で折れるなら、そこで
    const 手前 = 残り.slice(0, lo)
    const m = 手前.search(/[、。）」』】]\S*$/)
    if (句読点で && m > 0 && m + 1 >= lo * 0.5) 切る = m + 1
    // 行頭に句読点が来るのを避ける
    while (/^[、。）」』】]/.test(残り.slice(切る)) && 切る < 残り.length) 切る++
    行.push(残り.slice(0, 切る)); 残り = 残り.slice(切る)
  }
  if (残り && 行.length) 行[行.length - 1] = 行[行.length - 1].replace(/.{2}$/, '…')
  // 最後の行が2〜3字だけ（「ぶ」だけが次の行に落ちる）なら、句読点の優先をやめて折り直す
  if (句読点で && 行.length > 1 && 行[行.length - 1].length <= 3) return 折る(ctx, text, 最大幅, 最大行, false)
  return 行
}

/**
 * @param {object} p
 * @param {string} p.出し先  docs のパス
 * @param {string} p.名前    ファイル名（拡張子なし）
 * @param {string} p.題      大きく出す題
 * @param {string} [p.小見出し] 題の上に小さく（サイト名など）
 * @param {{ラベル:string, 値:string, 単位?:string}[]} [p.数字] 下段に最大3つ
 * @param {string} [p.帯]    いちばん下の1行（サイトの説明など）
 */
export function OGP画像を出す({ 出し先, 名前, 題, 小見出し = '', 数字 = [], 帯 = '' }) {
  const c = createCanvas(幅, 高)
  const x = c.getContext('2d')
  x.fillStyle = 色.地; x.fillRect(0, 0, 幅, 高)
  x.fillStyle = 色.差し; x.fillRect(0, 0, 幅, 14)              // 上の帯
  x.fillStyle = 色.墨

  const 左 = 72
  let y = 96
  if (小見出し) {
    x.font = 書体(400, 26); x.fillStyle = 色.灰
    x.fillText(小見出し, 左, y); y += 20
  }

  // 題：3行まで。数字が無ければ大きく、あれば少し小さく
  const 題px = 数字.length ? 54 : 62
  x.font = 書体(700, 題px); x.fillStyle = 色.墨
  const 行 = 折る(x, 題, 幅 - 左 * 2, 3)
  y += 題px
  for (const l of 行) { x.fillText(l, 左, y); y += 題px * 1.32 }

  // 数字：最大3つ、横並び。値を主役に、単位とラベルは小さく
  if (数字.length) {
    const top = 高 - 210
    x.fillStyle = 色.線; x.fillRect(左, top - 26, 幅 - 左 * 2, 2)
    const 列幅 = (幅 - 左 * 2) / Math.min(数字.length, 3)
    数字.slice(0, 3).forEach((n, i) => {
      const cx = 左 + 列幅 * i
      x.fillStyle = 色.灰; x.font = 書体(400, 24); x.fillText(n.ラベル, cx, top + 24)
      x.fillStyle = 色.墨; x.font = 書体(700, 64)
      const 値 = String(n.値)
      // 列幅に収まらない値は縮める
      let px = 64; while (px > 30 && x.measureText(値).width > 列幅 - 60) { px -= 4; x.font = 書体(700, px) }
      x.fillText(値, cx, top + 96)
      if (n.単位) { const w = x.measureText(値).width; x.font = 書体(400, 26); x.fillStyle = 色.灰; x.fillText(n.単位, cx + w + 10, top + 96) }
    })
  }

  // 下の帯
  if (帯) {
    x.fillStyle = 色.薄; x.fillRect(0, 高 - 70, 幅, 70)
    x.fillStyle = 色.差し; x.font = 書体(400, 24)
    x.fillText(折る(x, 帯, 幅 - 左 * 2, 1)[0] ?? '', 左, 高 - 27)
  }

  const dir = join(出し先, 'ogp')
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
  const 出力 = c.toBuffer('image/png')
  const 先 = join(dir, `${名前}.png`)
  // ⚠ 同じ絵なら触らない。毎朝の組み立てで全ページを描き直すので、変わっていない絵まで書くと git が毎日太る
  if (!existsSync(先) || !readFileSync(先).equals(出力)) writeFileSync(先, 出力)
  return `ogp/${名前}.png`
}
