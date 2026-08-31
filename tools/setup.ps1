# はじめの設定（1回だけ）
#
# この「副業サイト」フォルダの中身を、会社の作業場の外にコピーして、
# 新しいGitHubリポジトリとして送り出します。
#
# **会社の作業場ごと送りません。**会社の台帳・記憶・secrets が
# 一緒に外へ出てしまうためです。中身だけを、まっさらな場所に移します。

$ErrorActionPreference = 'Stop'
$ここ   = Split-Path -Parent $PSScriptRoot
$移す先 = Join-Path $env:USERPROFILE '副業サイト'

Write-Host ''
Write-Host '=== 副業サイト はじめの設定 ===' -ForegroundColor Cyan
Write-Host ''
Write-Host 'この作業でやること：'
Write-Host ('  1. ' + $ここ + ' の中身を')
Write-Host ('     ' + $移す先 + ' にコピーします')
Write-Host '  2. そこを新しいGitHubリポジトリとして送り出します'
Write-Host ''
Write-Host '先に、GitHubで空のリポジトリを1つ作っておいてください（README等は入れずに）。'
Write-Host '作ったら、そのURLをここに貼ってください。'
Write-Host '  例: https://github.com/あなたのID/office-choice.git'
Write-Host ''

$URL = Read-Host 'リポジトリのURL'
if ([string]::IsNullOrWhiteSpace($URL)) { Write-Host 'URLが空です。やめます。'; exit 1 }

if (Test-Path $移す先) {
  Write-Host ''
  Write-Host ('すでに ' + $移す先 + ' があります。') -ForegroundColor Yellow
  $答 = Read-Host '中身を上書きしてよいですか（yes と打つと進みます）'
  if ($答 -ne 'yes') { Write-Host 'やめます。'; exit 1 }
}

# コピー（node_modules と .git は持っていかない）
New-Item -ItemType Directory -Force -Path $移す先 | Out-Null
robocopy $ここ $移す先 /E /XD node_modules .git /NFL /NDL /NJH /NJS /NP | Out-Null
if ($LASTEXITCODE -ge 8) { Write-Host 'コピーに失敗しました。' -ForegroundColor Red; exit 1 }

Set-Location $移す先

if (-not (Test-Path (Join-Path $移す先 '.git'))) {
  git init -b main | Out-Null
}
git add -A
git commit -m "副業サイト：はじめの一式" 2>&1 | Out-Null
git remote remove origin 2>&1 | Out-Null
git remote add origin $URL

Write-Host ''
Write-Host '送り出しています…'
git push -u origin main
if ($LASTEXITCODE -ne 0) {
  Write-Host ''
  Write-Host '送り出しに失敗しました。URLと、GitHubへのログインをご確認ください。' -ForegroundColor Red
  Read-Host 'Enterで閉じます'
  exit 1
}

Write-Host ''
Write-Host '送れました。' -ForegroundColor Green
Write-Host ''
Write-Host 'このあと、GitHubの画面で2つだけ設定してください：'
Write-Host ''
Write-Host '  ① APIキーを預ける'
Write-Host '     Settings → Secrets and variables → Actions → New repository secret'
Write-Host '       名前: ANTHROPIC_API_KEY'
Write-Host '       値  : Anthropicのコンソールで作ったキー'
Write-Host ''
Write-Host '  ② サイトを公開する'
Write-Host '     Settings → Pages → Source: Deploy from a branch'
Write-Host '       Branch: main / フォルダ: /docs → Save'
Write-Host ''
Write-Host ('これから先の作業場所は ' + $移す先 + ' です。') -ForegroundColor Cyan
Write-Host '会社の作業場の中の「副業サイト」フォルダは、もう使いません。'
Write-Host ''
Read-Host 'Enterで閉じます'
