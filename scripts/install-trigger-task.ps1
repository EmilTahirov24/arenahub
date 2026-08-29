<#
  `trigger-import.ps1`-i Windows Task Scheduler-ə hər 20 dəqiqəyə qoyur.

  Bir dəfə işlədilir. Silmək üçün:
    Unregister-ScheduledTask -TaskName "ArenaHub idxal tetikleyicisi" -Confirm:$false

  Administrator hüququ tələb OLUNMUR: tapşırıq cari istifadəçi altında qurulur.
#>

$ErrorActionPreference = "Stop"
try { [Console]::OutputEncoding = [Text.Encoding]::UTF8 } catch {}
$script = Join-Path $PSScriptRoot "trigger-import.ps1"
$log = Join-Path $PSScriptRoot ".trigger-log.txt"

if (-not (Test-Path $script)) { Write-Error "trigger-import.ps1 tapılmadı" }

$action = New-ScheduledTaskAction -Execute "powershell.exe" `
  -Argument "-NoProfile -ExecutionPolicy Bypass -File `"$script`" >> `"$log`" 2>&1"

# Dərhal başlayır və gündə 24 saat, hər 20 dəqiqədən bir təkrarlanır.
$trigger = New-ScheduledTaskTrigger -Once -At (Get-Date).AddMinutes(1) `
  -RepetitionInterval (New-TimeSpan -Minutes 20)

$settings = New-ScheduledTaskSettingsSet -StartWhenAvailable `
  -DontStopOnIdleEnd -ExecutionTimeLimit (New-TimeSpan -Minutes 5)

Register-ScheduledTask -TaskName "ArenaHub idxal tetikleyicisi" `
  -Action $action -Trigger $trigger -Settings $settings -Force | Out-Null

Write-Output "Tapşırıq quruldu. Log: $log"
Write-Output "Yoxlamaq üçün: Get-ScheduledTask -TaskName 'ArenaHub idxal tetikleyicisi'"
