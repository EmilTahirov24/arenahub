<#
  Changes the Gmail app password in the local .env and on Vercel, in one command.

    powershell -ExecutionPolicy Bypass -File scripts\rotate-smtp-password.ps1

  Why it exists: the 16-character password in use on 2026-08-05 ended up in a
  conversation, so it is no longer secret. Changing it touches two places - the
  local .env and Vercel Production - and if those two drift apart, the site
  stops sending mail without saying so.

  The order is deliberate: the password is tested LOCALLY FIRST, and only then
  goes to production. If the test fails, .env is restored and Vercel is not
  touched at all - pushing a wrong password to production is worse than the
  situation being fixed.

  At no step is the password printed, logged, or passed as an argument (an
  argument would be visible in the process list).

  FIRST: myaccount.google.com/apppasswords -> a new 16-character key.
  THEN:  run this script.
  LAST:  REVOKE the old key on that same page - the script cannot do it.
#>

param(
  # Where the test message goes. Left empty, SMTP_USER from .env is used:
  # sending to the account itself proves delivery without writing a personal
  # address into the script.
  [string]$To = "",

  # Runs without asking: takes the password from the clipboard. The owner copies
  # the key at Google, somebody else runs the script - and the password never
  # lands in a conversation, a log or an argument list. There is DELIBERATELY no
  # option to pass it as an argument: there, it would show in the process list.
  [switch]$Yes
)

$ErrorActionPreference = "Stop"
try { [Console]::OutputEncoding = [Text.Encoding]::UTF8 } catch {}

$repo = Split-Path $PSScriptRoot -Parent
$envFile = Join-Path $repo ".env"
$backup = Join-Path $repo ".env.bak"

if (-not (Test-Path $envFile)) { Write-Error ".env not found: $envFile" }

# --- 1. Get the password ------------------------------------------------------

$plain = $null

# The clipboard is checked first: the key arrives from Google by being copied.
# Pasting into a hidden field was confusing in practice - the screen stays blank
# and there is no sign the paste landed. The password is NOT PRINTED: only its
# first 4 letters and its length, which is enough for "did I copy the right one?".
$clip = ""
try { $clip = (Get-Clipboard -Raw -ErrorAction Stop) } catch {}
if ($clip) { $clip = ($clip -replace '\s', '') }

if ($clip -and $clip.Length -eq 16 -and $clip -match '^[a-z]{16}$') {
  Write-Output ""
  Write-Output "An app password was found on the clipboard:"
  Write-Output "  $($clip.Substring(0,4))············  (16 letters)"
  if ($Yes) {
    Write-Output "-Yes was given: this key is used."
    $plain = $clip
  } else {
    $istifade = Read-Host "Use this one? (y/n)"
    if ($istifade -eq "y" -or $istifade -eq "Y") { $plain = $clip }
  }
}

if (-not $plain -and $Yes) {
  Write-Error "There is no app password on the clipboard. Copy the key at Google (Ctrl+C) and run this again."
}

if (-not $plain) {
  Write-Output ""
  Write-Output "Paste the new Gmail app password (what you type stays hidden):"
  $secure = Read-Host -AsSecureString
  $bstr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure)
  try {
    $plain = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($bstr)
  } finally {
    [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($bstr)
  }
  # Google shows it as "abcd efgh ijkl mnop"; the spaces are not part of it.
  $plain = ($plain -replace '\s', '')
}

if ($plain.Length -ne 16 -or $plain -notmatch '^[a-z]{16}$') {
  Write-Error "That does not look like an app password: it has to be 16 lower-case letters with no spaces (length: $($plain.Length)). An ordinary Google password will not work."
}

# --- 2. Update .env -----------------------------------------------------------

Copy-Item $envFile $backup -Force
Write-Output "Backup: .env.bak"

