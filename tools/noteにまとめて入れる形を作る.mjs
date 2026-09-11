// 記事を、note のインポート機能が読める形（WordPress WXR .xml）にまとめる。
//
// ⚠ **なぜ要るか。**
//   noteには外から投稿するAPIが無い。1本ずつ貼るしかないと思っていたが、
//   note の「インポート」が WordPress形式(.xml) と MT形式(.txt) を受け付ける。
//   これなら **何本でも一度に入る**（入ったものは「下書き」になる）。
//   人がやるのは、ファイルを1回選ぶことと、公開ボタンだけになる。
//
// ⚠ **入るのは下書きまで。**公開のクリックは必ず人が押す。
//
// 使い方: node tools/noteにまとめて入れる形を作る.mjs
//   出来上がり: note原稿/note-import.xml
import { readFileSync, writeFileSync, readdirSync, existsSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';

const 記事置き場 = '記事';
const 出す先 = 'note原稿';
const サイト = 'https://soumu-choice.com';
const 書き手 = 'officechoice';

if (!existsSync(出す先)) mkdirSync(出す先, { recursive: true });

const 逃 = (s) =>
  String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
// CDATA の中では ]]> だけが危ない
const cdata = (s) => `<![CDATA[${String(s ?? '').replace(/\]\]>/g, ']]&gt;')}]]>`;

/** 記事のJSONを、noteが読めるHTMLにする。見出しはh2、箇条書きはul。 */
function 本文HTML(a) {
  const 出 = [];
  if (a.lead) 出.push(`<p>${逃(a.lead)}</p>`);

  for (const s of a.sections ?? []) {
    if (s.heading) 出.push(`<h2>${逃(s.heading)}</h2>`);
    if (s.body) {
      for (const 段 of String(s.body).split(/\n{2,}/)) {
        if (段.trim()) 出.push(`<p>${逃(段.trim())}</p>`);
      }
    }
  }

  if (a.checklist?.length) {
    出.push('<h2>確認しておくこと</h2>');
    出.push('<ul>' + a.checklist.map((c) => `<li>${逃(c)}</li>`).join('') + '</ul>');
  }

  if (a.faq?.length) {
    出.push('<h2>よくある質問</h2>');
    for (const f of a.faq) {
      出.push(`<p><strong>${逃(f.q)}</strong></p>`, `<p>${逃(f.a)}</p>`);
    }
  }

  // 出どころと、次に見てほしい場所。読んだ人がその場で確かめられるように。
  出.push('<hr />');
  出.push(`<p>この記事の元ページ：<a href="${サイト}/kiji/${逃(a.slug)}/">${サイト}/kiji/${逃(a.slug)}/</a></p>`);
  出.push(
    `<p>補助金の締切カレンダーは、公開データから毎朝つくり直して無料で出しています。` +
      `<a href="${サイト}/hojo/">${サイト}/hojo/</a></p>`,
  );
  出.push(
    '<p>メンバーシップでは、毎月1回、14日以内に締切が来るもの・先月には無かったもの・' +
      '全国どこでも使えるものを選んでお届けします。制度の内容は言い換えません。</p>',
  );
  return 出.join('\n');
}

const 記事たち = readdirSync(記事置き場)
  .filter((f) => f.endsWith('.json'))
  .map((f) => JSON.parse(readFileSync(join(記事置き場, f), 'utf8')))
  .filter((a) => a.slug && a.title)
  .sort((a, b) => String(a.published ?? '').localeCompare(String(b.published ?? '')));

if (!記事たち.length) {
  console.log('記事がありません。');
  process.exit(0);
}

const 品 = 記事たち.map((a, i) => {
  const 日 = `${a.published ?? '2026-01-01'} 07:00:00`;
  return `  <item>
    <title>${逃(a.title)}</title>
    <link>${サイト}/kiji/${逃(a.slug)}/</link>
    <pubDate>${new Date(`${a.published}T07:00:00+09:00`).toUTCString()}</pubDate>
    <dc:creator>${cdata(書き手)}</dc:creator>
    <guid isPermaLink="false">${サイト}/?p=${i + 1}</guid>
    <description></description>
    <content:encoded>${cdata(本文HTML(a))}</content:encoded>
    <excerpt:encoded>${cdata(a.description ?? '')}</excerpt:encoded>
    <wp:post_id>${i + 1}</wp:post_id>
    <wp:post_date>${cdata(日)}</wp:post_date>
    <wp:post_date_gmt>${cdata(日)}</wp:post_date_gmt>
    <wp:comment_status>${cdata('closed')}</wp:comment_status>
    <wp:ping_status>${cdata('closed')}</wp:ping_status>
    <wp:post_name>${cdata(a.slug)}</wp:post_name>
    <wp:status>${cdata('publish')}</wp:status>
    <wp:post_parent>0</wp:post_parent>
    <wp:menu_order>0</wp:menu_order>
    <wp:post_type>${cdata('post')}</wp:post_type>
    <wp:post_password>${cdata('')}</wp:post_password>
    <wp:is_sticky>0</wp:is_sticky>
  </item>`;
});

const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0"
  xmlns:excerpt="http://wordpress.org/export/1.2/excerpt/"
  xmlns:content="http://purl.org/rss/1.0/modules/content/"
  xmlns:wfw="http://wellformedweb.org/CommentAPI/"
  xmlns:dc="http://purl.org/dc/elements/1.1/"
  xmlns:wp="http://wordpress.org/export/1.2/">
<channel>
  <title>オフィスの選びかた</title>
  <link>${サイト}</link>
  <description>総務のための、契約前に確かめること</description>
  <pubDate>${new Date().toUTCString()}</pubDate>
  <language>ja</language>
  <wp:wxr_version>1.2</wp:wxr_version>
  <wp:base_site_url>${サイト}</wp:base_site_url>
  <wp:base_blog_url>${サイト}</wp:base_blog_url>
  <wp:author>
    <wp:author_id>1</wp:author_id>
    <wp:author_login>${cdata(書き手)}</wp:author_login>
    <wp:author_email>${cdata('')}</wp:author_email>
    <wp:author_display_name>${cdata('オフィスの選びかた')}</wp:author_display_name>
  </wp:author>
${品.join('\n')}
</channel>
</rss>
`;

const 出力 = join(出す先, 'note-import.xml');
writeFileSync(出力, xml);
console.log(`${出力} … ${記事たち.length}本 / ${Math.round(xml.length / 1024)}KB`);
console.log('note の「記事」→「インポート」→ WordPress (WXR形式 .xml) で、このファイルを選んでください。');
console.log('入ったものは下書きになります。公開のクリックはご本人が押してください。');
