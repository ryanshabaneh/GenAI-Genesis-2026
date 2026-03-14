# test-with-claude.ps1
# Runs the analyzer test suite and pipes results to Claude Code for analysis.
# No API key needed — Claude Code uses its own authentication.
#
# Usage:
#   .\test-with-claude.ps1              # run all tests, pipe summary to claude
#   .\test-with-claude.ps1 -File cicd   # run only cicd tests
#   .\test-with-claude.ps1 -Fix         # run tests, ask claude to fix failures

param(
    [string]$File = "",
    [switch]$Fix,
    [switch]$Verbose
)

$ErrorActionPreference = "Continue"
$serverDir = $PSScriptRoot

# Build the vitest command
$testCmd = "npx vitest run --reporter=verbose"
if ($File) {
    $testCmd += " --testPathPattern `"$File`""
}

Write-Host "Running tests..." -ForegroundColor Cyan
$testOutput = & cmd /c "cd `"$serverDir`" && $testCmd 2>&1"
$exitCode = $LASTEXITCODE

# Show raw output if verbose
if ($Verbose) {
    $testOutput | ForEach-Object { Write-Host $_ }
}

# Count results from output
$passed = ($testOutput | Select-String -Pattern "Tests\s+.*?(\d+) passed" | ForEach-Object { $_.Matches.Groups[1].Value }) -as [int]
$failed = ($testOutput | Select-String -Pattern "Tests\s+.*?(\d+) failed" | ForEach-Object { $_.Matches.Groups[1].Value }) -as [int]
if (-not $passed) { $passed = 0 }
if (-not $failed) { $failed = 0 }

Write-Host ""
if ($exitCode -eq 0) {
    Write-Host "All $passed tests passed." -ForegroundColor Green
} else {
    Write-Host "$failed failed, $passed passed." -ForegroundColor Red
}

# Pipe to Claude Code for analysis
$joinedOutput = $testOutput -join "`n"

if ($Fix -and $exitCode -ne 0) {
    Write-Host "`nAsking Claude Code to diagnose and fix failures..." -ForegroundColor Yellow
    $prompt = @"
Here are the vitest test results for the ShipCity scanner analyzers. Some tests failed.

$joinedOutput

Read the failing test files and the corresponding analyzer source files under server/src/scanner/analyzers/.
Identify the root cause of each failure and fix the source code (not the tests) so all tests pass.
Do not change any test expectations. Run the tests again after fixing to confirm.
"@
    $prompt | claude
} elseif ($exitCode -ne 0) {
    Write-Host "`nAsking Claude Code to summarize failures..." -ForegroundColor Yellow
    $prompt = @"
Here are the vitest test results for the ShipCity scanner analyzers. Summarize what failed and why.
Be concise — list each failure with a one-line root cause.

$joinedOutput
"@
    $prompt | claude -p
} else {
    Write-Host "`nAsking Claude Code to verify coverage against execution plan..." -ForegroundColor Yellow
    $prompt = @"
Here are the vitest test results for the ShipCity scanner analyzers (all passing):

$joinedOutput

Cross-reference these test names against the execution plan in shipcity-execution-plan.md.
For each analyzer (cicd, docker, logging, deployment, security), confirm:
1. All 4 tasks from the plan are tested
2. The 0%/25%/50%/75%/100% progression is covered
3. Edge cases are adequate

Be concise. Flag any gaps.
"@
    $prompt | claude -p
}
