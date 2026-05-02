param(
  [switch]$NoClean
)

$ErrorActionPreference = "Stop"

$ProjectRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$nodeProcesses = Get-CimInstance Win32_Process -Filter "name = 'node.exe'" |
  Where-Object {
    $_.CommandLine -and
    $_.CommandLine -like "*$ProjectRoot*" -and
    (
      $_.CommandLine -like "*next*dist*bin*next*" -or
      $_.CommandLine -like "*next*dist*server*lib*start-server.js*"
    )
  }

$processIds = New-Object 'System.Collections.Generic.HashSet[int]'

foreach ($process in $nodeProcesses) {
  [void]$processIds.Add([int]$process.ProcessId)

  if ($process.ParentProcessId) {
    $parent = Get-CimInstance Win32_Process -Filter "ProcessId = $($process.ParentProcessId)" -ErrorAction SilentlyContinue
    if ($parent -and $parent.CommandLine -and $parent.CommandLine -like "*npm-cli.js*" -and $parent.CommandLine -like "*run dev*") {
      [void]$processIds.Add([int]$parent.ProcessId)
    }
  }
}

foreach ($processId in $processIds) {
  if ($processId -ne $PID) {
    Stop-Process -Id $processId -Force -ErrorAction SilentlyContinue
  }
}

if (-not $NoClean) {
  $nextPath = Join-Path $ProjectRoot ".next"
  if (Test-Path $nextPath) {
    Remove-Item $nextPath -Recurse -Force
  }
}

$env:Path = "$env:ProgramFiles\nodejs;$env:Path"
Set-Location $ProjectRoot

& npm run dev:next -- --hostname 0.0.0.0
exit $LASTEXITCODE