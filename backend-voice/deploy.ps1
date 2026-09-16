$envContent = Get-Content -Path .env | Where-Object { $_ -notmatch "^\s*#" -and $_ -match "=" -and $_ -notmatch "^PORT=" -and $_ -notmatch "^DEV_FORWARD_URL=" }
$envVars = $envContent -join ","
gcloud run deploy beautyvoice-bff --source . --platform managed --region europe-central2 --allow-unauthenticated --project beautyvoice-bff --timeout=3600 --cpu-throttling --min-instances=0 --set-env-vars="$envVars"
