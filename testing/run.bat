@echo off
setlocal enabledelayedexpansion

REM Printyx Comprehensive Testing Suite Runner (Windows)
REM This script provides an easy way to run the full test suite

echo 🚀 Printyx Comprehensive Testing Suite
echo =======================================

REM Check if we're in the right directory
if not exist "run-tests.js" (
    echo ❌ Error: Please run this script from the testing directory
    echo    cd testing ^&^& run.bat
    exit /b 1
)

REM Check if Node.js is installed
where node >nul 2>nul
if %errorlevel% neq 0 (
    echo ❌ Error: Node.js is not installed
    echo    Please install Node.js 16+ and try again
    exit /b 1
)

REM Check if npm is installed
where npm >nul 2>nul
if %errorlevel% neq 0 (
    echo ❌ Error: npm is not installed
    echo    Please install npm and try again
    exit /b 1
)

echo 📦 Installing dependencies...
call npm install
if %errorlevel% neq 0 (
    echo ❌ Failed to install dependencies
    exit /b 1
)

echo.
echo 🧪 Starting comprehensive test suite...
echo    This will test all routes, buttons, and forms
echo    Screenshots will be saved to .\test-results\
echo.

REM Run the tests
call npm run test
if %errorlevel% equ 0 (
    echo.
    echo ✅ Tests completed successfully!
    echo.
    echo 📄 Generated reports:
    echo    📊 test-results\orchestrated-test-results.json
    echo    📋 test-results\test-summary.json
    echo    🎯 test-results\actionable-report.json
    echo    🌐 test-results\test-report.html
    echo    📸 test-results\screenshots\
    echo.
    echo 🎯 Next steps:
    echo    1. Review the actionable report for priority fixes
    echo    2. Open test-report.html in your browser for visual results
    echo    3. Address any critical errors or warnings found
) else (
    echo.
    echo ❌ Tests failed!
    echo    Check the output above for error details
    echo    Common issues:
    echo    - Server failed to start ^(check port 5000^)
    echo    - Puppeteer installation issues
    echo    - Network connectivity problems
    exit /b 1
)

pause