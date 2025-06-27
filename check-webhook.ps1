$botToken = "7994475257:AAHl6x-mubS0ImJXAmmUgq18iAvYJ18QGEI"

Write-Host "🔍 Checking current webhook status..." -ForegroundColor Yellow

try {
    $webhookInfo = Invoke-RestMethod -Uri "https://api.telegram.org/bot$botToken/getWebhookInfo"
    
    Write-Host "Current Webhook Info:" -ForegroundColor Green
    Write-Host "URL: $($webhookInfo.result.url)" -ForegroundColor Cyan
    Write-Host "Has Custom Certificate: $($webhookInfo.result.has_custom_certificate)" -ForegroundColor Cyan
    Write-Host "Pending Update Count: $($webhookInfo.result.pending_update_count)" -ForegroundColor Cyan
    Write-Host "Last Error Date: $($webhookInfo.result.last_error_date)" -ForegroundColor Cyan
    Write-Host "Last Error Message: $($webhookInfo.result.last_error_message)" -ForegroundColor Cyan
    
} catch {
    Write-Host "❌ Error checking webhook: $($_.Exception.Message)" -ForegroundColor Red
}

Write-Host "`n📋 To set webhook for Render:" -ForegroundColor Yellow
Write-Host "1. Go to your Render dashboard" -ForegroundColor White
Write-Host "2. Find your Background Worker URL" -ForegroundColor White
Write-Host "3. Use this command (replace YOUR_APP_NAME):" -ForegroundColor White
Write-Host "   https://api.telegram.org/bot$botToken/setWebhook?url=https://YOUR_APP_NAME.onrender.com/api/bot" -ForegroundColor Cyan 