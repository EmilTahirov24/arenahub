<#
  Starts the import job on GitHub.

  Why it exists: GitHub throttles the `schedule` event on the free plan. It was
  measured - between 17 and 25 August the job ran 33-49 times a day, then 3
  times on 27 August and once on the 28th. `workflow_dispatch` is not
  throttled, because it arrives as a request.

  This script sends that request. With Windows Task Scheduler calling it every
  20 minutes, the import runs on time.

  TOKEN: read from the `.github-token` file next to this one. That file is in
  .gitignore and never reaches the repo. The token must never be written into
  this file, into a commit, or into a conversation.

  Setup:
    1. github.com/settings/personal-access-tokens -> fine-grained token
       Repository access: EmilTahirov24/arenahub only
       Permissions -> Repository -> Actions: Read and write
    2. Write the token here:  scripts\.github-token
    3. Test it once by hand:  powershell -File scripts\trigger-import.ps1
    4. Put it on a schedule:  powershell -File scripts\install-trigger-task.ps1

  A limitation, stated plainly: this only works while the computer is on. For
  round-the-clock freshness it needs an outside service (cron-job.org, say) or
  a paid scheduler.
#>

$ErrorActionPreference = "Stop"
# Without a UTF-8 console the messages come out mangled; this affects output only.
try { [Console]::OutputEncoding = [Text.Encoding]::UTF8 } catch {}
$tokenFile = Join-Path $PSScriptRoot ".github-token"

if (-not (Test-Path $tokenFile)) {
  Write-Error "No token file: $tokenFile  (see the setup steps)"
}

$token = (Get-Content $tokenFile -Raw).Trim()
if ([string]::IsNullOrWhiteSpace($token)) {
  Write-Error "The token file is empty: $tokenFile"
}

$uri = "https://api.github.com/repos/EmilTahirov24/arenahub/actions/workflows/import-live.yml/dispatches"
$headers = @{
  "Authorization"        = "Bearer $token"
  "Accept"               = "application/vnd.github+json"
  "X-GitHub-Api-Version" = "2022-11-28"
  "User-Agent"           = "ArenaHub-trigger"
}

# The log is the script's own job. A `>>` in the scheduled task's argument line
# used to do it, but Task Scheduler does not understand redirection - it passes
# that text to PowerShell as an argument. So the log was never created, and the
# task could fail silently.
$logFile = Join-Path $PSScriptRoot ".trigger-log.txt"

function Write-Line([string]$text) {
  $line = "$(Get-Date -Format 'yyyy-MM-dd HH:mm')  $text"
  Write-Output $line
  try { Add-Content -Path $logFile -Value $line -Encoding UTF8 } catch {}
}

try {
  Invoke-RestMethod -Uri $uri -Method Post -Headers $headers -Body '{"ref":"main"}' -ContentType "application/json"
  Write-Line "import started"
} catch {
  # The error is not swallowed: when this runs from a schedule, this line is the
  # only trace there is.
  #
  # It splits on the status code, because the two cases want completely
  # different responses - and that was learned the hard way on 2026-08-30, when
  # the log said only "(401) Unauthorized" and working out why took a separate
  # investigation. A 401 or 403 needs a person: it will not fix itself, and will
  # repeat the same line every 20 minutes. A network error clears on the next run.
  $status = $null
  try { $status = [int]$_.Exception.Response.StatusCode } catch {}

  if ($status -eq 401) {
    Write-Line "FAILED (401): the token is not accepted - revoked or expired."
    Write-Line "  To fix: create a new token, copy it, then:"
    Write-Line "  Remove-Item scripts\.github-token; powershell -File scripts\setup-trigger.ps1 -Yes"
    Write-Line "  NOTE: the import does not stop entirely - GitHub's own schedule still runs, just hours late."
  } elseif ($status -eq 403 -or $status -eq 404) {
    Write-Line "FAILED ($status): the token exists, but its permissions fall short."
    Write-Line '  The usual cause: `Actions: Read and write` was not granted,'
    Write-Line '  or the token was not bound to the `arenahub` repository.'
  } else {
    Write-Line "FAILED: $($_.Exception.Message)"
  }
  exit 1
}
