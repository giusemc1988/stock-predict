<#
  Jarvis Dev: fix and upgrade Jarvis OS on this PC, even with no internet or when Claude is out of quota.
  Works in its own folder (C:\Users\<you>\jarvis-dev), never in the old stock-predict folder.
  Local AI: Aider + Ollama (qwen3-coder:30b). Changes go on a branch, never straight to main.

  Usage: jarvis.bat (menu), or  powershell -ExecutionPolicy Bypass -File jarvis-dev.ps1 <setup|run|fix|check|save|status>
  Windows PowerShell 5.1 compatible. Saved as UTF-8 with BOM so the Vietnamese text shows correctly.
#>
param([string]$Command = 'menu', [string]$Message = '')

# Continue, not Stop: git and npm write progress to stderr, which Stop would turn into errors on PowerShell 5.1
$ErrorActionPreference = 'Continue'
try { [Console]::OutputEncoding = [System.Text.Encoding]::UTF8 } catch {}

$Repo   = 'https://github.com/giusemc1988/stock-predict.git'
$Home2  = [Environment]::GetFolderPath('UserProfile')
$Dir    = Join-Path $Home2 'jarvis-dev'
$Old    = Join-Path $Home2 'stock-predict'
$Model  = 'qwen3-coder:30b'
$Ollama = 'http://127.0.0.1:11434'
# Aider lives in its own Python environment outside the code folder.
$Venv   = Join-Path $Home2 '.jarvis-aider'
$AiderExe = Join-Path $Venv 'Scripts\aider.exe'

function Title($en, $vi) { Write-Host ''; Write-Host "== $en ==" -ForegroundColor Cyan; Write-Host "   $vi" -ForegroundColor DarkCyan }
function Ok($en, $vi)    { Write-Host "  [OK]   $en" -ForegroundColor Green; Write-Host "         $vi" -ForegroundColor DarkGreen }
function Warn($en, $vi)  { Write-Host "  [!]    $en" -ForegroundColor Yellow; Write-Host "         $vi" -ForegroundColor DarkYellow }
function Bad($en, $vi)   { Write-Host "  [X]    $en" -ForegroundColor Red; Write-Host "         $vi" -ForegroundColor DarkRed }
function Has($exe)       { return [bool](Get-Command $exe -ErrorAction SilentlyContinue) }
function HasAider        { return (Test-Path $AiderExe) -or (Has 'aider') }
function AiderCmd        { if (Test-Path $AiderExe) { return $AiderExe } return 'aider' }

# Surface Pro 11 (Windows on ARM): some of Aider's Python parts have no ARM build, so prefer the
# x64 Python (it runs under Windows' built-in emulation). x64 installs to Python312, ARM64 to Python312-arm64.
function PickPython {
  if ($env:LOCALAPPDATA) {
    $x64 = Join-Path $env:LOCALAPPDATA 'Programs\Python\Python312\python.exe'
    if (Test-Path $x64) { return $x64 }
  }
  if (Has 'py') { $p = (py -3.12 -c 'import sys;print(sys.executable)' 2>$null); if ($p) { return $p.Trim() } }
  if (Has 'python') { return (Get-Command python).Source }
  return $null
}
function IsArm { return $env:PROCESSOR_ARCHITECTURE -eq 'ARM64' -or $env:PROCESSOR_ARCHITEW6432 -eq 'ARM64' }

function Online {
  try { $null = Invoke-WebRequest -Uri 'https://github.com' -Method Head -UseBasicParsing -TimeoutSec 5; return $true } catch { return $false }
}
function OllamaUp {
  try { $null = Invoke-RestMethod -Uri "$Ollama/api/tags" -TimeoutSec 3; return $true } catch { return $false }
}
function HasModel {
  try { $t = Invoke-RestMethod -Uri "$Ollama/api/tags" -TimeoutSec 3; return [bool]($t.models | Where-Object { $_.name -eq $Model }) } catch { return $false }
}
function InRepo {
  if (-not (Test-Path (Join-Path $Dir '.git'))) {
    Bad 'Jarvis Dev is not set up yet. Choose 1 (Setup) first.' 'Chưa cài Jarvis Dev. Chọn 1 (Cài đặt) trước.'
    return $false
  }
  Set-Location $Dir
  return $true
}
function Branch { return (git rev-parse --abbrev-ref HEAD).Trim() }

