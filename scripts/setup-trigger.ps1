<#
  Sets up the import trigger in one command.

    powershell -ExecutionPolicy Bypass -File scripts\setup-trigger.ps1

  It does three things in order, and stops if the first one fails:
    1. Asks for the token and writes it to `scripts\.github-token`
    2. Sends one test request - so a bad token is known immediately
    3. Registers the Windows task only once that test passes

  Why in that order: these three steps used to be separate, and a wrong token
  only surfaced after the task was registered, in the log - which is to say,
  never.

  A token copied from GitHub is already on the clipboard, so the script looks
  there first: nothing to type, only to confirm. If the clipboard is empty a
  hidden field opens (`Read-Host -AsSecureString` conceals what is typed).

  At no step is the whole token printed - only its first 14 characters and its
  length. The file is in `.gitignore` and never reaches the repo.

  Create the token like this:
    github.com/settings/personal-access-tokens -> Generate new token
    Repository access -> Only select repositories -> arenahub
    Permissions -> Repository -> Actions: Read and write
#>

param(
  # Runs without asking: takes the token from the clipboard and does not ask
  # for confirmation. The owner copies the token, somebody else (an assistant,
  # say) runs the setup - and the key never lands in a conversation, a log or
  # an argument list. It must not be passed as an argument: it would be visible
  # in the process list.
  [switch]$Yes
)

$ErrorActionPreference = "Stop"
try { [Console]::OutputEncoding = [Text.Encoding]::UTF8 } catch {}

$tokenFile = Join-Path $PSScriptRoot ".github-token"
$trigger = Join-Path $PSScriptRoot "trigger-import.ps1"
# The registered name of the Windows task. It stays in Azerbaijani on purpose:
# it is an identifier that already exists in Task Scheduler on the machine that
# runs this. Renaming it here would not rename the registered task - it would
# register a SECOND one, and the import would fire twice every 20 minutes.
$taskName = "ArenaHub idxal tetikleyicisi"

# --- 1. Token -------------------------------------------------------------

if (Test-Path $tokenFile) {
  Write-Output "A token file already exists: $tokenFile"
  if ($Yes) {
    Write-Output "-Yes was given: the existing file is kept."
  } else {
    $again = Read-Host "Write a new one? (y/n)"
    if ($again -eq "y" -or $again -eq "Y") { Remove-Item $tokenFile -Force }
  }
}

if (-not (Test-Path $tokenFile)) {
  $plain = $null

  # The clipboard is checked first. The reason is simple: a token arrives from
  # GitHub by being copied, so it is already there. Pasting into a hidden field
  # was confusing - the screen stays blank and there is no sign the paste
  # landed. Here there is nothing to type, only to confirm.
  #
  # The token itself is NOT PRINTED: only its first 14 characters and its
  # length, which is enough to answer "did I copy the right one?".
  $clip = ""
  try { $clip = (Get-Clipboard -Raw -ErrorAction Stop) } catch {}
  if ($clip) { $clip = $clip.Trim() }

  if ($clip -and ($clip.StartsWith("github_pat_") -or $clip.StartsWith("ghp_"))) {
    $onIki = $clip.Substring(0, [Math]::Min(14, $clip.Length))
    Write-Output ""
    Write-Output "A token was found on the clipboard:"
    Write-Output "  $onIki...  ($($clip.Length) characters)"
    if ($Yes) {
      Write-Output "-Yes was given: this token is used."
      $plain = $clip
    } else {
      $istifade = Read-Host "Use this one? (y/n)"
      if ($istifade -eq "y" -or $istifade -eq "Y") { $plain = $clip }
    }
  }

  if (-not $plain -and $Yes) {
    Write-Error "There is no token on the clipboard. Copy it (Ctrl+C) and run this again."
  }

  if (-not $plain) {
    Write-Output ""
    Write-Output "Paste the GitHub token (Ctrl+V, then Enter - what you type stays hidden):"
    $secure = Read-Host -AsSecureString
    $bstr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure)
    try {
      $plain = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($bstr).Trim()
    } finally {
      [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($bstr)
    }
  }

  if ([string]::IsNullOrWhiteSpace($plain)) { Write-Error "Empty token." }
  if (-not $plain.StartsWith("github_pat_") -and -not $plain.StartsWith("ghp_")) {
    Write-Error 'That does not look like a token - it has to start with `github_pat_` or `ghp_`.'
  }

  # ASCII: it adds no BOM. Written as UTF-8, a BOM corrupts the token silently -
  # the same trap that was hit with Vercel's environment variables.
  [IO.File]::WriteAllText($tokenFile, $plain, [Text.Encoding]::ASCII)
  Write-Output "Written: $tokenFile"
}

# --- 2. Sınaq -------------------------------------------------------------

Write-Output ""
Write-Output "Sending a test request..."
& powershell.exe -NoProfile -ExecutionPolicy Bypass -File $trigger
if ($LASTEXITCODE -ne 0) {
  Write-Output ""
  Write-Output "The token did not work - the task was NOT registered."
  Write-Output 'The usual cause: the `Actions: Read and write` permission was not granted.'
  exit 1
}

# --- 3. Cədvəl ------------------------------------------------------------

# The log is written by the script itself. A `>> log` used to sit in this
# argument line - Task Scheduler passes that to PowerShell as another argument
# rather than treating it as redirection, so the log was never created.
#
# `-WindowStyle Hidden` and the `-Hidden` below are both needed. Without them a
# PowerShell window OPENS AND CLOSES on screen every 20 minutes. The job takes a
# second, but the window is visible and interrupts whoever is working - which is
# exactly what was complained about on 2026-08-30. Background work should be
# invisible.
#
# The two solve different things: `-WindowStyle Hidden` hides PowerShell's own
# window, `-Hidden` registers the task itself as hidden.
$action = New-ScheduledTaskAction -Execute "powershell.exe" `
  -Argument "-NoProfile -WindowStyle Hidden -ExecutionPolicy Bypass -File `"$trigger`""

$triggerTask = New-ScheduledTaskTrigger -Once -At (Get-Date).AddMinutes(1) `
  -RepetitionInterval (New-TimeSpan -Minutes 20)

$settings = New-ScheduledTaskSettingsSet -StartWhenAvailable -Hidden `
  -DontStopOnIdleEnd -ExecutionTimeLimit (New-TimeSpan -Minutes 5)

Register-ScheduledTask -TaskName $taskName -Action $action `
  -Trigger $triggerTask -Settings $settings -Force | Out-Null

Write-Output ""
Write-Output "Done. The import will run every 20 minutes."
Write-Output "Log:       $(Join-Path $PSScriptRoot '.trigger-log.txt')"
Write-Output "To remove: Unregister-ScheduledTask -TaskName '$taskName' -Confirm:`$false"
Write-Output ""
Write-Output "Note: this only runs while the computer is on."
