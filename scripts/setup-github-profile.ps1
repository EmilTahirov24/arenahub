<#
  Prepares the GitHub profile in one command.

    powershell -ExecutionPolicy Bypass -File scripts\setup-github-profile.ps1

  It does five things:
    1. Writes the description, the site address and the topics on arenahub
    2. Makes the remaining public repos private (it lists them first)
    3. Creates the <user>/<user> repo that holds the profile README
    4. Uploads the README text there
    5. Fills in the profile fields: name, bio, location, website

  The profile README lives in docs/github-profile-README.md, versioned with the
  repo. While a REVIEW-REQUIRED note is still in that file the script does
  nothing and does not even ask for a token: the closing paragraph says what
  you are looking for, and you should be happy with it before it is published.

  IT DELETES NOTHING. Making a repo private can be undone, and no existing repo
  is replaced.

  The script prints what it is about to do and asks to go ahead:
    -WhatIf   shows the plan only, touches nothing
    -Yes      runs without asking

  A token copied from GitHub is already on the clipboard, so the script looks
  there first. The token is never printed in full and never written to a file.

  CREATE THE TOKEN LIKE THIS (it has to be a classic one: creating a repo and
  writing to the profile both need it)
    github.com/settings/tokens/new
    Note        arenahub-profile-setup
    Expiration  7 days
    Scopes      [x] repo    [x] user
    Generate token, then copy it

  DELETE THE TOKEN WHEN THIS IS DONE: github.com/settings/tokens
#>

param(
  [switch]$Yes,
  [switch]$WhatIf,
  [string]$ProfileReadme = (Join-Path (Split-Path $PSScriptRoot -Parent) "docs/github-profile-README.md")
)

$ErrorActionPreference = "Stop"
try { [Console]::OutputEncoding = [Text.Encoding]::UTF8 } catch {}

$repoName = "arenahub"
$description = "Bilingual (Azerbaijani/English) esports results and statistics platform for CS2, Dota 2, VALORANT and League of Legends."
$homepage = "https://arenahub-wheat.vercel.app"
$topics = @("esports", "nextjs", "typescript", "react", "prisma", "postgresql", "tailwindcss", "i18n", "azerbaijani", "playwright")
$bio = "I build and run ArenaHub, a bilingual esports statistics platform. Looking for a CS master's in Switzerland."
$location = "Azerbaijan"
$fullName = "Emil Tahirov"

# --- Profil README ---------------------------------------------------------

# Checked before anything else. Both failures here are free to find, and
# discovering them after a token exists means that token has to be revoked.
if (-not (Test-Path $ProfileReadme)) { throw "Profile README not found: $ProfileReadme" }

if ((Get-Content $ProfileReadme -Raw) -match "REVIEW-REQUIRED") {
  Write-Output ""
  Write-Output "STOPPED - the profile README still carries a REVIEW-REQUIRED note."
  Write-Output "  File: $ProfileReadme"
  Write-Output ""
  Write-Output "  The closing paragraph says what you are looking for. It goes on a"
  Write-Output "  public profile in the first person, so read it once and make sure it"
  Write-Output "  is what you would say out loud in an interview. Reword it if not."
  Write-Output "  When you are happy, delete the REVIEW-REQUIRED note and run this again."
  exit 1
}

# --- Token ----------------------------------------------------------------

function Get-Token {
  $clip = ""
  try { $clip = (Get-Clipboard -Raw) } catch {}
  if ($clip) { $clip = $clip.Trim() }

  if ($clip -and $clip -match '^(gh[ps]_[A-Za-z0-9]{20,}|github_pat_[A-Za-z0-9_]{20,})$') {
    $head = $clip.Substring(0, [Math]::Min(14, $clip.Length))
    Write-Output "A token was found on the clipboard: $head... ($($clip.Length) characters)"
    if ($Yes) {
      return $clip
    }
    $ok = Read-Host "Bunu isledek? (b/x)"
    if ($ok -match '^(b|y|)$') {
      return $clip
    }
  }

  Write-Output "Paste the token (what you type stays hidden):"
  $secure = Read-Host -AsSecureString
  $bstr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure)
  try {
    return [Runtime.InteropServices.Marshal]::PtrToStringBSTR($bstr).Trim()
  } finally {
    [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($bstr)
  }
}

