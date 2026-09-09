// 毎日書いている記事を、そのまま note に貼れる形へ変換する。
//
// ⚠ **なぜ要るか。**
//   毎日の記事はサイト（soumu-choice.com）にだけ出ていて、
//   お金が発生する場所＝noteのメンバーシップには何も流れていなかった。
//   記事は毎日増えるのに、売り場は2本のまま。読むものが無ければ人は来ない。
//
// ⚠ **noteには外から投稿する仕組みがない。**だから「貼るだけの形」まで自動で作る。
//   人がやるのは1日1回の貼り付けだけにする。
//
// ⚠ **記号を使わない。**noteの本文は貼り付けで壊れやすく、##や**は
//   そのまま文字として残る（2026-09-07に半角英数と改行が消えた実績あり）。
import { readFileSync, writeFileSync, readdirSync, existsSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';

const 記事置き場 = '記事';
const 出す先 = 'note原稿';
const サイト = 'https://soumu-choice.com';

if (!existsSync(出す先)) mkdirSync(出す先, { recursive: true });

const 既にある = new Set(
  readdirSync(出す先).filter((f) => f.endsWith('.txt')).map((f) => f.replace(/^\d{4}-\d{2}-\d{2}_/, '').replace(/\.txt$/, '')),
);

const 記事たち = readdirSync(記事置き場)
  .filter((f) => f.endsWith('.json'))
  .map((f) => JSON.parse(readFileSync(join(記事置き場, f), 'utf8')))
  .filter((a) => a.slug && !既にある.has(a.slug))
  .sort((a, b) => String(b.published ?? '').localeCompare(String(a.published ?? '')));

if (!記事たち.length) {
  console.log('新しく変換する記事はありません。');
  process.exit(0);
}

/** noteの本文にする。見出しは記号を使わず、行と余白で見せる。 */
function 組み立てる(a) {
  const 行 = [];
  if (a.lead) 行.push(a.lead.trim(), '');

  for (const s of a.sections ?? []) {
    if (s.heading) 行.push(`■ ${s.heading.trim()}`, '');
    if (s.body) 行.push(s.body.trim(), '');
  }

  if (a.checklist?.length) {
    行.push('■ 確認しておくこと', '');
    for (const c of a.checklist) 行.push(`・${String(c).trim()}`);
    行.push('');
  }

  if (a.faq?.length) {
    行.push('■ よくある質問', '');
    for (const f of a.faq) {
      行.push(`Q. ${String(f.q).trim()}`, `A. ${String(f.a).trim()}`, '');
    }
  }

  // 出どころを必ず添える。読んだ人がその場で確かめられるようにするため。
  行.push('---', '');
  行.push(`この記事の元ページ：${サイト}/kiji/${a.slug}/`, '');
  行.push(
    '補助金の締切カレンダーは、公開データから毎朝つくり直して無料で出しています。',
    `${サイト}/hojo/`,
    '',
    'メンバーシップでは、毎月1回、14日以内に締切が来るもの・先月には無かったもの・',
    '全国どこでも使えるものを選んでお届けします。制度の内容は言い換えません。',
    '',
  );
  return 行.join('\n').replace(/\n{3,}/g, '\n\n').trim() + '\n';
}

let 作った = 0;
for (const a of 記事たち) {
  const 日 = a.published ?? new Date(Date.now() + 9 * 3600 * 1000).toISOString().slice(0, 10);
  const 本文 = `${a.title}\n\n${組み立てる(a)}`;
  const 名 = `${日}_${a.slug}.txt`;
  writeFileSync(join(出す先, 名), 本文);
  console.log(`  ${名}（${[...本文].length}字）`);
  作った++;
}
console.log(`note用の下書きを ${作った}本 作りました。あとは貼るだけです。`);
