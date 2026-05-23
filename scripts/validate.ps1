param(
    [string]$BundlePath = "policy-bundle-nauta-colombia"
)

$ErrorActionPreference = "Stop"

if (-not (Get-Command opa -ErrorAction SilentlyContinue)) {
    Write-Error "OPA no está instalado o no está en PATH. Instala OPA y vuelve a ejecutar: .\scripts\validate.ps1"
}

Write-Host "==> OPA version"
opa version

Write-Host "==> Formatting check"
opa fmt --diff $BundlePath

Write-Host "==> Parse"
opa parse $BundlePath

Write-Host "==> Tests"
opa test $BundlePath

Write-Host "==> Build"
opa build $BundlePath -o nauta-policy-bundle.tar.gz

Write-Host "Validación completada."