$token = Get-Token
if (-not $token) { throw "No token was given." }

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
  throw "The token was not accepted. Scopes needed: repo and user."
}

$owner = $me.login
Write-Output "Signed in as: $owner"

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
Write-Output "  1. $repoName -> description, site address, $($topics.Count) topics"
Write-Output "  2. repos to make private: $($toPrivate.Count)"
foreach ($r in $toPrivate) {
  Write-Output "       - $($r.name)"
}
if ($profileRepo.Count -gt 0) {
  Write-Output "  3. $owner/$owner already exists; only the README is updated"
} else {
  Write-Output "  3. $owner/$owner will be created (the profile page)"
}
Write-Output "  4. profile README: $ProfileReadme"
Write-Output "  5. profile fields: name, bio, location, website"
Write-Output ""
Write-Output "Nothing is deleted. Making a repo private can be undone."

if ($WhatIf) {
  Write-Output ""
  Write-Output "-WhatIf: nothing was touched."
  exit 0
}

if (-not $Yes) {
  $go = Read-Host "Davam edek? (b/x)"
  if ($go -notmatch '^(b|y)$') {
    Write-Output "Stopped."
    exit 0
  }
}


# --- 1. Repo metadata -----------------------------------------------------

Write-Output ""
Invoke-GH PATCH "https://api.github.com/repos/$owner/$repoName" @{ description = $description; homepage = $homepage } | Out-Null
Write-Output "1/5  description and site address written"

Invoke-GH PUT "https://api.github.com/repos/$owner/$repoName/topics" @{ names = $topics } | Out-Null
Write-Output "     topics: $($topics -join ', ')"

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
Write-Output "2/5  made private: $done / $($toPrivate.Count)"

# --- 3. Profil repo-su ----------------------------------------------------

if ($profileRepo.Count -eq 0) {
  Invoke-GH POST "https://api.github.com/user/repos" @{ name = $owner; description = "Profile"; private = $false; auto_init = $true } | Out-Null
  Write-Output "3/5  $owner/$owner created"
  Start-Sleep -Seconds 3
} else {
  Write-Output "3/5  $owner/$owner already exists"
}

# --- 4. README ------------------------------------------------------------

$content = [Convert]::ToBase64String([IO.File]::ReadAllBytes($ProfileReadme))
$body = @{ message = "Profile README"; content = $content }
try {
  $existing = Invoke-GH GET "https://api.github.com/repos/$owner/$owner/contents/README.md"
  $body.sha = $existing.sha
} catch {}

$putOk = $false
foreach ($attempt in 1..3) {
  try {
    Invoke-GH PUT "https://api.github.com/repos/$owner/$owner/contents/README.md" $body | Out-Null
    $putOk = $true
    break
  } catch {
    Start-Sleep -Seconds 3
    try {
      $existing = Invoke-GH GET "https://api.github.com/repos/$owner/$owner/contents/README.md"
      $body.sha = $existing.sha
    } catch {}
  }
}
if (-not $putOk) { throw "The profile README was not uploaded." }
Write-Output "4/5  profile README uploaded"

# --- 5. Profil saheleri ---------------------------------------------------

Invoke-GH PATCH "https://api.github.com/user" @{ name = $fullName; bio = $bio; location = $location; blog = $homepage } | Out-Null
Write-Output "5/5  name, bio, location and website written"

# --- Son ------------------------------------------------------------------

Write-Output ""
Write-Output "Done. Check: https://github.com/$owner"
Write-Output ""
Write-Output "TWO THINGS ARE LEFT TO DO BY HAND:"
Write-Output "  * Pin ArenaHub. GitHub has no API for pinning, only the interface:"
Write-Output "      github.com/$owner -> Customize your pins -> arenahub -> Save"
Write-Output "  * Delete the token: github.com/settings/tokens"