# Work never happens on main: start (or keep) an offline-YYYYMMDD-HHMM branch.
function WorkBranch {
  $b = Branch
  if ($b -eq 'main') {
    if (Online) { git pull --ff-only --quiet 2>&1 | Out-Host }
    $b = 'offline-' + (Get-Date -Format 'yyyyMMdd-HHmm')
    git switch -c $b --quiet 2>&1 | Out-Host
    Ok "New work branch: $b" "Nhánh làm việc mới: $b"
  }
  return $b
}

function Do-Setup {
  Title 'Setup (one time)' 'Cài đặt (làm một lần)'
  $missing = @()
  if (Has 'git')  { Ok 'Git found' 'Có Git' }       else { $missing += 'Git.Git' }
  if (Has 'node') { Ok 'Node.js found' 'Có Node.js' } else { $missing += 'OpenJS.NodeJS.LTS' }
  if (IsArm) { Ok 'Windows on ARM detected (Surface Pro 11)' 'Máy Windows ARM (Surface Pro 11)' }
  if (Has 'ollama') { Ok 'Ollama found' 'Có Ollama' } else { $missing += 'Ollama.Ollama' }
  if ($missing.Count) {
    Bad 'Some programs are missing. Install them, close this window, then run Setup again:' 'Thiếu chương trình. Cài xong, đóng cửa sổ này, rồi chạy lại Cài đặt:'
    foreach ($m in $missing) { Write-Host "         winget install $m" -ForegroundColor White }
    return
  }

  if (Test-Path (Join-Path $Dir '.git')) {
    Ok "Code folder already there: $Dir" "Đã có thư mục code: $Dir"
  } elseif (Online) {
    Write-Host "  Downloading the code to $Dir (a GitHub sign-in window may open)..." -ForegroundColor Gray
    git clone $Repo $Dir 2>&1 | Out-Host
    Ok "Code downloaded to $Dir" "Đã tải code về $Dir"
  } else {
    Bad 'No internet. Setup needs internet once to download the code.' 'Không có mạng. Cài đặt cần mạng một lần để tải code.'
    return
  }
  Set-Location $Dir

  Write-Host '  Installing app packages (npm install)...' -ForegroundColor Gray
  npm install --no-audit --no-fund
  Ok 'App packages installed' 'Đã cài gói cho app'

  if (-not (OllamaUp)) { Start-Process 'ollama' 'serve' -WindowStyle Hidden; Start-Sleep 3 }
  if (HasModel) { Ok "AI model ready: $Model" "Model AI sẵn sàng: $Model" }
  elseif (Online) { Write-Host "  Downloading $Model (about 19 GB, one time)..." -ForegroundColor Gray; ollama pull $Model }
  else { Warn "Model $Model missing; run Setup again when online." "Thiếu model $Model; chạy lại Cài đặt khi có mạng." }

  if (HasAider) { Ok 'Aider (AI coder) found' 'Có Aider (AI viết code)' }
  elseif (Online) {
    $py = PickPython
    if (-not $py) {
      Bad 'Python 3.12 is needed for Aider. Install it, then run Setup again:' 'Cần Python 3.12 cho Aider. Cài xong rồi chạy lại Cài đặt:'
      if (IsArm) { Write-Host '         winget install Python.Python.3.12 --architecture x64' -ForegroundColor White }
      else { Write-Host '         winget install Python.Python.3.12' -ForegroundColor White }
      return
    }
    Write-Host "  Installing Aider (AI coder) with $py ..." -ForegroundColor Gray
    & $py -m venv $Venv 2>&1 | Out-Host
    & (Join-Path $Venv 'Scripts\python.exe') -m pip install --upgrade pip aider-chat 2>&1 | Out-Host
    if (Test-Path $AiderExe) { Ok 'Aider installed' 'Đã cài Aider' }
    else {
      Bad 'Aider did not install.' 'Cài Aider không được.'
      if (IsArm) {
        Warn 'On this ARM Surface, install the x64 Python, then run Setup again:' 'Trên Surface ARM này, cài Python bản x64 rồi chạy lại Cài đặt:'
        Write-Host '         winget install Python.Python.3.12 --architecture x64' -ForegroundColor White
        Write-Host "         (then delete the folder $Venv / rồi xóa thư mục $Venv)" -ForegroundColor White
      }
      return
    }
  } else { Warn 'Aider missing; run Setup again when online.' 'Thiếu Aider; chạy lại Cài đặt khi có mạng.' }

  if (Test-Path $Old) { Warn "Your old folder $Old is not touched." "Thư mục cũ $Old không bị đụng tới." }
  Ok 'Setup finished. Next: 2 (Run the app) or 3 (Fix with AI).' 'Cài xong. Tiếp theo: 2 (Mở app) hoặc 3 (Sửa bằng AI).'
}

