# Back up the production (Railway) database into
# %USERPROFILE%\rideshare-backups\production\<timestamp>\, outside the repo.
#
# The database has no public address. This opens Railway's private tunnel
# (`railway connect Postgres --tunnel-only`), backs up through it, then closes
# it, so the password exists only for the length of the run and is never
# saved. Needs the Railway CLI, logged in (`railway login`) and linked to the
# project from this folder (`railway link`).
#
# Run it by hand before UAT, and weekly through Task Scheduler
# (docs/deployment/railway-vercel.md, "Backups"). Each run appends a line to
# %USERPROFILE%\rideshare-backups\backup.log.
$ErrorActionPreference = 'Stop'

$root = Join-Path $env:USERPROFILE 'rideshare-backups'
$log = Join-Path $root 'backup.log'
$port = 55432
New-Item -ItemType Directory -Force (Join-Path $root 'production') | Out-Null
Set-Location (Split-Path -Parent $PSScriptRoot)

$out = New-TemporaryFile
$tunnel = $null
try {
  # Through cmd.exe: the npm-installed CLI is a .cmd wrapper. taskkill /T below
  # closes the wrapper and the tunnel process together.
  $tunnel = Start-Process -FilePath 'cmd.exe' -ArgumentList '/c', "railway connect Postgres --tunnel-only -P $port" `
    -RedirectStandardOutput $out -RedirectStandardError "$out.err" -PassThru -NoNewWindow

  # Wait for the tunnel to print its connection URL.
  $url = $null
  for ($i = 0; $i -lt 60 -and -not $url; $i++) {
    Start-Sleep -Seconds 1
    if ($tunnel.HasExited) { throw "railway connect stopped: $(Get-Content "$out.err" -Raw)" }
    # The CLI prints the connection details to stderr.
    $match = Select-String -Path $out, "$out.err" -Pattern 'postgres(ql)?://\S+' | Select-Object -First 1
    if ($match) { $url = $match.Matches[0].Value }
  }
  if (-not $url) { throw 'The Railway tunnel did not open within 60 seconds.' }

  $env:DATABASE_URL = $url
  $env:BACKUP_DIR = Join-Path $root 'production'
  node scripts/backup-db.mjs
  if ($LASTEXITCODE -ne 0) { throw "Backup failed (exit code $LASTEXITCODE)." }
  Add-Content $log "$(Get-Date -Format s)  OK"
}
catch {
  Add-Content $log "$(Get-Date -Format s)  FAILED  $($_.Exception.Message -replace '\s+', ' ')"
  throw
}
finally {
  if ($tunnel -and -not $tunnel.HasExited) { taskkill /PID $tunnel.Id /T /F | Out-Null }
  Remove-Item $out, "$out.err" -Force -ErrorAction SilentlyContinue  # they contain the password
  Remove-Item Env:DATABASE_URL -ErrorAction SilentlyContinue
}
