param(
  [Parameter(Mandatory = $true)]
  [string]$SourceUrl,

  [Parameter(Mandatory = $true)]
  [string]$TargetUrl,

  [switch]$SkipTargetEmptyCheck
)

$ErrorActionPreference = 'Stop'

$postgresBin = 'C:\Program Files\PostgreSQL\17\bin'
if (Test-Path -LiteralPath $postgresBin) {
  $env:PATH = "$postgresBin;$env:PATH"
}

$tables = @(
  'accounts',
  'ai_provider_credentials',
  'analytics_snapshots',
  'blog_articles',
  'brand_templates',
  'brands',
  'clip_candidate_batches',
  'clip_candidates',
  'clips',
  'graphic_assets',
  'memberships',
  'music_tracks',
  'platform_accounts',
  'platform_app_credentials',
  'platform_post_results',
  'post_copies',
  'post_copy_batches',
  'publishing_packages',
  'rendered_clip_assets',
  'review_comments',
  'scheduled_posts',
  'script_segments',
  'source_assets',
  'thumbnail_assets',
  'transcripts',
  'users',
  'video_scripts'
)

foreach ($command in @('pg_dump', 'pg_restore', 'psql')) {
  if (-not (Get-Command $command -ErrorAction SilentlyContinue)) {
    throw "PostgreSQL client command '$command' is required but was not found."
  }
}

function Get-TableCount {
  param([string]$Url, [string]$Table)
  $result = & psql $Url --no-psqlrc --tuples-only --no-align --command "select count(*) from public.$Table;"
  if ($LASTEXITCODE -ne 0) { throw "Could not count public.$Table" }
  return [long]$result.Trim()
}

if (-not $SkipTargetEmptyCheck) {
  $nonEmpty = @()
  foreach ($table in $tables) {
    if ((Get-TableCount -Url $TargetUrl -Table $table) -ne 0) { $nonEmpty += $table }
  }
  if ($nonEmpty.Count -gt 0) {
    throw "Target tables are not empty: $($nonEmpty -join ', '). Use a fresh Neon database or explicitly pass -SkipTargetEmptyCheck after reviewing duplicate-key risk."
  }
}

$dumpPath = Join-Path ([System.IO.Path]::GetTempPath()) "svt-neon-$([guid]::NewGuid().ToString('N')).dump"

try {
  $tableArgs = @()
  foreach ($table in $tables) { $tableArgs += @('--table', "public.$table") }

  & pg_dump $SourceUrl --format=custom --data-only --no-owner --no-privileges @tableArgs --file $dumpPath
  if ($LASTEXITCODE -ne 0) { throw 'pg_dump failed.' }

  # Clip.selectedPostCopyId and PostCopy.clipId form a circular dependency.
  # Remove only the nullable side while loading, then restore it immediately.
  & psql $TargetUrl --no-psqlrc --set ON_ERROR_STOP=1 --command 'ALTER TABLE public.clips DROP CONSTRAINT "clips_selectedPostCopyId_fkey";'
  if ($LASTEXITCODE -ne 0) { throw 'Could not temporarily remove the circular clip/post-copy foreign key.' }

  & pg_restore --dbname $TargetUrl --data-only --no-owner --no-privileges --exit-on-error $dumpPath
  if ($LASTEXITCODE -ne 0) { throw 'pg_restore failed.' }


  & psql $TargetUrl --no-psqlrc --set ON_ERROR_STOP=1 --command 'ALTER TABLE public.clips ADD CONSTRAINT "clips_selectedPostCopyId_fkey" FOREIGN KEY ("selectedPostCopyId") REFERENCES public.post_copies(id) ON DELETE SET NULL ON UPDATE CASCADE;'
  if ($LASTEXITCODE -ne 0) { throw 'Could not restore the circular clip/post-copy foreign key.' }

  $mismatches = @()
  foreach ($table in $tables) {
    $sourceCount = Get-TableCount -Url $SourceUrl -Table $table
    $targetCount = Get-TableCount -Url $TargetUrl -Table $table
    $status = if ($sourceCount -eq $targetCount) { 'OK' } else { 'MISMATCH' }
    Write-Output ("{0,-32} source={1,-8} target={2,-8} {3}" -f $table, $sourceCount, $targetCount, $status)
    if ($sourceCount -ne $targetCount) { $mismatches += $table }
  }

  if ($mismatches.Count -gt 0) {
    throw "Row-count validation failed: $($mismatches -join ', ')"
  }

  Write-Output 'Video database copy and row-count validation completed successfully.'
} finally {
  Remove-Item -LiteralPath $dumpPath -Force -ErrorAction SilentlyContinue
}
