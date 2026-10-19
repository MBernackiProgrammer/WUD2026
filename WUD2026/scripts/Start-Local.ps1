param([string]$EnvFile, [switch]$StartDatabase)
$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent $PSScriptRoot
if ($EnvFile) {
    foreach ($line in Get-Content -LiteralPath $EnvFile) {
        if ($line -match '^\s*(?:#|$)') { continue }
        $pair = $line -split '=', 2
        if ($pair.Count -ne 2 -or $pair[0].Trim() -notmatch '^[A-Za-z_][A-Za-z0-9_.]*$') { throw 'Nieprawidłowy wpis w pliku środowiska.' }
        $value = $pair[1].Trim()
        if (($value.StartsWith('"') -and $value.EndsWith('"')) -or ($value.StartsWith("'") -and $value.EndsWith("'"))) { $value = $value.Substring(1, $value.Length - 2) }
        [Environment]::SetEnvironmentVariable($pair[0].Trim(), $value, 'Process')
    }
}
function Set-Default([string]$Name, [string]$Value) {
    if (-not [Environment]::GetEnvironmentVariable($Name,'Process')) { [Environment]::SetEnvironmentVariable($Name,$Value,'Process') }
}
Set-Default 'Database__Host' '127.0.0.1'
Set-Default 'Database__Port' $(if($env:POSTGRES_PORT){$env:POSTGRES_PORT}else{'5433'})
Set-Default 'Database__Name' $(if($env:POSTGRES_DB){$env:POSTGRES_DB}else{'filharmonia'})
Set-Default 'Database__Username' $(if($env:POSTGRES_USER){$env:POSTGRES_USER}else{'filharmonia'})
Set-Default 'Database__Password' $env:POSTGRES_PASSWORD
Set-Default 'ASPNETCORE_ENVIRONMENT' 'Development'
Set-Default 'ASPNETCORE_URLS' $(if($env:API_PORT){'http://0.0.0.0:'+$env:API_PORT}else{'http://0.0.0.0:5296'})
Set-Default 'Identity__FrontendUrl' $(if($env:PUBLIC_SITE_URL){$env:PUBLIC_SITE_URL}else{'http://localhost:4200'})
if (-not $env:Database__Password -and -not $env:ConnectionStrings__ContentDatabase) { throw 'Ustaw Database__Password lub ConnectionStrings__ContentDatabase w środowisku.' }
Push-Location -LiteralPath $projectRoot
try {
    if ($StartDatabase) {
        if (-not $env:POSTGRES_PASSWORD) { $env:POSTGRES_PASSWORD = $env:Database__Password }
        docker compose up -d --wait postgres
        if ($LASTEXITCODE -ne 0) { throw 'Nie udało się uruchomić PostgreSQL.' }
    }
    dotnet run --project WUD2026 --no-launch-profile
    if ($LASTEXITCODE -ne 0) { throw 'API zakończyło się błędem.' }
} finally { Pop-Location }
