[CmdletBinding()]
param(
    [string]$Message = "",
    [string]$RemoteUrl = "",
    [switch]$NoPush,
    [switch]$DryRun,
    [switch]$SkipBuild
)

$ErrorActionPreference = "Continue"
$ProgressPreference = "SilentlyContinue"

try {
    [Console]::OutputEncoding = New-Object System.Text.UTF8Encoding $false
    $OutputEncoding = New-Object System.Text.UTF8Encoding $false
} catch {}

$Root = $PSScriptRoot
Set-Location $Root

function Write-Step([string]$Text) {
    Write-Host ""
    Write-Host "  $Text" -ForegroundColor Cyan
}

function Write-Ok([string]$Text) {
    Write-Host "  $Text" -ForegroundColor Green
}

function Write-Warn([string]$Text) {
    Write-Host "  $Text" -ForegroundColor Yellow
}

function Fail([string]$Text) {
    Write-Host ""
    Write-Host "  $Text" -ForegroundColor Red
    Write-Host ""
    exit 1
}

function Find-Executable([string]$Name, [string[]]$Fallbacks) {
    $command = Get-Command $Name -ErrorAction SilentlyContinue
    if ($command) { return $command.Source }
    foreach ($candidate in $Fallbacks) {
        if (Test-Path $candidate) { return $candidate }
    }
    return $null
}

function Invoke-Checked([string]$FilePath, [string[]]$Arguments, [string]$FailureMessage) {
    & $FilePath @Arguments
    if ($LASTEXITCODE -ne 0) {
        throw "$FailureMessage (exit $LASTEXITCODE)"
    }
}

function Invoke-GitProbe([string[]]$Arguments) {
    $previous = $ErrorActionPreference
    $ErrorActionPreference = "SilentlyContinue"
    try {
        $output = & $Git @Arguments 2>$null
        $code = $LASTEXITCODE
        return [pscustomobject]@{
            ExitCode = $code
            Output = ((@($output) -join "`n").Trim())
        }
    } catch {
        return [pscustomobject]@{ ExitCode = 1; Output = "" }
    } finally {
        $ErrorActionPreference = $previous
    }
}

Write-Host ""
Write-Host "  ┌─────────────────────────────────────────┐" -ForegroundColor DarkGray
Write-Host "  │  Lushio · 博客发布                       │" -ForegroundColor DarkGray
Write-Host "  └─────────────────────────────────────────┘" -ForegroundColor DarkGray

$Node = Find-Executable "node.exe" @(
    (Join-Path $env:ProgramFiles "nodejs\node.exe"),
    (Join-Path $env:LOCALAPPDATA "Programs\nodejs\node.exe"),
    (Join-Path ${env:ProgramFiles(x86)} "nodejs\node.exe")
)
$Git = Find-Executable "git.exe" @(
    (Join-Path $env:ProgramFiles "Git\cmd\git.exe"),
    (Join-Path $env:LOCALAPPDATA "Programs\Git\cmd\git.exe"),
    (Join-Path ${env:ProgramFiles(x86)} "Git\cmd\git.exe")
)

if (-not $Node) {
    Fail "没有找到 Node.js。请先安装 Node.js 18 或更高版本：https://nodejs.org/"
}
if (-not $Git) {
    Fail "没有找到 Git。请先安装 Git：https://git-scm.com/"
}

$nodeVersion = (& $Node --version) 2>$null
$gitVersion = (& $Git --version) 2>$null
Write-Host "  Node $nodeVersion   ·   $gitVersion" -ForegroundColor DarkGray

# ---------------------------------------------------------------------------
# Make sure this folder is a Git repository
# ---------------------------------------------------------------------------

Write-Step "检查 Git 仓库"

