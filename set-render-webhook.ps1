$botToken = "7994475257:AAHl6x-mubS0ImJXAmmUgq18iAvYJ18QGEI"

# Based on the service ID, the URL should be something like this
# Let's try different possible URL patterns
$possibleUrls = @(
    "https://joker-duel-games-bot.onrender.com",
    "https://jokerspvp.onrender.com", 
    "https://joker-duel-games-bot-d1f99hvgi27c73ci9e3g.onrender.com",
    "https://jokerspvp-d1f99hvgi27c73ci9e3g.onrender.com"
)

Write-Host "🔍 Testing possible Render URLs..." -ForegroundColor Yellow

foreach ($url in $possibleUrls) {
    $webhookUrl = "$url/api/bot"
    Write-Host "Testing: $webhookUrl" -ForegroundColor Cyan
    
    try {
        # Test if the URL is accessible
        $response = Invoke-RestMethod -Uri $url -Method GET -TimeoutSec 5
        Write-Host "✅ URL accessible: $url" -ForegroundColor Green
        
        # Set webhook
        $webhookResponse = Invoke-RestMethod -Uri "https://api.telegram.org/bot$botToken/setWebhook" -Method POST -Body (@{url = $webhookUrl} | ConvertTo-Json) -ContentType "application/json"
        
        if ($webhookResponse.ok) {
            Write-Host "🎉 Webhook set successfully!" -ForegroundColor Green
            Write-Host "Webhook URL: $webhookUrl" -ForegroundColor Green
            break
        } else {
            Write-Host "❌ Failed to set webhook: $($webhookResponse.description)" -ForegroundColor Red
        }
    } catch {
        Write-Host "❌ URL not accessible: $url" -ForegroundColor Red
    }
}

Write-Host "`n📋 Manual webhook setup:" -ForegroundColor Yellow
Write-Host "If none of the URLs worked, go to your Render dashboard and find the correct URL." -ForegroundColor White
Write-Host "Then use this command in your browser:" -ForegroundColor White
Write-Host "https://api.telegram.org/bot$botToken/setWebhook?url=YOUR_RENDER_URL/api/bot" -ForegroundColor Cyan 