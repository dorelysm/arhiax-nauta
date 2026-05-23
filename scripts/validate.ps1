param(
    [string]$BundlePath = "policy-bundle-nauta-colombia"
)

$ErrorActionPreference = "Stop"

function Invoke-Checked {
    param(
        [Parameter(Mandatory = $true)]
        [ScriptBlock]$Command
    )

    & $Command
    if ($LASTEXITCODE -ne 0) {
        throw "Command failed with exit code $LASTEXITCODE"
    }
}

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

$env:OPA_BIN = $Opa
Write-Host "Configurado OPA_BIN para subprocesos: $env:OPA_BIN"

Write-Host "==> Generando Llaves de Seguridad"
Invoke-Checked { node scripts/generate-keys.mjs }

Write-Host "==> OPA version"
Invoke-Checked { & $Opa version }

Write-Host "==> Formatting check"
Invoke-Checked { & $Opa fmt --diff $BundlePath }

Write-Host "==> Static check"
Invoke-Checked { & $Opa check $BundlePath }

Write-Host "==> Tests"
Invoke-Checked { & $Opa test $BundlePath }

Write-Host "==> Firmando Políticas"
Invoke-Checked { & $Opa sign --bundle --signing-key keys/development-private.pem -o $BundlePath $BundlePath }

Write-Host "==> Build"
Invoke-Checked { & $Opa build $BundlePath -o nauta-policy-bundle.tar.gz }

Write-Host "==> Golden fixtures"
Invoke-Checked { node .\scripts\test-fixtures.mjs }

Write-Host "==> Runtime unit tests"
Invoke-Checked { npm test }

Write-Host "Validación completada."