function Do-Run {
  if (-not (InRepo)) { return }
  Title 'Run the app' 'Mở app'
  Write-Host '  Opening http://localhost:5173 . Close this window to stop the app.' -ForegroundColor Gray
  Write-Host '  Đang mở http://localhost:5173 . Đóng cửa sổ này để tắt app.' -ForegroundColor DarkGray
  Start-Process 'http://localhost:5173'
  npm run dev
}

function Do-Check {
  if (-not (InRepo)) { return $false }
  Title 'Check (tests + build)' 'Kiểm tra (test + build)'
  # Out-Host keeps npm's output on screen and out of this function's return value
  npm test | Out-Host
  $t = $LASTEXITCODE
  npm run build | Out-Host
  $b = $LASTEXITCODE
  if ($t -eq 0 -and $b -eq 0) { Ok 'PASS: tests and build are green.' 'ĐẠT: test và build đều xanh.'; return $true }
  Bad 'FAIL: read the red lines above, or choose 3 and paste them to the AI.' 'LỖI: đọc dòng đỏ phía trên, hoặc chọn 3 rồi dán cho AI.'
  return $false
}

function Do-Fix {
  if (-not (InRepo)) { return }
  Title 'Fix or upgrade with local AI' 'Sửa hoặc nâng cấp bằng AI trên máy'
  if (-not (HasAider)) { Bad 'Aider is not installed. Choose 1 (Setup).' 'Chưa cài Aider. Chọn 1 (Cài đặt).'; return }
  if (-not (OllamaUp)) { Start-Process 'ollama' 'serve' -WindowStyle Hidden; Start-Sleep 3 }
  if (-not (HasModel)) { Bad "Model $Model is missing. Choose 1 (Setup) when online." "Thiếu model $Model. Chọn 1 (Cài đặt) khi có mạng."; return }
  $b = WorkBranch
  Write-Host ''
  Write-Host '  Type what you want in plain words, e.g. "the Wi-Fi page button is too small".' -ForegroundColor Gray
  Write-Host '  Gõ điều anh muốn bằng lời thường, ví dụ "nút ở trang Wi-Fi nhỏ quá".' -ForegroundColor DarkGray
  Write-Host '  Type /exit when done, then choose 4 (Check) and 5 (Save).' -ForegroundColor Gray
  Write-Host '  Gõ /exit khi xong, rồi chọn 4 (Kiểm tra) và 5 (Lưu).' -ForegroundColor DarkGray
  $env:OLLAMA_API_BASE = $Ollama
  & (AiderCmd) --model "ollama_chat/$Model" --read AGENTS.md --no-auto-commits --test-cmd 'npm test' --no-show-model-warnings
}

