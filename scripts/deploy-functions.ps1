param([Parameter(Mandatory=$true)][string]$ProjectRef)
$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent $PSScriptRoot
Push-Location $projectRoot
try {
  $functions = @('otp-request','otp-verify','ai-gateway','admin-api','quality-admin','account-export','account-delete','billing-checkout','billing-portal','stripe-webhook','lead-consent','referral-consent')
  foreach ($functionName in $functions) {
    Write-Host "Deploying $functionName"
    & npx supabase functions deploy $functionName --project-ref $ProjectRef
    if ($LASTEXITCODE -ne 0) { throw "Deployment failed: $functionName" }
  }
  Write-Host 'All 12 functions deployed. Run the staging acceptance checks before enabling scheduled delivery.'
} finally { Pop-Location }
