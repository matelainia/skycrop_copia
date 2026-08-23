# ==============================================================================
# Auditoría automatizada de datos mock — SkyCrop (FASE 18)
# Uso: powershell -ExecutionPolicy Bypass -File scripts\audit-mock-data.ps1
# Escanea frontend y backend en busca de patrones de datos ficticios.
# Los hallazgos deben revisarse MANUALMENTE: no todo match es un problema.
# ==============================================================================

$root = Split-Path -Parent $PSScriptRoot
$targets = @(
  "$root\apps\web\src",
  "$root\backend\src"
)
$patterns = @('mockData','MOCK_','useMock','USE_MOCK','dummy','fakeData','sampleData','demoData','initialData','hardcod','fallback a mock','mockPlans','mockDashboard','createDemo','seedUserData','initializeDemo')
$exclude = @('node_modules','.next','dist','test','__tests__','\.spec\.')

$findings = @()
foreach ($t in $targets) {
  $files = Get-ChildItem -Recurse -File -Include *.js,*.jsx,*.ts,*.tsx -Path $t -ErrorAction SilentlyContinue |
    Where-Object { $n = $_.FullName; -not ($exclude | Where-Object { $n -match $_ }) }
  foreach ($f in $files) {
    $hits = Select-String -Path $f.FullName -Pattern $patterns -ErrorAction SilentlyContinue
    foreach ($h in $hits) {
      # Heurística: nombres de archivo legítimos de test/mocks documentados se marcan igual
      $findings += [PSCustomObject]@{
        Archivo = $f.FullName.Substring($root.Length + 1)
        Linea   = $h.LineNumber
        Patron  = $h.Matches[0].Value
        Texto   = $h.Line.Trim()
      }
    }
  }
}

if ($findings.Count -eq 0) {
  Write-Host "OK: sin coincidencias de patrones mock." -ForegroundColor Green
} else {
  Write-Host "Hallazgos a revisar manualmente: $($findings.Count)" -ForegroundColor Yellow
  $findings | Format-Table Archivo, Linea, Patron -AutoSize
  $out = Join-Path $PSScriptRoot 'audit-mock-results.txt'
  $findings | Out-File $out -Encoding UTF8
  Write-Host "Detalle completo en: $out"
}
