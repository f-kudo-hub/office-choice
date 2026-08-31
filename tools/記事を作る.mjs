/**
//
// ⚠️ 構造化出力のスキーマで使えない書き方（2026-08-31 に2回つまずいた）
//    ・配列の maxItems は使えない（400 になる）
//    ・配列の minItems は 0 か 1 しか使えない
//    本数は description に日本語で書く。実際に本数を決めているのはそちら。
 * 記事を1本、自動で書く
 *
 * **何をするか。**
 * 設定.json のジャンルと、すでに書いた記事の題名一覧をAIに渡して、
 * 「まだ書いていない題材」をAI自身に選ばせ、そのまま1本書かせます。
 * 書けたものは 記事/<名前>.json に置くだけ。HTMLにするのは別の道具（サイトを組み立てる.mjs）です。
 *
 * **なぜ題材の一覧を持たないか。**
 * 題材リストを先に作ると、尽きた週に止まります。止まった週に誰も気づきません。
 * すでに書いた題名を渡して「これ以外を選べ」と言うほうが、放っておいても続きます。
 *
 * **Amazonのリンクについて。**
 * 設定.json の「Amazonトラッキングid」が空のあいだは、タグなしの検索リンクにします。
 * 空なのにアフィリエイトの表示だけ出すと、事実と違う表示になるためです。
 * IDを1行入れれば、次の組み立てから全記事に反映されます。
 *
 * 使い方：
 *   node tools/記事を作る.mjs
 *   node tools/記事を作る.mjs --本数=3
 */
import { readFileSync, writeFileSync, readdirSync, existsSync, mkdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import Anthropic from '@anthropic-ai/sdk'

const ここ = dirname(fileURLToPath(import.meta.url))
const 作業場 = join(ここ, '..')
const 記事置き場 = join(作業場, '記事')
const 設定 = JSON.parse(readFileSync(join(作業場, '設定.json'), 'utf8'))

const 引 = k => (process.argv.find(a => a.startsWith(`--${k}=`)) ?? '').split('=')[1]
const 本数 = Number(引('本数') ?? 設定['1回に作る記事数'] ?? 1)

if (!existsSync(記事置き場)) mkdirSync(記事置き場, { recursive: true })

// ── すでに書いたもの ───────────────────────────────────────────────
const 既存 = readdirSync(記事置き場)
  .filter(f => f.endsWith('.json'))
  .map(f => JSON.parse(readFileSync(join(記事置き場, f), 'utf8')))

const 既存の題名 = 既存.map(k => `- ${k.title}`).join('\n') || '（まだ1本もありません）'
const 既存のslug = new Set(既存.map(k => k.slug))

// ── AIに渡す「記事の形」 ──────────────────────────────────────────
const 記事の形 = {
  type: 'object',
  additionalProperties: false,
  required: ['slug', 'title', 'description', 'lead', 'sections', 'products', 'faq', 'checklist', 'tags'],
  properties: {
    slug: {
      type: 'string',
      description: '記事のURLになる英小文字とハイフンだけの短い名前。日本語・大文字・記号は不可。例: shredder-for-small-office',
      pattern: '^[a-z0-9-]+$'
    },
    title: { type: 'string', description: '記事の題名。30〜45文字。検索する人が実際に打ちそうな言葉を含める' },
    description: { type: 'string', description: '検索結果に出る要約。80〜120文字' },
    lead: { type: 'string', description: '冒頭の導入。3〜5文。「この記事を読むと何が決まるか」を先に言う' },
    sections: {
      type: 'array',
      description: '本文の節。**必ず4〜7個**作る。',
      minItems: 1,
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['heading', 'body'],
        properties: {
          heading: { type: 'string', description: '見出し。15〜30文字' },
          body: {
            type: 'string',
            description: '本文。段落は空行で区切る。箇条書きにしたい行は行頭に「・」を置く。1セクション300〜500文字。'
          }
        }
      }
    },
    products: {
      type: 'array',
      description: 'おすすめの分類。**必ず2〜4個**作る。',
      minItems: 1,
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['name', 'why', 'amazon_keyword', 'price_range'],
        properties: {
          name: { type: 'string', description: '商品の分類名。特定の型番は書かない（在庫切れで嘘になるため）。例: 業務用マイクロカットシュレッダー' },
          why: { type: 'string', description: 'どんな会社に向くか。2〜3文' },
          amazon_keyword: { type: 'string', description: 'Amazonの検索窓に入れる日本語の言葉。3〜6語' },
          price_range: { type: 'string', description: 'おおよその価格帯。例: 2万〜5万円' }
        }
      }
    },
    faq: {
      type: 'array',
      description: 'よくある質問。**必ず2〜4個**作る。',
      minItems: 1,
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['q', 'a'],
        properties: {
          q: { type: 'string' },
          a: { type: 'string', description: '2〜4文' }
        }
      }
    },
    checklist: {
      type: 'array',
      description: '買う前に確かめること。**必ず3〜6個**作る。',
      minItems: 1,
      items: { type: 'string', description: '買う前に確かめる1行。20〜40文字' }
    },
    tags: { type: 'array', description: '記事のタグ。**必ず2〜5個**作る。', minItems: 1, items: { type: 'string' } }
  }
}

