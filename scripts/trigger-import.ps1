<#
  İdxal işini GitHub-da işə salır.

  Niyə lazımdır: GitHub `schedule` hadisəsini pulsuz planda boğur. Ölçüldü —
  17-25 avqust arası gündə 33-49 qaçış gəlirdi, 27 avqustda 3-ə, 28-də 1-ə
  düşdü. `workflow_dispatch` isə boğulmur, çünki o, sorğu ilə gəlir.

  Bu skript həmin sorğunu göndərir. Windows Task Scheduler onu hər 20 dəqiqədə
  çağırsa, idxal vaxtında işləyəcək.

  TOKEN: yanındakı `.github-token` faylından oxunur. Fayl .gitignore-dadır və
  repoya düşmür. Token heç vaxt bu fayla, commit-ə və ya söhbətə yazılmamalıdır.

  Quraşdırma:
    1. github.com/settings/personal-access-tokens -> fine-grained token
       Repository access: yalnız EmilTahirov24/arenahub
       Permissions -> Repository -> Actions: Read and write
    2. Token-i bura yaz:  scripts\.github-token
    3. Bir dəfə əl ilə yoxla:  powershell -File scripts\trigger-import.ps1
    4. Cədvələ qoy:            powershell -File scripts\install-trigger-task.ps1

  Məhdudiyyət, açıq deyilir: bu, yalnız kompüter işləyəndə çalışır. 24/7 təzəlik
  üçün kənar xidmət (məsələn cron-job.org) və ya ödənişli planlayıcı lazımdır.
#>

$ErrorActionPreference = "Stop"
# Konsol UTF-8 olmasa mesajlar korlanır; bu, yalnız çıxışa təsir edir.
try { [Console]::OutputEncoding = [Text.Encoding]::UTF8 } catch {}
$tokenFile = Join-Path $PSScriptRoot ".github-token"

if (-not (Test-Path $tokenFile)) {
  Write-Error "Token faylı yoxdur: $tokenFile  (quraşdırma addımlarına bax)"
}

$token = (Get-Content $tokenFile -Raw).Trim()
if ([string]::IsNullOrWhiteSpace($token)) {
  Write-Error "Token faylı boşdur: $tokenFile"
}

$uri = "https://api.github.com/repos/EmilTahirov24/arenahub/actions/workflows/import-live.yml/dispatches"
$headers = @{
  "Authorization"        = "Bearer $token"
  "Accept"               = "application/vnd.github+json"
  "X-GitHub-Api-Version" = "2022-11-28"
  "User-Agent"           = "ArenaHub-trigger"
}

try {
  Invoke-RestMethod -Uri $uri -Method Post -Headers $headers -Body '{"ref":"main"}' -ContentType "application/json"
  Write-Output "$(Get-Date -Format 'yyyy-MM-dd HH:mm')  idxal işə salındı"
} catch {
  # Səhv gizlədilmir: cədvəllə işləyəndə yeganə iz bu sətirdir.
  Write-Output "$(Get-Date -Format 'yyyy-MM-dd HH:mm')  ALINMADI: $($_.Exception.Message)"
  exit 1
}
