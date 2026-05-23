param(
    [string]$BundlePath = "policy-bundle-nauta-colombia"
)

$ErrorActionPreference = "Stop"

$OpaCommand = Get-Command opa -ErrorAction SilentlyContinue
if (-not $OpaCommand) {
    $TempOpa = Join-Path $env:TEMP "opa_windows_amd64.exe"
    if (-not (Test-Path $TempOpa)) {
        Write-Host "OPA no está en PATH. Descargando binario temporal para validación local..."
        Invoke-WebRequest -Uri "https://openpolicyagent.org/downloads/latest/opa_windows_amd64.exe" -OutFile $TempOpa
    }
    $Opa = $TempOpa
} else {
    $Opa = $OpaCommand.Source
}

Write-Host "==> OPA version"
& $Opa version

Write-Host "==> Formatting check"
& $Opa fmt --diff $BundlePath

Write-Host "==> Static check"
& $Opa check $BundlePath

Write-Host "==> Tests"
& $Opa test $BundlePath

Write-Host "==> Build"
& $Opa build $BundlePath -o nauta-policy-bundle.tar.gz

Write-Host "Validación completada."
