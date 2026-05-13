$f = 'c:\Users\zyad\Downloads\Qareeblak (2)\Qareeblak\next.config.ts'
$c = Get-Content $f -Raw

# Fix duplicate blob: in dev script-src
$c = $c -replace "script-src 'self' 'unsafe-inline' blob: 'unsafe-eval' blob:", "script-src 'self' 'unsafe-inline' 'unsafe-eval' blob:"

# Add worker-src right before img-src
$workerRule = '"worker-src ''self'' blob:",'
$imgSrc = '"img-src'
$newLine = "`r`n      "
$c = $c.Replace($imgSrc, $workerRule + $newLine + $imgSrc)

Set-Content $f $c -NoNewline
Write-Host "Done!"
