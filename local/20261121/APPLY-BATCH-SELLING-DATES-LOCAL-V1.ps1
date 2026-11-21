<#
BIG BROTHER Local Brain V5/V6
Batch Selling Date Range Editor - guarded one-time database parity installer.
Read-only by default; use -Apply to create a backup and install the patch.
Never connects to Cloud Supabase or uploads local business records.
Run after Local Brain is started, then use Control Center Code Sync.
#>
[CmdletBinding()]
param(
    [switch]$Apply,
    [string]$Container = 'supabase_db_Local_Brain',
    [string]$Database = 'postgres',
    [string]$DbUser = 'postgres'
)
Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'

$PatchName = '20261121_local_brain_batch_selling_window_parity_v1.sql'
$ExpectedGitBlobSHA1 = '60b68f869af3b67e5214169245e175eb30a9ab21'
$ReleaseCommit = 'c32c61a865213d4812b8e1b1618eee4432b3a336'
$LocalImage = 'supabase_db_Local_Brain'
if ($Container -cne $LocalImage) {
    throw "Refusing to target anything except the Local Brain Docker container: $LocalImage"
}
if (-not (Get-Command docker -ErrorAction SilentlyContinue)) {
    throw 'Docker is not installed or not available on PATH.'
}
$running = (& docker inspect -f '{{.State.Running}}' $Container 2>&1 | Out-String).Trim()
if ($LASTEXITCODE -ne 0 -or $running -ne 'true') {
    throw 'Local Brain PostgreSQL container is not running. Start Local Brain first.'
}
$databaseCheck = (& docker exec $Container psql -X -U $DbUser -d $Database -Atq -c "SELECT CASE WHEN to_regclass('public.stock_batches') IS NOT NULL AND to_regclass('public.invoices') IS NOT NULL THEN 'BB_LOCAL_READY' ELSE 'WRONG_DATABASE' END" 2>&1 | Out-String).Trim()
if ($LASTEXITCODE -ne 0 -or $databaseCheck -ne 'BB_LOCAL_READY') {
    throw 'The selected container/database is not a ready BIG BROTHER Local Brain database. Nothing applied.'
}
Write-Host ('Local database preflight OK: ' + $Container + ' / ' + $Database) -ForegroundColor Green

$foundSQL = Join-Path $PSScriptRoot $PatchName
$temporarySQL = $null
if (-not (Test-Path -LiteralPath $foundSQL -PathType Leaf)) {
    $temporarySQL = Join-Path ([IO.Path]::GetTempPath()) ('BB-LOCAL-BATCH-WINDOW-' + [guid]::NewGuid().ToString('N') + '.sql')
    $url = 'https://raw.githubusercontent.com/angsokhey11-cloud/big-brother-stock-report/' + $ReleaseCommit + '/sql/' + $PatchName
    try {
        Invoke-WebRequest -UseBasicParsing -Uri $url -OutFile $temporarySQL
        $foundSQL = $temporarySQL
    } catch {
        throw ('Cannot retrieve the matching SQL patch. Download ' + $PatchName + ' from the GitHub release and place it next to this PowerShell file. ' + $_.Exception.Message)
    }
}
function Get-GitBlobSHA1([string]$fileName) {
    [byte[]]$bytes = [System.IO.File]::ReadAllBytes($fileName)
    [byte[]]$prefix = [Text.Encoding]::ASCII.GetBytes(("blob " + $bytes.Length + [char]0))
    [byte[]]$inputBytes = New-Object byte[] ($prefix.Length + $bytes.Length)
    [Array]::Copy($prefix, 0, $inputBytes, 0, $prefix.Length)
    [Array]::Copy($bytes, 0, $inputBytes, $prefix.Length, $bytes.Length)
    $sha1 = [System.Security.Cryptography.SHA1]::Create()
    try { return ([BitConverter]::ToString($sha1.ComputeHash($inputBytes))).Replace('-', '').ToLowerInvariant() }
    finally { $sha1.Dispose() }
}
$actualHash = Get-GitBlobSHA1 $foundSQL
if ($actualHash -ne $ExpectedGitBlobSHA1) {
    throw 'SQL patch checksum mismatch. Refusing to execute an unexpected SQL file.'
}
Write-Host 'SQL patch integrity verified against the pinned GitHub release.' -ForegroundColor Green

if (-not $Apply) {
    Write-Host 'CHECK-ONLY PASS. Database and SQL verified, but no data or schema changed.' -ForegroundColor Yellow
    Write-Host 'Run this script with -Apply to save a full local backup and install the patch.'
    if ($temporarySQL -and (Test-Path $temporarySQL)) { Remove-Item -LiteralPath $temporarySQL -Force }
    exit 0
}

$stamp = Get-Date -Format 'yyyyMMdd-HHmmss'
$backupDir = Join-Path $PSScriptRoot 'LOCAL-BACKUPS'
New-Item -Path $backupDir -ItemType Directory -Force | Out-Null
$backupPath = Join-Path $backupDir ('LOCAL-BEFORE-BATCH-SELLING-' + $stamp + '.dump')
$remoteBackup = '/tmp/bb-batch-selling-' + $stamp + '.dump'

Write-Host 'Creating FULL local PostgreSQL backup before any schema changes...'
try {
    & docker exec $Container pg_dump -U $DbUser -d $Database -Fc -f $remoteBackup
    if ($LASTEXITCODE -ne 0) { throw 'Full local pg_dump failed.' }
    & docker exec $Container pg_restore --list $remoteBackup | Out-Null
    if ($LASTEXITCODE -ne 0) { throw 'Backup archive validation failed.' }
    & docker cp ($Container + ':' + $remoteBackup) $backupPath
    if ($LASTEXITCODE -ne 0) { throw 'Could not copy the backup to Windows.' }
    if ((Get-Item -LiteralPath $backupPath).Length -lt 1024) { throw 'Backup is unexpectedly empty.' }
    Write-Host ('Local backup: ' + $backupPath) -ForegroundColor Green
} finally {
    & docker exec $Container rm -f $remoteBackup 2>&1 | Out-Null
}
Write-Host 'Applying schema/RPC patch ONLY to Local Brain (no Cloud connection)...'
# Use ASCII-safe SQL so Windows PowerShell's native stdin encoding is compatible.
Get-Content -LiteralPath $foundSQL -Raw -Encoding UTF8 |
    & docker exec -i $Container psql -X -U $DbUser -d $Database -v ON_ERROR_STOP=1
if ($LASTEXITCODE -ne 0) {
    throw ('Patch failed and its SQL transaction rolled back. Full local backup is preserved at ' + $backupPath)
}
Write-Host 'LOCAL BATCH SELLING DATE RANGE PATCH APPLIED.' -ForegroundColor Green
Write-Host 'Next: Control Center -> Code Sync -> open V5/V6 Batch Editor -> test date-only Save Changes.'
Write-Host 'Do NOT run Cloud-to-Local Refresh solely for this patch.'
if ($temporarySQL -and (Test-Path $temporarySQL)) { Remove-Item -LiteralPath $temporarySQL -Force }
