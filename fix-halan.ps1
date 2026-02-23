$filePath = "C:\Users\Eng.Amjed\Desktop\new-assiut-services\server\routes\halan-orders.js"
$content = Get-Content $filePath -Raw
$lines = $content -split "`n"

Write-Host "Total lines:" $lines.Count

# Find the two Update Order (Edit) comments
$firstIdx = -1
$secondIdx = -1

for ($i = 509; $i -lt 550; $i++) {
    if ($lines[$i] -match "// Update Order \(Edit\)") {
        if ($firstIdx -eq -1) {
            $firstIdx = $i
            Write-Host "Found first comment at line $($i+1)"
        } else {
            $secondIdx = $i
            Write-Host "Found second comment at line $($i+1)"
            break
        }
    }
}

if ($firstIdx -ne -1 -and $secondIdx -ne -1) {
    # Keep lines 0 to firstIdx-1, then from secondIdx onwards
    $newLines = $lines[0..($firstIdx-1)] + $lines[$secondIdx..($lines.Count-1)]
    $newContent = $newLines -join "`n"
    Set-Content $filePath -Value $newContent -NoNewline
    Write-Host "Fixed! Removed lines $($firstIdx+1) to $($secondIdx)"
} else {
    Write-Host "Could not find both markers. First: $firstIdx, Second: $secondIdx"
}
