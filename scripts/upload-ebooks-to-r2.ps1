param(
    [string]$SourceDirectory = (Join-Path (Get-Location) 'ebooks-to-upload')
)

$ErrorActionPreference = 'Stop'
$bucket = 'curvafit-ebooks'
$ebookFiles = @(
    'gentle-walking/en.pdf',
    'gentle-walking/fr.pdf',
    'gentle-walking/es.pdf',
    'simple-meal-planner/en.pdf',
    'simple-meal-planner/fr.pdf',
    'simple-meal-planner/es.pdf',
    'move-at-home/en.pdf',
    'move-at-home/fr.pdf',
    'move-at-home/es.pdf',
    'back-on-track/en.pdf',
    'back-on-track/fr.pdf',
    'back-on-track/es.pdf'
)

if (-not (Get-Command npx.cmd -ErrorAction SilentlyContinue)) {
    throw 'Node.js and npm/npx are required. Install Wrangler with: npm install --save-dev wrangler'
}

$missingFiles = @($ebookFiles | Where-Object {
    -not (Test-Path -LiteralPath (Join-Path $SourceDirectory $_) -PathType Leaf)
})
if ($missingFiles.Count -gt 0) {
    throw "Upload cancelled. Missing PDF files in '$SourceDirectory':`n$($missingFiles -join "`n")"
}

foreach ($relativePath in $ebookFiles) {
    $filePath = (Resolve-Path -LiteralPath (Join-Path $SourceDirectory $relativePath)).Path
    $objectKey = $relativePath.Replace('\', '/')
    Write-Host "Uploading $objectKey"
    & npx.cmd wrangler r2 object put "$bucket/$objectKey" --file $filePath --content-type 'application/pdf'
    if ($LASTEXITCODE -ne 0) {
        throw "Wrangler upload failed for '$objectKey' (exit code $LASTEXITCODE)."
    }
}

Write-Host "Uploaded all $($ebookFiles.Count) PDFs to the private R2 bucket '$bucket'."
Write-Host 'Object keys are ready for the later payment-verified download endpoint; no public URLs were created.'
