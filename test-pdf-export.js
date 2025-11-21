// Simple test script to check if our PDF export endpoints are working
// This can be run after starting the server to verify functionality

const fetch = require('node:fetch');

const BASE_URL = 'http://localhost:3000';

async function testEndpoints() {
  console.log('🧪 Testing PDF Export Endpoints...\n');

  // Test 1: Performance Alerts
  console.log('1️⃣ Testing Performance Alerts...');
  try {
    const response = await fetch(`${BASE_URL}/api/performance/alerts`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        // You'd need to add proper authentication headers here
      }
    });
    
    console.log(`   Status: ${response.status}`);
    if (response.ok) {
      const alerts = await response.json();
      console.log(`   ✅ Found ${alerts.length} alerts`);
    } else {
      console.log(`   ❌ Error: ${response.statusText}`);
    }
  } catch (error) {
    console.log(`   ❌ Failed: ${error.message}`);
  }

  console.log('\n2️⃣ Testing Proposal PDF Export...');
  // You'd need to have a valid proposal ID to test
  console.log('   ⚠️  Would need valid proposal ID and authentication to test');

  console.log('\n3️⃣ Testing Manager PDF Export...');
  console.log('   ⚠️  Would need valid proposal ID and manager authentication to test');

  console.log('\n🎯 Key improvements made:');
  console.log('   • Fixed performance alerts with better error handling');
  console.log('   • Enhanced Puppeteer configuration for Replit environment');
  console.log('   • Added comprehensive logging for debugging');
  console.log('   • Improved database query resilience');
  console.log('   • Better error messages and status codes');
}

if (require.main === module) {
  testEndpoints().catch(console.error);
}

module.exports = { testEndpoints };
