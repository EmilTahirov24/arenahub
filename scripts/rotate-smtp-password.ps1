<#
  Gmail app password-u yerli .env-də və Vercel-də bir əmrlə dəyişir.

    powershell -ExecutionPolicy Bypass -File scripts\rotate-smtp-password.ps1

  Niyə lazımdır: 2026-08-05-də işlədilən 16 simvolluq parol bir söhbətə düşüb,
  yəni artıq gizli deyil. Onu dəyişmək iki yerə toxunur — yerli .env və Vercel
  Production — və ikisi arasında fərq yaransa, sayt səssizcə məktub göndərməyi
  dayandırır.

  Sıra qəsdən belədir: parol ƏVVƏLCƏ yerli sınaqdan keçir, yalnız sonra
  production-a gedir. Sınaq uğursuz olsa .env geri qaytarılır və Vercel-ə
  ümumiyyətlə toxunulmur — səhv parolu production-a yaymaq indiki vəziyyətdən
  pisdir.

  Parol heç bir addımda ekrana çıxmır, log-a yazılmır və arqument kimi
  ötürülmür (arqument proses siyahısında görünərdi).

  ƏVVƏLCƏ: myaccount.google.com/apppasswords -> yeni 16 simvolluq açar.
  SONRA:   bu skripti işlət.
  AXIRDA:  köhnə açarı həmin səhifədə LƏĞV ET — skript bunu edə bilmir.
#>

param(
  # Sınaq məktubunun ünvanı. Boş qalsa .env-dəki SMTP_USER işlədilir: hesabın
  # özünə göndərmək çatdırılmanı sübut edir və skriptə şəxsi ünvan yazmır.
  [string]$To = ""
)

$ErrorActionPreference = "Stop"
try { [Console]::OutputEncoding = [Text.Encoding]::UTF8 } catch {}

$repo = Split-Path $PSScriptRoot -Parent
$envFile = Join-Path $repo ".env"
$backup = Join-Path $repo ".env.bak"

if (-not (Test-Path $envFile)) { Write-Error ".env tapılmadı: $envFile" }

# --- 1. Parolu al -----------------------------------------------------------

Write-Output ""
Write-Output "Yeni Gmail app password-u yapışdır (yazılan görünməyəcək):"
$secure = Read-Host -AsSecureString
$bstr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure)
try {
  $plain = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($bstr)
} finally {
  [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($bstr)
}

# Google onu "abcd efgh ijkl mnop" kimi göstərir; boşluqlar hissəsi deyil.
$plain = ($plain -replace '\s', '')

if ($plain.Length -ne 16 -or $plain -notmatch '^[a-z]{16}$') {
  Write-Error "Bu, app password kimi görünmür: boşluqsuz 16 kiçik hərf olmalıdır (uzunluq: $($plain.Length)). Adi Google şifrəsi işləmir."
}

# --- 2. .env-i yenilə -------------------------------------------------------

Copy-Item $envFile $backup -Force
Write-Output "Ehtiyat nüsxə: .env.bak"

# Bütöv mətn üzərində işləyirik ki, sətir sonları və qalan sətirlər olduğu kimi
# qalsın. Əvəzləmə blok şəklindədir: parolda `$` olsaydı, sadə sətir əvəzləməsi
# onu qrup istinadı kimi oxuyardı.
$text = [IO.File]::ReadAllText($envFile, [Text.Encoding]::UTF8)
$hits = ([regex]::Matches($text, '(?m)^SMTP_PASS=.*$')).Count
if ($hits -ne 1) {
  Remove-Item $backup -Force
  Write-Error "SMTP_PASS sətri .env-də $hits dəfə tapıldı — 1 gözlənilirdi. Əl ilə bax."
}
$updated = [regex]::Replace($text, '(?m)^SMTP_PASS=.*$', { "SMTP_PASS=$plain" })

# BOM-suz UTF-8: BOM .env-in ilk açarını korlayır və Azərbaycan hərfləri üçün
# kodlaşdırma saxlanılmalıdır.
[IO.File]::WriteAllText($envFile, $updated, (New-Object Text.UTF8Encoding $false))
Write-Output ".env yeniləndi (yalnız SMTP_PASS sətri)"

function Restore-Env {
  Copy-Item $backup $envFile -Force
  Write-Output ""
  Write-Output ".env ƏVVƏLKİ HALINA QAYTARILDI. Vercel-ə toxunulmadı."
}

# --- 3. Yerli sınaq ---------------------------------------------------------

if (-not $To) {
  $m = [regex]::Match($updated, '(?m)^SMTP_USER=(.*)$')
  $To = $m.Groups[1].Value.Trim().Trim('"').Trim("'")
}
if (-not $To) { Restore-Env; Write-Error "Sınaq ünvanı tapılmadı. -To ilə ver." }

Write-Output ""
Write-Output "Yerli sınaq: $To"
Push-Location $repo
try {
  & npx tsx scripts/check-email.ts --to $To
  $ok = ($LASTEXITCODE -eq 0)
} finally {
  Pop-Location
}

if (-not $ok) {
  Restore-Env
  Write-Output "Parol Gmail tərəfindən qəbul edilmədi. Yeni açar yarat və yenidən cəhd et."
  exit 1
}

# --- 4. Vercel ---------------------------------------------------------------

Write-Output ""
Write-Output "Vercel Production yenilənir..."

# PowerShell borusu İŞLƏDİLMİR: `$v | vercel env add` dəyərin əvvəlinə U+FEFF
# qoyur, Vercel onu qəbul edir, heç nə xəbərdarlıq etmir və Gmail runtime-da
# `535 BadCredentials` qaytarır. 2026-08-05-də tam olaraq bu baş verdi.
# ASCII faylı BOM yazmır və cmd-in yönləndirməsi onu təmiz ötürür.
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
  Write-Output "Vercel yenilənmədi. .env DÜZGÜNDÜR, amma production köhnə parolu işlədir."
  Write-Output "Əl ilə: npx vercel env add SMTP_PASS production"
  exit 1
}
Write-Output "Vercel yeniləndi (BOM-suz)"

# --- 5. Deploy ---------------------------------------------------------------

# Dəyişən deploy olmadan işə düşmür: mövcud build köhnə dəyəri daşıyır.
Write-Output ""
Write-Output "Production-a deploy edilir..."
Push-Location $repo
try {
  & npx vercel deploy --prod
  $deployed = ($LASTEXITCODE -eq 0)
} finally {
  Pop-Location
}

Write-Output ""
if ($deployed) {
  Write-Output "Hazırdır."
} else {
  Write-Output "Deploy alınmadı — `npx vercel deploy --prod` əl ilə işlət."
}

Write-Output ""
Write-Output "İki addım qalır, ikisi də səndədir:"
Write-Output "  1. Canlı saytda «şifrəmi unutdum» ilə bir dəfə yoxla — məktub gəlməlidir."
Write-Output "  2. KÖHNƏ açarı ləğv et: myaccount.google.com/apppasswords"
Write-Output "     Bunsuz sızmış parol hələ də işləyir və bütün iş mənasızdır."
Write-Output ""
Write-Output "Hər şey qaydasındadırsa .env.bak silinə bilər — içində köhnə parol var."
