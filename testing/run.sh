#!/bin/bash

# Printyx Comprehensive Testing Suite Runner
# This script provides an easy way to run the full test suite

set -e

echo "🚀 Printyx Comprehensive Testing Suite"
echo "======================================="

# Check if we're in the right directory
if [ ! -f "run-tests.js" ]; then
    echo "❌ Error: Please run this script from the testing directory"
    echo "   cd testing && ./run.sh"
    exit 1
fi

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo "❌ Error: Node.js is not installed"
    echo "   Please install Node.js 16+ and try again"
    exit 1
fi

# Check if npm is installed
if ! command -v npm &> /dev/null; then
    echo "❌ Error: npm is not installed"
    echo "   Please install npm and try again"
    exit 1
fi

echo "📦 Installing dependencies..."
npm install

echo ""
echo "🧪 Starting comprehensive test suite..."
echo "   This will test all routes, buttons, and forms"
echo "   Screenshots will be saved to ./test-results/"
echo ""

# Run the tests
if npm run test; then
    echo ""
    echo "✅ Tests completed successfully!"
    echo ""
    echo "📄 Generated reports:"
    echo "   📊 test-results/orchestrated-test-results.json"
    echo "   📋 test-results/test-summary.json"
    echo "   🎯 test-results/actionable-report.json"
    echo "   🌐 test-results/test-report.html"
    echo "   📸 test-results/screenshots/"
    echo ""
    echo "🎯 Next steps:"
    echo "   1. Review the actionable report for priority fixes"
    echo "   2. Open test-report.html in your browser for visual results"
    echo "   3. Address any critical errors or warnings found"
else
    echo ""
    echo "❌ Tests failed!"
    echo "   Check the output above for error details"
    echo "   Common issues:"
    echo "   - Server failed to start (check port 5000)"
    echo "   - Puppeteer installation issues"
    echo "   - Network connectivity problems"
    exit 1
fi