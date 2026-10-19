param([string]$Destination, [string]$EnvFile = ".env", [string]$ComposeFile = "compose.yaml")
$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent $PSScriptRoot
if (-not $Destination) {
    $backupName = 'filharmonia-' + (Get-Date -Format 'yyyyMMdd-HHmmss') + '.dump'
    $Destination = Join-Path (Join-Path $projectRoot 'Backups') $backupName
}
$Destination = [System.IO.Path]::GetFullPath($Destination)
$backupDirectory = Split-Path -Parent $Destination
New-Item -ItemType Directory -Path $backupDirectory -Force | Out-Null
if (Test-Path -LiteralPath $Destination) { throw 'Plik docelowy już istnieje. Podaj nową nazwę kopii.' }
Push-Location -LiteralPath $projectRoot
try {
    docker compose --env-file $EnvFile -f $ComposeFile exec -T postgres sh -c 'pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" --format=custom --file=/tmp/filharmonia-backup.dump' 
    if ($LASTEXITCODE -ne 0) { throw 'pg_dump zakończył się błędem.' }
    docker compose --env-file $EnvFile -f $ComposeFile cp postgres:/tmp/filharmonia-backup.dump $Destination
    if ($LASTEXITCODE -ne 0) { throw 'Nie udało się skopiować kopii bazy.' }
    Write-Output $Destination
}
finally { Pop-Location }
