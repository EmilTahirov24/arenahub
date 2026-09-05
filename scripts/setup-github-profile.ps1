<#
  GitHub profilini bir əmrlə hazırlayır.

    powershell -ExecutionPolicy Bypass -File scripts\setup-github-profile.ps1

  Beş işi görür:
    1. arenahub repo-suna təsvir, sayt ünvanı və mövzular yazır
    2. Qalan public repo-ları private edir (siyahını əvvəlcə göstərir)
    3. Profil README-si üçün <istifadəçi>/<istifadəçi> repo-sunu yaradır
    4. Hazır README mətnini ora yükləyir
    5. Profil sahələrini doldurur: bio, yer, sayt

  HEÇ NƏ SİLMİR. Private etmək geri qaytarıla bilər, mövcud repo əvəz olunmur.

  Skript əvvəlcə nə edəcəyini yazır və təsdiq istəyir:
    -WhatIf   yalnız planı göstərir, heç nəyə toxunmur
    -Yes      sualsız işləyir

  Token GitHub-dan kopyalanmış halda mübadilə buferində olur, ona görə skript
  əvvəlcə oraya baxır. Token heç vaxt tam ekrana çıxmır və fayla yazılmır.

  TOKENİ BELƏ YARAT (klassik olmalıdır: repo yaratmaq və profil yazmaq lazımdır)
    github.com/settings/tokens/new
    Note        arenahub-profile-setup
    Expiration  7 days
    Scopes      [x] repo    [x] user
    Generate token, sonra kopyala

  İŞ BİTƏNDƏN SONRA TOKENİ SİL: github.com/settings/tokens
#>

param(
  [switch]$Yes,
  [switch]$WhatIf,
  [string]$ProfileReadme = "$env:USERPROFILE\Downloads\github-profile-README.md"
)

$ErrorActionPreference = "Stop"
try { [Console]::OutputEncoding = [Text.Encoding]::UTF8 } catch {}

$repoName = "arenahub"
$description = "Bilingual (Azerbaijani/English) esports results and statistics platform for CS2, Dota 2, VALORANT and League of Legends."
$homepage = "https://arenahub-wheat.vercel.app"
$topics = @("esports", "nextjs", "typescript", "react", "prisma", "postgresql", "tailwindcss", "i18n", "azerbaijani", "playwright")
$bio = "I build and run ArenaHub, a bilingual esports statistics platform. Looking for a CS master's in Switzerland."
$location = "Azerbaijan"

# --- Token ----------------------------------------------------------------

function Get-Token {
  $clip = ""
  try { $clip = (Get-Clipboard -Raw) } catch {}
  if ($clip) { $clip = $clip.Trim() }

  if ($clip -and $clip -match '^(gh[ps]_[A-Za-z0-9]{20,}|github_pat_[A-Za-z0-9_]{20,})$') {
    $head = $clip.Substring(0, [Math]::Min(14, $clip.Length))
    Write-Output "Mubadile buferinde token tapildi: $head... ($($clip.Length) simvol)"
    if ($Yes) {
      return $clip
    }
    $ok = Read-Host "Bunu isledek? (b/x)"
    if ($ok -match '^(b|y|)$') {
      return $clip
    }
  }

  Write-Output "Tokeni yapisdir (yazilan gizlenir):"
  $secure = Read-Host -AsSecureString
  $bstr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure)
  try {
    return [Runtime.InteropServices.Marshal]::PtrToStringBSTR($bstr).Trim()
  } finally {
    [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($bstr)
  }
}

$token = Get-Token
if (-not $token) { throw "Token verilmedi." }

$headers = @{
  Authorization          = "Bearer $token"
  Accept                 = "application/vnd.github+json"
  "X-GitHub-Api-Version" = "2022-11-28"
  "User-Agent"           = "arenahub-profile-setup"
}

function Invoke-GH {
  param([string]$Method, [string]$Url, $Body)
  $req = @{ Method = $Method; Uri = $Url; Headers = $headers; ContentType = "application/json" }
  if ($null -ne $Body) { $req.Body = ($Body | ConvertTo-Json -Depth 6 -Compress) }
  return Invoke-RestMethod @req
}

# --- Kimlik ---------------------------------------------------------------

Write-Output ""
try {
  $me = Invoke-GH GET "https://api.github.com/user"
} catch {
  throw "Token qebul olunmadi. Selahiyyetler: repo ve user."
}

$owner = $me.login
Write-Output "Giris: $owner"

# --- Plan -----------------------------------------------------------------

