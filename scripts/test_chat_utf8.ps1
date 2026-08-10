$ErrorActionPreference = "Stop"

[Console]::InputEncoding = [System.Text.Encoding]::UTF8
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$OutputEncoding = [System.Text.Encoding]::UTF8

$messageCodePoints = 0x5B66, 0x4E60, 0x7EBF, 0x6027, 0x56DE, 0x5F52, 0x7684, 0x539F, 0x7406
$message = -join ($messageCodePoints | ForEach-Object { [char]$_ })

$body = @{
    message = $message
    user_id = "manual-test"
} | ConvertTo-Json -Compress

$bytes = [System.Text.Encoding]::UTF8.GetBytes($body)

$apiPort = if ($env:API_PORT) { $env:API_PORT } else { "28000" }

Invoke-WebRequest `
    -Uri "http://127.0.0.1:$apiPort/api/chat" `
    -Method Post `
    -ContentType "application/json; charset=utf-8" `
    -Body $bytes
