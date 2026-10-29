param(
    [switch]$Force
)

Set-Location $PSScriptRoot

$gcloudBin = "$env:LOCALAPPDATA\Google\Cloud SDK\google-cloud-sdk\bin"
if (Test-Path $gcloudBin) {
    $env:PATH = "$gcloudBin;$env:PATH"
}

Write-Host "[1/3] Sprawdzanie kompilacji TypeScript..." -ForegroundColor Cyan
& npm.cmd run build
if ($LASTEXITCODE -ne 0) {
    Write-Host "[X] Blad kompilacji TypeScript! Wdrozenie przerwane." -ForegroundColor Red
    exit 1
}
Write-Host "[OK] Kompilacja TypeScript przeszla pomyslnie." -ForegroundColor Green

if (-not $Force) {
    Write-Host "`n[UWAGA] Zamierzasz wdrozyc wersje na PRODUKCJE (Cloud Run: beautyvoice-bff)." -ForegroundColor Yellow
    $confirmation = Read-Host "Czy na pewno chcesz kontynuowac wdrozenie produkcyjne? [T/N]"
    if ($confirmation -ne 'T' -and $confirmation -ne 't' -and $confirmation -ne 'tak' -and $confirmation -ne 'TAK') {
        Write-Host "Wdrozenie zostalo anulowane przez uzytkownika." -ForegroundColor Yellow
        exit 0
    }
}

Write-Host "`n[2/3] Przygotowywanie zmiennych srodowiskowych z .env..." -ForegroundColor Cyan
$envContent = Get-Content -Path .env | Where-Object { 
    $_ -notmatch "^\s*#" -and 
    $_ -match "=" -and 
    $_ -notmatch "^PORT=" -and
    $_ -notmatch "^DEV_FORWARD_URL="
}
$envVars = $envContent -join ","

Write-Host "[3/3] Wdrazanie uslugi Cloud Run (beautyvoice-bff)..." -ForegroundColor Cyan
gcloud run deploy beautyvoice-bff `
    --source . `
    --platform managed `
    --region europe-central2 `
    --allow-unauthenticated `
    --project beautyvoice-bff `
    --timeout=3600 `
    --cpu-throttling `
    --min-instances=0 `
    --session-affinity `
    --set-env-vars="$envVars"

if ($LASTEXITCODE -eq 0) {
    Write-Host "`n[SUKCES] Backend produkcyjny zostal pomyslnie zaktualizowany na Cloud Run!" -ForegroundColor Green
} else {
    Write-Host "`n[BLAD] Blad podczas wdrazania do Cloud Run." -ForegroundColor Red
}
