# =========================================================
# Skrypt Bezpiecznego Wdrożenia Produkcyjnego (Backend Cloud Run)
# =========================================================

Write-Host "🔍 [1/3] Sprawdzanie kompilacji TypeScript..." -ForegroundColor Cyan
npm run build
if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Błąd kompilacji TypeScript! Wdrożenie przerwane." -ForegroundColor Red
    exit 1
}
Write-Host "✅ Kompilacja TypeScript przeszła pomyślnie." -ForegroundColor Green

Write-Host "`n⚠️  UWAGA: Zamierzasz wdrożyć wersję na PRODUKCJĘ (Cloud Run: beautyvoice-bff)." -ForegroundColor Yellow
$confirmation = Read-Host "Czy na pewno chcesz kontynuować wdrożenie produkcyjne? [T/N]"

if ($confirmation -ne 'T' -and $confirmation -ne 't' -and $confirmation -ne 'tak' -and $confirmation -ne 'TAK') {
    Write-Host "🛑 Wdrożenie zostało anulowane przez użytkownika." -ForegroundColor Yellow
    exit 0
}

Write-Host "`n🚀 [2/3] Przygotowywanie zmiennych środowiskowych z .env..." -ForegroundColor Cyan
$envContent = Get-Content -Path .env | Where-Object { 
    $_ -notmatch "^\s*#" -and 
    $_ -match "=" -and 
    $_ -notmatch "^PORT=" -and
    $_ -notmatch "^DEV_FORWARD_URL="
}
$envVars = $envContent -join ","

Write-Host "🚀 [3/3] Wdrażanie usługi Cloud Run (beautyvoice-bff)..." -ForegroundColor Cyan
gcloud run deploy beautyvoice-bff `
    --source . `
    --platform managed `
    --region europe-central2 `
    --allow-unauthenticated `
    --project beautyvoice-bff `
    --set-env-vars="$envVars"

if ($LASTEXITCODE -eq 0) {
    Write-Host "`n🎉 Backend produkcyjny został pomyślnie zaktualizowany na Cloud Run!" -ForegroundColor Green
} else {
    Write-Host "`n❌ Błąd podczas wdrażania do Cloud Run." -ForegroundColor Red
}