# This works on the whole text so line endings and every other line stay as
# they are. The replacement is a script block: with a `$` in the password, a
# plain string replacement would read it as a group reference.
$text = [IO.File]::ReadAllText($envFile, [Text.Encoding]::UTF8)
$hits = ([regex]::Matches($text, '(?m)^SMTP_PASS=.*$')).Count
if ($hits -ne 1) {
  Remove-Item $backup -Force
  Write-Error "The SMTP_PASS line was found $hits times in .env - 1 was expected. Look by hand."
}
$updated = [regex]::Replace($text, '(?m)^SMTP_PASS=.*$', { "SMTP_PASS=$plain" })

# UTF-8 without a BOM: a BOM corrupts the first key in .env, and the encoding
# has to be kept for the Azerbaijani letters.
[IO.File]::WriteAllText($envFile, $updated, (New-Object Text.UTF8Encoding $false))
Write-Output ".env updated (the SMTP_PASS line only)"

function Restore-Env {
  Copy-Item $backup $envFile -Force
  Write-Output ""
  Write-Output ".env WAS RESTORED. Vercel was not touched."
}

# --- 3. Local test ------------------------------------------------------------

if (-not $To) {
  $m = [regex]::Match($updated, '(?m)^SMTP_USER=(.*)$')
  $To = $m.Groups[1].Value.Trim().Trim('"').Trim("'")
}
if (-not $To) { Restore-Env; Write-Error "No test address found. Pass one with -To." }

Write-Output ""
Write-Output "Local test: $To"
Push-Location $repo
try {
  & npx tsx scripts/check-email.ts --to $To
  $ok = ($LASTEXITCODE -eq 0)
} finally {
  Pop-Location
}

if (-not $ok) {
  Restore-Env
  Write-Output "Gmail did not accept the password. Create a new key and try again."
  exit 1
}

# --- 4. Vercel ----------------------------------------------------------------

Write-Output ""
Write-Output "Updating Vercel Production..."

# A PowerShell pipe is NOT USED: `$v | vercel env add` puts a U+FEFF in front
# of the value, Vercel accepts it, nothing warns, and Gmail returns
# `535 BadCredentials` at runtime. That is exactly what happened on 2026-08-05.
# An ASCII file writes no BOM, and cmd's redirection passes it through clean.
$tmp = Join-Path $env:TEMP ("smtp-" + [Guid]::NewGuid().ToString("N") + ".txt")
[IO.File]::WriteAllText($tmp, $plain, [Text.Encoding]::ASCII)

Push-Location $repo
try {
  & cmd /c "npx vercel env rm SMTP_PASS production --yes"
  & cmd /c "npx vercel env add SMTP_PASS production < `"$tmp`""
  $added = ($LASTEXITCODE -eq 0)
} finally {
  Pop-Location
  Remove-Item $tmp -Force -ErrorAction SilentlyContinue
}

if (-not $added) {
  Write-Output ""
  Write-Output "Vercel was not updated. .env IS CORRECT, but production is using the old password."
  Write-Output "By hand: npx vercel env add SMTP_PASS production"
  exit 1
}
Write-Output "Vercel updated (no BOM)"

# --- 5. Deploy ----------------------------------------------------------------

# The variable does not take effect without a deploy: the existing build carries
# the old value.
Write-Output ""
Write-Output "Deploying to production..."
Push-Location $repo
try {
  & npx vercel deploy --prod
  $deployed = ($LASTEXITCODE -eq 0)
} finally {
  Pop-Location
}

Write-Output ""
if ($deployed) {
  Write-Output "Done."
} else {
  Write-Output 'The deploy failed - run `npx vercel deploy --prod` by hand.'
}

Write-Output ""
Write-Output "Two steps remain, both of them yours:"
Write-Output "  1. Try \"forgot my password\" once on the live site - the mail should arrive."
Write-Output "  2. Revoke the OLD key: myaccount.google.com/apppasswords"
Write-Output "     Without that the leaked password still works and all of this was pointless."
Write-Output ""
Write-Output "If all is well, .env.bak can be deleted - it holds the old password."
