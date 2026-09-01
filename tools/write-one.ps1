# 手で記事を1本作って、見た目を確かめる
#
# 毎週の自動投稿を待たずに、その場で1本書かせて、
# できたページをブラウザで開きます。公開はしません（手元で見るだけ）。

$ErrorActionPreference = 'Stop'
$作業場 = Split-Path -Parent $PSScriptRoot
Set-Location $作業場

# ─────────────────────────────────────────────────────────────
# ⚠ APIキーは、この窓（PowerShellのセッション）に置かないこと。
#
# 2026-09-01、ここで $env:ANTHROPIC_API_KEY に代入していたため、
# **同じ窓から claude を起動すると Claude Code がそのキーを拾い、
# サブスクではなくAPI従量課金に切り替わっていました。**
# しかも Claude Code は一度した承認を覚えるので、二度目からは黙って切り替わります。
#
# そこで、キーは**記事を書く処理にだけ**渡し、窓には残しません。
# （$env: に入れず、子プロセスの環境変数として渡す）
# ─────────────────────────────────────────────────────────────
$キー = $env:ANTHROPIC_API_KEY
if (-not $キー) {
  Write-Host ''
  Write-Host 'APIキーが見つかりません。' -ForegroundColor Yellow
  Write-Host 'Anthropicのコンソールで作ったキーを、ここに貼ってください。'
  Write-Host '（この処理の中だけで使い、窓には残しません）' -ForegroundColor DarkGray
  $安全 = Read-Host 'APIキー' -AsSecureString
  $キー = [Runtime.InteropServices.Marshal]::PtrToStringAuto(
    [Runtime.InteropServices.Marshal]::SecureStringToBSTR($安全))
  if ([string]::IsNullOrWhiteSpace($キー)) { Write-Host 'やめます。'; exit 1 }
}

if (-not (Test-Path (Join-Path $作業場 'node_modules'))) {
  Write-Host '部品を入れています（初回だけ、少し時間がかかります）…'
  npm install --no-audit --no-fund
}

Write-Host ''
Write-Host '記事を書いています…'

# 子プロセスにだけキーを渡す。この窓には残らない
$走らせる = {
  param($作業場, $キー, $台本)
  $env:ANTHROPIC_API_KEY = $キー
  Set-Location $作業場
  node $台本
  exit $LASTEXITCODE
}
$p = Start-Process powershell -PassThru -Wait -NoNewWindow -ArgumentList @(
  '-NoProfile', '-ExecutionPolicy', 'Bypass', '-Command',
  "& { `$env:ANTHROPIC_API_KEY = '$キー'; Set-Location '$作業場'; node 'tools/記事を作る.mjs'; exit `$LASTEXITCODE }"
)
$キー = $null   # 念のため、変数からも消す
if ($p.ExitCode -ne 0) { Read-Host 'Enterで閉じます'; exit 1 }

node "tools/サイトを組み立てる.mjs"

$入口 = Join-Path $作業場 'docs\index.html'
Write-Host ''
Write-Host 'できました。ブラウザで開きます。' -ForegroundColor Green
Start-Process $入口
Write-Host ''
Read-Host 'Enterで閉じます'