const 書きかたのルール = `
あなたは、中小企業の総務を20年やってきた人です。売り込みではなく、失敗の避け方を書きます。

【対象ジャンル】
${設定.ジャンル}

【読者】
${設定.読者}

【すでに書いた記事の題名】
${既存の題名}

【今回すること】
上の題名と重ならない題材を1つ自分で選び、その記事を1本書いてください。

【守ること】
1. 特定の型番・メーカー名を「これを買え」と名指ししない。分類とえらび方を書く。
   型番は在庫切れ・後継機で必ず古くなり、古くなった記事は嘘になる。
2. 数字を断定しない。「約」「おおよそ」「〜程度」を使う。確かめていない数字は書かない。
3. 「No.1」「最強」「絶対」「必ず儲かる」は使わない（景品表示法）。
4. 実務でしか出てこない話を必ず1つ以上入れる。
   例：カタログに出ない継続費用、置き場所、廃棄のときの手間、社内の反対、稟議の通し方。
   これがない記事は誰の役にも立たないので、書く意味がない。
5. 読者が最後に「で、どうすればいいか」がわかる状態で終える。
6. 敬体（です・ます）。1文は短く。専門用語には必ず言い換えを添える。
7. 見出しだけ読んでも筋が通るようにする。
`.trim()

// ── 書く ──────────────────────────────────────────────────────────
const client = new Anthropic()

async function 一本書く(何本目) {
  const res = await client.messages.create({
    model: 設定.モデル ?? 'claude-opus-5',
    max_tokens: 16000,
    thinking: { type: 'adaptive' },
    system: 書きかたのルール,
    messages: [
      {
        role: 'user',
        content:
          何本目 === 0
            ? '記事を1本書いてください。'
            : '記事をもう1本書いてください。今回は前回とは別の切り口（別の道具・別の場面）にしてください。'
      }
    ],
    output_config: { format: { type: 'json_schema', schema: 記事の形 } }
  })

  if (res.stop_reason === 'refusal') {
    throw new Error(`AIが回答を控えました（${res.stop_details?.category ?? '理由不明'}）`)
  }

  const 文 = res.content.filter(b => b.type === 'text').map(b => b.text).join('')
  let 記事
  try {
    記事 = JSON.parse(文)
  } catch {
    throw new Error(`AIの返事をJSONとして読めませんでした：${文.slice(0, 300)}`)
  }

  // slug が重なったら後ろに番号を足す（上書きで過去記事を消さない）
  let slug = String(記事.slug || 'kiji').replace(/[^a-z0-9-]/g, '') || 'kiji'
  let n = 2
  const 元 = slug
  while (既存のslug.has(slug)) slug = `${元}-${n++}`
  記事.slug = slug
  既存のslug.add(slug)

  記事.published = new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Tokyo' })
  記事.model = 設定.モデル ?? 'claude-opus-5'

  writeFileSync(join(記事置き場, `${slug}.json`), JSON.stringify(記事, null, 2) + '\n', 'utf8')
  console.log(`書けました：${記事.title}  →  記事/${slug}.json`)
  return 記事
}

let 成功 = 0
for (let i = 0; i < 本数; i++) {
  try {
    await 一本書く(i)
    成功++
  } catch (e) {
    console.error(`${i + 1}本目で失敗：${e.message}`)
  }
}

if (成功 === 0) {
  console.error('1本も書けませんでした。')
  process.exit(1)
}
console.log(`${成功}本できました。`)
