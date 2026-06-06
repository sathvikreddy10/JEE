# Start backend server
$backend = Start-Process -FilePath "npx" -ArgumentList "tsx", "src/server.ts" -WorkingDirectory "C:\Users\sathv\Desktop\testify\apps\backend" -PassThru -WindowStyle Hidden
Write-Host "Backend started with PID: $($backend.Id)"
Start-Sleep -Seconds 3

# Test health endpoint
$health = Invoke-RestMethod -Uri "http://localhost:4000/health" -Method GET
Write-Host "Backend health: $($health | ConvertTo-Json -Compress)"

# Start frontend
$frontend = Start-Process -FilePath "npm" -ArgumentList "run", "dev" -WorkingDirectory "C:\Users\sathv\Desktop\testify\apps\frontend" -PassThru -WindowStyle Hidden
Write-Host "Frontend started with PID: $($frontend.Id)"
Start-Sleep -Seconds 5

# Test frontend
$frontendHealth = Invoke-RestMethod -Uri "http://localhost:3000/api/health" -Method GET
Write-Host "Frontend proxy health: $($frontendHealth | ConvertTo-Json -Compress)"

Write-Host "Both servers are running!"
Write-Host "Backend: http://localhost:4000"
Write-Host "Frontend: http://localhost:3000"
Write-Host ""
Write-Host "To stop servers, run: taskkill /F /IM node.exe /T"