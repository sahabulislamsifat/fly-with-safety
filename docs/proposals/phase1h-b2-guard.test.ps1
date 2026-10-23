# Offline regression: execute only the wrapper's AST-selected migration guard, never its auth/DB code.
$ErrorActionPreference = 'Stop'
$tokens = $null
$errors = $null
$ast = [System.Management.Automation.Language.Parser]::ParseFile(
    (Join-Path $PSScriptRoot 'phase1h-b2-local-prisma.ps1'), [ref]$tokens, [ref]$errors)
if ($errors.Count) { throw 'Wrapper syntax invalid' }
$statements = @($ast.EndBlock.Statements)
$start = @($statements | Where-Object { $_ -is [System.Management.Automation.Language.AssignmentStatementAst] -and $_.Left.Extent.Text -eq '$expected' })[0]
$finish = @($statements | Where-Object { $_ -is [System.Management.Automation.Language.ForEachStatementAst] -and $_.Variable.Extent.Text -eq '$migration' })[0]
if (!$start -or !$finish) { throw 'Guard boundaries missing' }
$serverDirectory = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '../../server'))
$source = $ast.Extent.Text
$guard = $source.Substring($start.Extent.StartOffset, $finish.Extent.EndOffset - $start.Extent.StartOffset)
$guard = $guard.Replace('$PSScriptRoot', ("'" + $PSScriptRoot.Replace("'", "''") + "'"))
. ([scriptblock]::Create($guard))
if ($expected.Count -ne 7) { throw 'JSON records were not flattened' }
Write-Output 'PASS: seven records, directories, SQL files and raw SHA-256 hashes'
# Reuse the actual comparison and hash checks with in-memory corruption; no files are changed.
$setCheck = @($statements | Where-Object { $_ -is [System.Management.Automation.Language.IfStatementAst] -and $_.Extent.Text.Contains('$directories.Count') })[0]
$original = $expected
$expected = @($expected | Select-Object -First 6)
$rejected = $false
try { & ([scriptblock]::Create($setCheck.Extent.Text)) } catch { $rejected = $true }
if (!$rejected) { throw 'Missing record accepted' }
$expected = @($original | ForEach-Object { [pscustomobject]@{ name=$_.name; sha256=$_.sha256 } })
$expected[0].sha256 = '0' * 64
$rejected = $false
try { & ([scriptblock]::Create($finish.Extent.Text)) } catch { $rejected = $true }
if (!$rejected) { throw 'Changed hash accepted' }
$patternNode = @($ast.FindAll({param($n) $n -is [System.Management.Automation.Language.StringConstantExpressionAst] -and $n.Value.StartsWith('^postgresql://postgres:')}, $true))[0]
$local = 'postgresql://postgres:synthetic@127.0.0.1:5432/flywithsafe_phase1h_integration'
if ($local -cnotmatch $patternNode.Value) { throw 'Local target rejected' }
foreach ($bad in @($local.Replace('127.0.0.1','remote.example'), $local.Replace('flywithsafe_phase1h_integration','flywithsafe_integration'), ($local+'?host=remote.example'))) {
    if ($bad -cmatch $patternNode.Value) { throw 'Unsafe target accepted' }
}
Write-Output 'PASS: missing record and changed hash rejected; target isolation passed'

