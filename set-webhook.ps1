$botToken = "7994475257:AAHl6x-mubS0ImJXAmmUgq18iAvYJ18QGEI"
$webhookUrl = "https://2c35-2a02-2f08-b200-ab00-1528-2b2c-b978-b9a1.ngrok-free.app/api/bot"

$body = @{
    url = $webhookUrl
} | ConvertTo-Json

$response = Invoke-RestMethod -Uri "https://api.telegram.org/bot$botToken/setWebhook" -Method POST -ContentType "application/json" -Body $body

Write-Host "Webhook Response:"
$response | ConvertTo-Json 