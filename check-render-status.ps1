$serviceId = "srv-d1f99hvgi27c73ci9e3g"
$apiKey = "m3ilfCGh8s4"

Write-Host "🔍 Checking Render service status..." -ForegroundColor Yellow

try {
    # Get service info
    $serviceUrl = "https://api.render.com/v1/services/$serviceId"
    $headers = @{
        'Authorization' = "Bearer $apiKey"
        'Content-Type' = 'application/json'
    }
    
    $serviceResponse = Invoke-RestMethod -Uri $serviceUrl -Headers $headers -Method GET
    Write-Host "✅ Service found: $($serviceResponse.service.name)" -ForegroundColor Green
    Write-Host "Status: $($serviceResponse.service.status)" -ForegroundColor Cyan
    Write-Host "URL: $($serviceResponse.service.serviceDetails.url)" -ForegroundColor Cyan
    
    # Get latest deployment
    $deploymentsUrl = "https://api.render.com/v1/services/$serviceId/deploys"
    $deploymentsResponse = Invoke-RestMethod -Uri $deploymentsUrl -Headers $headers -Method GET
    
    if ($deploymentsResponse.deploys.Count -gt 0) {
        $latestDeploy = $deploymentsResponse.deploys[0]
        Write-Host "Latest deployment:" -ForegroundColor Yellow
        Write-Host "  ID: $($latestDeploy.id)" -ForegroundColor White
        Write-Host "  Status: $($latestDeploy.status)" -ForegroundColor White
        Write-Host "  Created: $($latestDeploy.createdAt)" -ForegroundColor White
        Write-Host "  Finished: $($latestDeploy.finishedAt)" -ForegroundColor White
    }
    
} catch {
    Write-Host "❌ Error checking service status: $($_.Exception.Message)" -ForegroundColor Red
} 