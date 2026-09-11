<#
  noteに貼る原稿を、欠けなくクリップボードへ載せる

  ── なぜ要るか ───────────────────────────────────────────────
  2026-08-31 に貼った下書き3本のうち2本が、貼り付けの途中で
  **半角の数字・アルファベット・改行・URLを全部落としていた**。
  7,869字の原稿が1,733字になり、補助金レポートから
  日付も金額も公式ページへのリンクも消えていた。
  失敗として現れない（保存は成功し、画面も壊れない）ので、
  **7日間、誰も気づかないまま下書きに座っていた。**

  そこで、載せた直後に**文字数と中身を検算**する。
  検算に通らないものは貼らない。

  ── 使い方 ───────────────────────────────────────────────────
    .\tools\noteに貼る準備.ps1 レポート     … 今月の補助金レポート（メンバー限定用）
    .\tools\noteに貼る準備.ps1 紹介         … メンバーシップの紹介（無料公開用）
    .\tools\noteに貼る準備.ps1 ホームページ … 補助金でホームページを作る（無料公開用）

  そのあと note のエディタで 本文を Ctrl+A → Ctrl+V。
  題名はこの画面に出るものをコピーして貼る。

  ⚠ 貼ったあと、**必ず目で見る。**日付・金額・リンクの3つ。
  ⚠ 公開のクリックは、必ずご本人が押してください。
#>
param([Parameter(Mandatory=$true)][string]$どれ)

$ここ = Split-Path -Parent $PSScriptRoot
$今月 = Get-Date -Format 'yyyy-MM'

switch -Wildcard ($どれ) {
  '*レポート*'     { $file = Join-Path $ここ "会員向け\${今月}_今月の補助金レポート_note用.txt"; $題名から本文 = $false }
  '*紹介*'         { $file = Join-Path $ここ '会員向け\00_紹介記事_無料公開.txt';                $題名から本文 = $true  }
  '*ホームページ*' { $file = Join-Path $ここ 'note原稿\01_補助金でホームページを作る.txt';        $題名から本文 = $true  }
  '*説明*'         { $file = Join-Path $ここ '会員向け\00_メンバーシップ説明_note用.txt';          $題名から本文 = $false }
  '*記事*'         {
      # 毎日の記事から自動で作られた note 用の下書きのうち、いちばん古い未投稿のもの。
      # ⚠ 古い順に出すこと。新しい順だと、いつまでも同じ数の在庫が残る。
      $候補 = Get-ChildItem (Join-Path $ここ 'note原稿') -Filter '20*.txt' -ErrorAction SilentlyContinue | Sort-Object Name
      if (-not $候補) {
        Write-Host "note用の下書きがありません。先に  node tools
oteの下書きを作る.mjs  を走らせてください。" -ForegroundColor Yellow
        exit 1
      }
      $file = $候補[0].FullName
      $題名から本文 = $true
      Write-Host ("在庫 {0}本。いちばん古いものを出します： {1}" -f $候補.Count, $候補[0].Name) -ForegroundColor Cyan
  }
  default { Write-Host "「レポート」「紹介」「ホームページ」「説明」「記事」のどれかを指定してください。" -ForegroundColor Yellow; exit 1 }
}

if (-not (Test-Path $file)) {
  Write-Host "見つかりません： $file" -ForegroundColor Red
  if ($どれ -like '*説明*') {
    Write-Host "先に  node tools\メンバーシップの説明を作る.mjs  を走らせてください。"
  } else {
    Write-Host "先に  node tools\会員向けの原稿を作る.mjs  を走らせてください。"
  }
  exit 1
}

$行 = Get-Content -Encoding UTF8 $file

# 1行目が題名になっているファイルは、本文から外す
if ($題名から本文) {
  $題名 = $行[0]
  $i = 1
  while ($i -lt $行.Length -and $行[$i].Trim() -eq '') { $i++ }
  $本文 = ($行[$i..($行.Length-1)]) -join "`n"
} else {
  $件数 = ($行 -join "`n") -replace '(?s).*?受付中：(\d+)件.*', '$1'
  $題名 = "今月の補助金レポート（${今月}号）｜受付中${件数}件を、締切の近い順に"
  $本文 = $行 -join "`n"
}

Set-Clipboard -Value $本文
$戻り = Get-Clipboard -Raw

Write-Host ""
Write-Host "── 題名（これをコピーして題名欄へ）───────────────" -ForegroundColor Cyan
Write-Host $題名
Write-Host ""
Write-Host "── 検算 ──────────────────────────────────────────" -ForegroundColor Cyan
$ok = $true
function 見る($名, $条件) {
  if ($条件) { Write-Host "  ○ $名" -ForegroundColor Green }
  else       { Write-Host "  × $名" -ForegroundColor Red; $script:ok = $false }
}
見る "クリップボードに載った（$($戻り.Length)文字）" ($戻り.Length -eq $本文.Length -and $本文.Length -gt 500)
見る "改行が残っている（$(($戻り -split "`n").Count)行）"  (($戻り -split "`n").Count -gt 5)
見る "半角の数字が残っている"                              ($戻り -match '\d')
見る "半角の英字が残っている"                              ($戻り -match '[A-Za-z]')
見る "A8のリンクが入っていない（noteでは貼らない）"        (-not ($戻り -match 'a8\.net|px\.a8|link-a\.net'))
if ($file -match 'レポート') {
  見る "公式ページへのリンクが残っている"                  ($戻り -match 'jgrants-portal\.go\.jp')
  見る "金額が残っている"                                  ($戻り -match '¥[0-9,]+')
}
Write-Host ""
if ($ok) {
  Write-Host "準備できました。noteのエディタで 本文を Ctrl+A → Ctrl+V。" -ForegroundColor Green
  Write-Host "貼ったあと、日付・金額・リンクの3つを目で見てください。" -ForegroundColor Green
  Write-Host "⚠ 公開のクリックは、必ずご本人が押してください。" -ForegroundColor Yellow
} else {
  Write-Host "検算に通りませんでした。この状態では貼らないでください。" -ForegroundColor Red
  exit 1
}
