# 手で記事を1本作って、見た目を確かめる
#
# 毎週の自動投稿を待たずに、その場で1本書かせて、
# できたページをブラウザで開きます。公開はしません（手元で見るだけ）。

$ErrorActionPreference = 'Stop'
$作業場 = Split-Path -Parent $PSScriptRoot
Set-Location $作業場

if (-not $env:ANTHROPIC_API_KEY) {
  Write-Host ''
  Write-Host 'APIキーが見つかりません。' -ForegroundColor Yellow
  Write-Host 'Anthropicのコンソールで作ったキーを、ここに貼ってください（この窓の中だけで使います）。'
  $キー = Read-Host 'APIキー'
  if ([string]::IsNullOrWhiteSpace($キー)) { Write-Host 'やめます。'; exit 1 }
  $env:ANTHROPIC_API_KEY = $キー
}

if (-not (Test-Path (Join-Path $作業場 'node_modules'))) {
  Write-Host '部品を入れています（初回だけ、少し時間がかかります）…'
  npm install --no-audit --no-fund
}

Write-Host ''
Write-Host '記事を書いています…'
node "tools/記事を作る.mjs"
if ($LASTEXITCODE -ne 0) { Read-Host 'Enterで閉じます'; exit 1 }

node "tools/サイトを組み立てる.mjs"

$入口 = Join-Path $作業場 'docs\index.html'
Write-Host ''
Write-Host 'できました。ブラウザで開きます。' -ForegroundColor Green
Start-Process $入口
Write-Host ''
Read-Host 'Enterで閉じます'
