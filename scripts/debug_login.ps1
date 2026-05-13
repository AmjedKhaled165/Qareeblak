$ErrorActionPreference = "Stop"
$rand = Get-Random -Minimum 1000 -Maximum 9999
$email = "debug_user_$rand@test.com"
$password = "password123"
$name = "Debug User $rand"

function Invoke-Api {
    param($method, $url, $body, $headers)
    try {
        if ($body) {
            return Invoke-RestMethod -Method $method -Uri $url -Body $body -ContentType "application/json" -Headers $headers
        }
        else {
            return Invoke-RestMethod -Method $method -Uri $url -Headers $headers
        }
    }
    catch {
        Write-Host "Request to $url Failed!" -ForegroundColor Red
        Write-Host "Status: $($_.Exception.Response.StatusCode)"
        $stream = $_.Exception.Response.GetResponseStream()
        if ($stream) {
            $reader = New-Object System.IO.StreamReader($stream)
            Write-Host "Body: $($reader.ReadToEnd())"
        }
        return $null
    }
}

Write-Host "1. Registering new user: $email..."
$regBody = @{
    name     = $name
    email    = $email
    password = $password
    userType = "customer"
} | ConvertTo-Json

$regRes = Invoke-Api "Post" "http://localhost:5000/api/auth/register" $regBody $null

if ($regRes -and $regRes.token) {
    $token = $regRes.token
    Write-Host "Registration Successful. Token received."
    Write-Host "Token prefix: $($token.Substring(0, 10))..."

    Write-Host "`n2. Verifying with /api/auth/me..."
    $headers = @{ Authorization = "Bearer $token" }
    $meRes = Invoke-Api "Get" "http://localhost:5000/api/auth/me" $null $headers

    if ($meRes) {
        Write-Host "SUCCESS: /me returned user data!" -ForegroundColor Green
        Write-Host "User ID: $($meRes.id)"
        Write-Host "Email: $($meRes.email)"
    }
    else {
        Write-Host "FAILURE: /me failed with valid token." -ForegroundColor Red
    }

}
else {
    Write-Host "Registration failed or returned no token."
}