$insideRepo = $false
$repoProbe = Invoke-GitProbe @("rev-parse", "--is-inside-work-tree")
if ($repoProbe.ExitCode -eq 0 -and $repoProbe.Output -eq "true") {
    $insideRepo = $true
    $rootProbe = Invoke-GitProbe @("rev-parse", "--show-toplevel")
    $repoRoot = $rootProbe.Output
    $normalizedRoot = (Resolve-Path $Root).Path.TrimEnd('\', '/')
    $normalizedRepo = ""
    if ($repoRoot) {
        try { $normalizedRepo = [System.IO.Path]::GetFullPath($repoRoot).TrimEnd('\', '/') } catch { $normalizedRepo = $repoRoot }
    }
    if ($normalizedRepo -and $normalizedRepo -ne $normalizedRoot) {
        Write-Warn "当前目录不是仓库根目录（仓库根目录为 $repoRoot），继续使用当前目录。"
    }
}

if (-not $insideRepo) {
    Write-Host "  当前目录还不是 Git 仓库，正在初始化…"
    Invoke-Checked $Git @("init", "-b", "main") "Git 初始化失败"
    Write-Ok "已创建本地仓库（main 分支）"
}

$branchProbe = Invoke-GitProbe @("symbolic-ref", "--short", "HEAD")
$branch = $branchProbe.Output
if ($branchProbe.ExitCode -ne 0 -or -not $branch -or $branch -eq "HEAD") {
    Fail "无法确定当前分支。请确认仓库处于正常的 main 分支上。"
}
if ($branch -ne "main") {
    Fail "当前分支是 $branch，而 GitHub Actions 只监听 main。请先切换到 main：git switch main"
}

$hasHead = (Invoke-GitProbe @("rev-parse", "--verify", "HEAD")).ExitCode -eq 0

# ---------------------------------------------------------------------------
# Remote (optional on first run)
# ---------------------------------------------------------------------------

$hasRemote = $false
$originUrl = ""
$remoteProbe = Invoke-GitProbe @("remote", "get-url", "origin")
if ($remoteProbe.ExitCode -eq 0 -and $remoteProbe.Output) {
    $hasRemote = $true
    $originUrl = $remoteProbe.Output
}

if (-not $DryRun -and -not $NoPush -and -not $hasRemote) {
    Write-Step "连接 GitHub 仓库"
    Write-Host "  还没有配置远程仓库 origin。"
    Write-Host "  如果你已经在 GitHub 创建了仓库，把地址粘贴到下面。"
    Write-Host "  例如：https://github.com/lushio69/lushio69.github.io.git" -ForegroundColor DarkGray
    Write-Host ""

    if (-not $RemoteUrl -and [Environment]::UserInteractive) {
        $RemoteUrl = Read-Host "  仓库地址（直接回车则只做本地提交）"
    }

    if ($RemoteUrl) {
        Invoke-Checked $Git @("remote", "add", "origin", $RemoteUrl.Trim()) "添加远程仓库失败"
        $hasRemote = $true
        $originUrl = $RemoteUrl.Trim()
        Write-Ok "已连接 $originUrl"
    } else {
        Write-Warn "未配置远程仓库，本次只会构建并提交到本地。"
    }
}

if ($hasRemote) {
    Write-Host "  远程：$originUrl" -ForegroundColor DarkGray
}

# ---------------------------------------------------------------------------
# Pull latest source before building
# ---------------------------------------------------------------------------

if ($hasRemote -and -not $DryRun) {
    Write-Step "同步远程仓库"

    & $Git fetch origin
    if ($LASTEXITCODE -ne 0) {
        Write-Warn "无法连接远程仓库，跳过同步。稍后 push 时还会再尝试。"
    } else {
        $originBranchProbe = Invoke-GitProbe @("rev-parse", "--verify", "--quiet", "origin/$branch")
        if ($originBranchProbe.ExitCode -eq 0) {
            if (-not $hasHead) {
                Write-Host "  远程仓库已有初始提交，正在其基础上继续…"
                & $Git reset --soft "origin/$branch"
                if ($LASTEXITCODE -ne 0) {
                    Fail "无法基于远程仓库的初始提交继续。建议在 GitHub 新建一个空仓库（不要勾选 README）。"
                }
                $hasHead = $true
                Write-Ok "已基于远程提交继续"
            } else {
                $behindProbe = Invoke-GitProbe @("rev-list", "--count", "HEAD..origin/$branch")
                $behind = if ($behindProbe.Output) { [int]$behindProbe.Output } else { 0 }
                if ($behind -gt 0) {
                    Write-Host "  远程有 $behind 个新提交，先同步…"
                    & $Git pull --rebase --autostash origin $branch
                    if ($LASTEXITCODE -ne 0) {
                        Fail "同步远程提交失败。请手动解决冲突后重新运行。"
                    }
                    Write-Ok "已同步远程提交"
                } else {
                    Write-Ok "远程与本地一致"
                }
            }
        } else {
            Write-Host "  远程还没有 $branch 分支，将在发布时创建。"
        }
    }
}

# ---------------------------------------------------------------------------
# Build
# ---------------------------------------------------------------------------

if (-not $SkipBuild) {
    Write-Step "构建博客"
    & $Node (Join-Path $Root "scripts\build.mjs")
    if ($LASTEXITCODE -ne 0) {
        Fail "构建失败。请根据上面的错误修改内容后重试。"
    }
    & $Node (Join-Path $Root "scripts\check.mjs")
    if ($LASTEXITCODE -ne 0) {
        Fail "构建检查未通过：存在失效链接或缺失文件。"
    }
    Write-Ok "构建完成：dist/"
} else {
    Write-Warn "已跳过构建（-SkipBuild）"
}

if ($DryRun) {
    Write-Host ""
    Write-Ok "Dry run 完成，没有提交或推送。"
    Write-Host "  在浏览器打开 dist/index.html 可以查看构建结果。"
    Write-Host ""
    exit 0
}

# ---------------------------------------------------------------------------
# Commit
# ---------------------------------------------------------------------------

Write-Step "提交更改"

& $Git add -A
if ($LASTEXITCODE -ne 0) {
    Fail "git add 失败。"
}

& $Git diff --cached --quiet
$hasChanges = $LASTEXITCODE -ne 0

$committed = $false
if ($hasChanges) {
    if (-not $Message) {
        $Message = "post: 更新博客 $(Get-Date -Format 'yyyy-MM-dd HH:mm')"
    }
    & $Git commit -m $Message
    if ($LASTEXITCODE -ne 0) {
        Fail "git commit 失败。请检查 Git 用户名和邮箱是否已配置。"
    }
    $committed = $true
    $shortHash = (& $Git rev-parse --short HEAD).Trim()
    Write-Ok "已提交 $shortHash — $Message"
} else {
    Write-Host "  没有新的文件变化。"
}

# ---------------------------------------------------------------------------
# Push
# ---------------------------------------------------------------------------

if ($NoPush) {
    Write-Host ""
    Write-Ok "已完成本地构建和提交（-NoPush）。"
    Write-Host ""
    exit 0
}

if (-not $hasRemote) {
    Write-Host ""
    Write-Warn "本地内容已提交，但还没有远程仓库，无法发布。"
    Write-Host "  在 GitHub 新建仓库后，运行以下命令："
    Write-Host "    git remote add origin https://github.com/你的用户名/你的仓库.git" -ForegroundColor White
    Write-Host "    git push -u origin $branch" -ForegroundColor White
    Write-Host "  或者直接再次运行 publish.cmd，按提示粘贴仓库地址。"
    Write-Host ""
    exit 0
}

Write-Step "推送到 GitHub"

& $Git push -u origin $branch
if ($LASTEXITCODE -ne 0) {
    Write-Host ""
    Fail "推送失败。常见原因：没有登录 GitHub、网络不可用，或远程仓库还没有创建。`n  可以先在终端运行 git push -u origin $branch 查看详细提示。"
}

$siteConfig = $null
try {
    $siteConfig = Get-Content (Join-Path $Root "site.config.json") -Raw -Encoding UTF8 | ConvertFrom-Json
} catch {}

Write-Host ""
Write-Host "  ┌─────────────────────────────────────────┐" -ForegroundColor Green
Write-Host "  │  发布成功                               │" -ForegroundColor Green
Write-Host "  └─────────────────────────────────────────┘" -ForegroundColor Green
Write-Host "  分支：$branch"
if ($siteConfig -and $siteConfig.url) {
    Write-Host "  网站：$($siteConfig.url)" -ForegroundColor White
}
Write-Host "  GitHub Actions 会自动构建并部署，通常需要 1–2 分钟。"
Write-Host "  可以在仓库的 Actions 页面查看进度。"
Write-Host ""

exit 0
