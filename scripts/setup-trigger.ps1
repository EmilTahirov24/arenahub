<#
  İdxal tetikleyicisini bir əmrlə qurur.

    powershell -ExecutionPolicy Bypass -File scripts\setup-trigger.ps1

  Üç işi ardıcıl görür və birincisi alınmasa dayanır:
    1. Tokeni soruşur və `scripts\.github-token` faylına yazır
    2. Bir dəfə sınaq sorğusu göndərir — token doğrudurmu, dərhal bilinir
    3. Yalnız sınaq keçəndə Windows cədvəlinə qoyur

  Niyə belə: əvvəl bu üç addım ayrı-ayrı idi və səhv token yalnız cədvəl
  qurulduqdan sonra, log-da üzə çıxırdı — yəni heç vaxt.

  Token GitHub-dan kopyalanmış halda mübadilə buferində olur, ona görə skript
  əvvəlcə oraya baxır: yazmaq lazım deyil, yalnız təsdiq. Bufer boşdursa,
  gizli sahə açılır (`Read-Host -AsSecureString` yazılanı gizlədir).

  Token heç bir addımda ekrana tam çıxmır — yalnız ilk 14 simvol və uzunluq.
  Fayl `.gitignore`-dadır və repoya düşmür.

  Tokeni belə yarat:
    github.com/settings/personal-access-tokens -> Generate new token
    Repository access -> Only select repositories -> arenahub
    Permissions -> Repository -> Actions: Read and write
#>

$ErrorActionPreference = "Stop"
try { [Console]::OutputEncoding = [Text.Encoding]::UTF8 } catch {}

$tokenFile = Join-Path $PSScriptRoot ".github-token"
$trigger = Join-Path $PSScriptRoot "trigger-import.ps1"
$taskName = "ArenaHub idxal tetikleyicisi"

# --- 1. Token -------------------------------------------------------------

if (Test-Path $tokenFile) {
  Write-Output "Token faylı artıq var: $tokenFile"
  $again = Read-Host "Yenisini yazmaq istəyirsən? (h/y)"
  if ($again -eq "h" -or $again -eq "H") { Remove-Item $tokenFile -Force }
}

if (-not (Test-Path $tokenFile)) {
  $plain = $null

  # Mübadilə buferi əvvəlcə yoxlanılır. Səbəb sadədir: token GitHub-dan məhz
  # kopyalanaraq gəlir, yəni onsuz da oradadır. Gizli sahəyə yapışdırmaq
  # qarışıqlıq yaradırdı — ekran boş qalır və adam yazının getdiyinə əmin
  # olmur. Burada heç nə yazmaq lazım deyil, yalnız təsdiq.
  #
  # Tokenin özü EKRANA ÇIXMIR: yalnız ilk 14 simvol və uzunluq göstərilir,
  # bu, "düzgün olanı kopyalamışam?" sualına cavab vermək üçün kifayətdir.
  $clip = ""
  try { $clip = (Get-Clipboard -Raw -ErrorAction Stop) } catch {}
  if ($clip) { $clip = $clip.Trim() }

  if ($clip -and ($clip.StartsWith("github_pat_") -or $clip.StartsWith("ghp_"))) {
    $onIki = $clip.Substring(0, [Math]::Min(14, $clip.Length))
    Write-Output ""
    Write-Output "Mübadilə buferində token tapıldı:"
    Write-Output "  $onIki…  ($($clip.Length) simvol)"
    $istifade = Read-Host "Bunu işlədim? (h/y)"
    if ($istifade -eq "h" -or $istifade -eq "H") { $plain = $clip }
  }

  if (-not $plain) {
    Write-Output ""
    Write-Output "GitHub tokenini yapışdır (Ctrl+V, sonra Enter — yazılan görünməyəcək):"
    $secure = Read-Host -AsSecureString
    $bstr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure)
    try {
      $plain = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($bstr).Trim()
    } finally {
      [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($bstr)
    }
  }

  if ([string]::IsNullOrWhiteSpace($plain)) { Write-Error "Boş token." }
  if (-not $plain.StartsWith("github_pat_") -and -not $plain.StartsWith("ghp_")) {
    Write-Error "Bu token kimi görünmür — `github_pat_` və ya `ghp_` ilə başlamalıdır."
  }

  # ASCII: BOM əlavə etmir. UTF-8 yazılsa, BOM tokeni səssizcə korlayır —
  # eyni tələ Vercel dəyişənlərində də yaşanıb.
  [IO.File]::WriteAllText($tokenFile, $plain, [Text.Encoding]::ASCII)
  Write-Output "Yazıldı: $tokenFile"
}

# --- 2. Sınaq -------------------------------------------------------------

Write-Output ""
Write-Output "Sınaq sorğusu göndərilir..."
& powershell.exe -NoProfile -ExecutionPolicy Bypass -File $trigger
if ($LASTEXITCODE -ne 0) {
  Write-Output ""
  Write-Output "Token işləmədi — cədvələ QOYULMADI."
  Write-Output "Ən çox rast gəlinən səbəb: `Actions: Read and write` icazəsi verilməyib."
  exit 1
}

# --- 3. Cədvəl ------------------------------------------------------------

# Log skriptin özü tərəfindən yazılır. Əvvəl burada `>> log` arqument sətrinə
# qoyulmuşdu — Task Scheduler onu yönləndirmə kimi yox, PowerShell-ə əlavə
# arqument kimi ötürür, yəni log heç vaxt yaranmırdı.
$action = New-ScheduledTaskAction -Execute "powershell.exe" `
  -Argument "-NoProfile -ExecutionPolicy Bypass -File `"$trigger`""

$triggerTask = New-ScheduledTaskTrigger -Once -At (Get-Date).AddMinutes(1) `
  -RepetitionInterval (New-TimeSpan -Minutes 20)

$settings = New-ScheduledTaskSettingsSet -StartWhenAvailable `
  -DontStopOnIdleEnd -ExecutionTimeLimit (New-TimeSpan -Minutes 5)

Register-ScheduledTask -TaskName $taskName -Action $action `
  -Trigger $triggerTask -Settings $settings -Force | Out-Null

Write-Output ""
Write-Output "Hazırdır. İdxal hər 20 dəqiqədə işə düşəcək."
Write-Output "Log:    $(Join-Path $PSScriptRoot '.trigger-log.txt')"
Write-Output "Silmək: Unregister-ScheduledTask -TaskName '$taskName' -Confirm:`$false"
Write-Output ""
Write-Output "Qeyd: yalnız kompüter açıq olanda işləyir."
