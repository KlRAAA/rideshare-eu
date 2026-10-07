# Back up the production (Railway) database into
# %USERPROFILE%\rideshare-backups\production\<timestamp>\, outside the repo.
#
# The database's public address is read from a file outside the repo, so it is
# never typed on a command line, shown, or committed:
#   %USERPROFILE%\.rideshare\production-database-url.txt
#   (Railway -> Postgres -> Variables -> DATABASE_PUBLIC_URL)
#
# Run it by hand before UAT, and weekly through Task Scheduler
# (docs/deployment/railway-vercel.md, "Backups"). Restore with:
#   $env:DATABASE_URL = '<target>'; node scripts/restore-db.mjs <backup folder>
$ErrorActionPreference = 'Stop'

$urlFile = Join-Path $env:USERPROFILE '.rideshare\production-database-url.txt'
if (-not (Test-Path $urlFile)) {
  throw "Missing $urlFile. Paste the Railway DATABASE_PUBLIC_URL into it (one line)."
}

$env:DATABASE_URL = (Get-Content $urlFile -Raw).Trim()
$env:BACKUP_DIR = Join-Path $env:USERPROFILE 'rideshare-backups\production'
Set-Location (Split-Path -Parent $PSScriptRoot)

node scripts/backup-db.mjs
if ($LASTEXITCODE -ne 0) { throw "Backup failed (exit code $LASTEXITCODE)." }