function Do-Save {
  if (-not (InRepo)) { return }
  Title 'Save my changes' 'Lưu thay đổi'
  $b = WorkBranch
  if (-not (git status --porcelain)) { Ok 'Nothing new to save.' 'Không có gì mới để lưu.' }
  else {
    if (-not (Do-Check)) {
      Warn 'Tests failed. Saving anyway on your branch so nothing is lost (it is NOT sent to main).' 'Test lỗi. Vẫn lưu vào nhánh của anh để không mất (KHÔNG đưa vào main).'
    }
    if (-not $Message) { $Message = Read-Host '  Short note about this change / Ghi chú ngắn' }
    if (-not $Message) { $Message = 'Offline fix' }
    git add -A
    git commit -m "Offline: $Message" --quiet 2>&1 | Out-Host
    Ok "Saved on branch $b" "Đã lưu vào nhánh $b"
  }
  if ($b -eq 'main') { Bad 'Refusing to push main.' 'Không đẩy lên main.'; return }
  if (Online) {
    git push -u origin $b --quiet 2>&1 | Out-Host
    if ($LASTEXITCODE -ne 0) { Bad 'Push failed (sign-in?). Your work is still saved on this PC.' 'Gửi lên thất bại (cần đăng nhập?). Bài làm vẫn lưu trên máy.'; return }
    Ok "Sent to GitHub as branch $b. Open a pull request there (or ask Claude), then you merge it." "Đã gửi lên GitHub thành nhánh $b. Mở pull request ở đó (hoặc nhờ Claude), rồi anh merge."
  } else {
    Warn 'No internet: kept on this PC. Choose 5 again when online to send it.' 'Không có mạng: giữ trên máy. Có mạng thì chọn 5 lần nữa để gửi.'
  }
}

function Do-Status {
  Title 'Status' 'Tình trạng'
  if (Online) { Ok 'Internet: online' 'Mạng: có' } else { Warn 'Internet: offline (local AI still works)' 'Mạng: không có (AI trên máy vẫn chạy)' }
  if (OllamaUp) { Ok 'Ollama: running' 'Ollama: đang chạy' } else { Warn 'Ollama: not running (starts when needed)' 'Ollama: chưa chạy (tự bật khi cần)' }
  if (HasModel) { Ok "Model: $Model" "Model: $Model" } else { Warn "Model ${Model}: missing" "Model ${Model}: chưa có" }
  if (HasAider) { Ok 'Aider: installed' 'Aider: đã cài' } else { Warn 'Aider: not installed' 'Aider: chưa cài' }
  if (Test-Path (Join-Path $Dir '.git')) {
    Set-Location $Dir
    $n = @(git status --porcelain).Count
    Ok "Folder: $Dir, branch $(Branch), $n changed file(s)" "Thư mục: $Dir, nhánh $(Branch), $n file đã đổi"
  } else { Warn 'Code folder: not set up' 'Thư mục code: chưa cài' }
}

function Menu {
  while ($true) {
    Write-Host ''
    Write-Host '  ╭──────────────────────────────────────────╮' -ForegroundColor DarkCyan
    Write-Host '  │  JARVIS DEV  ·  offline fix & upgrade     │' -ForegroundColor Cyan
    Write-Host '  ╰──────────────────────────────────────────╯' -ForegroundColor DarkCyan
    Write-Host '   1  Setup (one time)        Cài đặt (một lần)'
    Write-Host '   2  Run the app             Mở app'
    Write-Host '   3  Fix with AI             Sửa bằng AI'
    Write-Host '   4  Check                   Kiểm tra'
    Write-Host '   5  Save                    Lưu'
    Write-Host '   6  Status                  Tình trạng'
    Write-Host '   0  Exit                    Thoát'
    $c = Read-Host '  Choose / Chọn'
    switch ($c) {
      '1' { Do-Setup } '2' { Do-Run } '3' { Do-Fix } '4' { $null = Do-Check } '5' { Do-Save } '6' { Do-Status }
      '0' { return }
      default { Warn 'Type a number from the list.' 'Gõ một số trong danh sách.' }
    }
  }
}

switch ($Command) {
  'setup'  { Do-Setup }
  'run'    { Do-Run }
  'fix'    { Do-Fix }
  'check'  { if (-not (Do-Check)) { exit 1 } }
  'save'   { Do-Save }
  'status' { Do-Status }
  default  { Menu }
}