$allRepos = @()
$page = 1
while ($true) {
  $batch = @(Invoke-GH GET "https://api.github.com/user/repos?per_page=100&affiliation=owner&page=$page")
  if ($batch.Count -eq 0) { break }
  $allRepos += $batch
  if ($batch.Count -lt 100) { break }
  $page++
}

$toPrivate = @($allRepos | Where-Object {
  (-not $_.private) -and ($_.name -ne $repoName) -and ($_.name -ne $owner) -and (-not $_.fork)
})
$profileRepo = @($allRepos | Where-Object { $_.name -eq $owner })

Write-Output ""
Write-Output "PLAN"
Write-Output "  1. $repoName -> tesvir, sayt unvani, $($topics.Count) movzu"
Write-Output "  2. private edilecek repo: $($toPrivate.Count)"
foreach ($r in $toPrivate) {
  Write-Output "       - $($r.name)"
}
if ($profileRepo.Count -gt 0) {
  Write-Output "  3. $owner/$owner artiq var, yalniz README yenilenecek"
} else {
  Write-Output "  3. $owner/$owner yaradilacaq (profil sehifesi)"
}
Write-Output "  4. profil README: $ProfileReadme"
Write-Output "  5. profil saheleri: bio, yer, sayt"
Write-Output ""
Write-Output "Hec ne silinmir. Private etmek geri qaytarila biler."

if ($WhatIf) {
  Write-Output ""
  Write-Output "-WhatIf: hec neye toxunulmadi."
  exit 0
}

if (-not $Yes) {
  $go = Read-Host "Davam edek? (b/x)"
  if ($go -notmatch '^(b|y)$') {
    Write-Output "Dayandirildi."
    exit 0
  }
}

if (-not (Test-Path $ProfileReadme)) { throw "Profil README tapilmadi: $ProfileReadme" }

# --- 1. Repo metadata -----------------------------------------------------

Write-Output ""
Invoke-GH PATCH "https://api.github.com/repos/$owner/$repoName" @{ description = $description; homepage = $homepage } | Out-Null
Write-Output "1/5  tesvir ve sayt unvani yazildi"

Invoke-GH PUT "https://api.github.com/repos/$owner/$repoName/topics" @{ names = $topics } | Out-Null
Write-Output "     movzular: $($topics -join ', ')"

# --- 2. Kohne repo-lar private --------------------------------------------

$done = 0
foreach ($r in $toPrivate) {
  try {
    Invoke-GH PATCH "https://api.github.com/repos/$owner/$($r.name)" @{ private = $true } | Out-Null
    $done++
  } catch {
    Write-Warning "  $($r.name): $($_.Exception.Message)"
  }
}
Write-Output "2/5  private edildi: $done / $($toPrivate.Count)"

# --- 3. Profil repo-su ----------------------------------------------------

if ($profileRepo.Count -eq 0) {
  Invoke-GH POST "https://api.github.com/user/repos" @{ name = $owner; description = "Profile"; private = $false; auto_init = $true } | Out-Null
  Write-Output "3/5  $owner/$owner yaradildi"
  Start-Sleep -Seconds 3
} else {
  Write-Output "3/5  $owner/$owner artiq var"
}

# --- 4. README ------------------------------------------------------------

$content = [Convert]::ToBase64String([IO.File]::ReadAllBytes($ProfileReadme))
$body = @{ message = "Profile README"; content = $content }
try {
  $existing = Invoke-GH GET "https://api.github.com/repos/$owner/$owner/contents/README.md"
  $body.sha = $existing.sha
} catch {}

Invoke-GH PUT "https://api.github.com/repos/$owner/$owner/contents/README.md" $body | Out-Null
Write-Output "4/5  profil README yuklendi"

# --- 5. Profil saheleri ---------------------------------------------------

Invoke-GH PATCH "https://api.github.com/user" @{ bio = $bio; location = $location; blog = $homepage } | Out-Null
Write-Output "5/5  bio, yer ve sayt yazildi"

# --- Son ------------------------------------------------------------------

Write-Output ""
Write-Output "Bitdi. Yoxla: https://github.com/$owner"
Write-Output ""
Write-Output "IKI SEY EL ILE QALIR:"
Write-Output "  * ArenaHub-i pin et. GitHub-in pin API-si yoxdur, yalniz interfeysden:"
Write-Output "      github.com/$owner -> Customize your pins -> arenahub -> Save"
Write-Output "  * Tokeni sil: github.com/settings/tokens"
