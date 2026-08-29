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

# Log skriptin öz işidir. Əvvəl bunu cədvəlin arqument sətrindəki `>>` edirdi,
# amma Task Scheduler yönləndirmə tanımır — o mətni PowerShell-ə arqument kimi
# ötürür. Yəni log heç vaxt yaranmırdı və cədvəl səssizcə uğursuz ola bilərdi.
$logFile = Join-Path $PSScriptRoot ".trigger-log.txt"

function Write-Line([string]$text) {
  $line = "$(Get-Date -Format 'yyyy-MM-dd HH:mm')  $text"
  Write-Output $line
  try { Add-Content -Path $logFile -Value $line -Encoding UTF8 } catch {}
}

try {
  Invoke-RestMethod -Uri $uri -Method Post -Headers $headers -Body '{"ref":"main"}' -ContentType "application/json"
  Write-Line "idxal işə salındı"
} catch {
  # Səhv gizlədilmir: cədvəllə işləyəndə yeganə iz bu sətirdir.
  #
  # Status koduna görə ayrılır, çünki iki hal tamam fərqli cavab tələb edir və
  # 2026-08-30-da bunu təcrübədə gördük: log yalnız "(401) Unauthorized" yazdı
  # və səbəbi anlamaq üçün ayrıca yoxlama lazım gəldi. 401/403 insan müdaxiləsi
  # istəyir — özü düzəlməz, hər 20 dəqiqədə eyni sətri təkrarlayar. Şəbəkə
  # xətası isə növbəti qaçışda öz-özünə keçir.
  $status = $null
  try { $status = [int]$_.Exception.Response.StatusCode } catch {}

  if ($status -eq 401) {
    Write-Line "ALINMADI (401): token qəbul edilmir — ləğv edilib və ya müddəti bitib."
    Write-Line "  Düzəlişi: yeni token yarat, kopyala, sonra:"
    Write-Line "  Remove-Item scripts\.github-token; powershell -File scripts\setup-trigger.ps1 -Yes"
    Write-Line "  QEYD: idxal tam dayanmır — GitHub-ın öz cədvəli işləyir, sadəcə saatlarla gecikir."
  } elseif ($status -eq 403 -or $status -eq 404) {
    Write-Line "ALINMADI ($status): token var, amma icazəsi çatmır."
    Write-Line "  Ən çox rast gəlinən səbəb: `Actions: Read and write` verilməyib,"
    Write-Line "  ya da token `arenahub` reposuna bağlanmayıb."
  } else {
    Write-Line "ALINMADI: $($_.Exception.Message)"
  }
  exit 1
}
