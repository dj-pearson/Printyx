/**
 * Generate Apple Client Secret from JWT
 *
 * This script generates a client_secret for Sign in with Apple OAuth
 * by creating a signed JWT token using your Apple credentials.
 *
 * Required inputs:
 * - Team ID (from Apple Developer account)
 * - Key ID (from your .p8 key in Apple Developer)
 * - .p8 private key file path
 * - Client ID (Services ID from Apple)
 *
 * Usage:
 *   node scripts/generate-apple-client-secret.js
 *
 * Or with custom values:
 *   node scripts/generate-apple-client-secret.js --team YOUR_TEAM_ID --keyid YOUR_KEY_ID --keyfile ./path/to/key.p8 --clientid com.yourapp.service
 */

const jwt = require('jsonwebtoken');
const fs = require('fs');
const path = require('path');

// Parse command line arguments
const args = process.argv.slice(2);
const getArg = (flag) => {
  const index = args.indexOf(flag);
  return index !== -1 ? args[index + 1] : null;
};

// Configuration - Update these with your Apple Developer credentials
const TEAM_ID = getArg('--team') || process.env.APPLE_TEAM_ID || 'YOUR_TEAM_ID';
const KEY_ID = getArg('--keyid') || process.env.APPLE_KEY_ID || 'YOUR_KEY_ID';
const KEY_FILE = getArg('--keyfile') || process.env.APPLE_KEY_FILE || './AuthKey.p8';
const CLIENT_ID = getArg('--clientid') || process.env.APPLE_CLIENT_ID || 'com.yourapp.service';

// Validate inputs
if (TEAM_ID === 'YOUR_TEAM_ID') {
  console.error('❌ Error: TEAM_ID not set');
  console.log('\nPlease provide your Apple Team ID:');
  console.log('  --team YOUR_TEAM_ID');
  console.log('  or set APPLE_TEAM_ID environment variable');
  process.exit(1);
}

if (KEY_ID === 'YOUR_KEY_ID') {
  console.error('❌ Error: KEY_ID not set');
  console.log('\nPlease provide your Apple Key ID:');
  console.log('  --keyid YOUR_KEY_ID');
  console.log('  or set APPLE_KEY_ID environment variable');
  process.exit(1);
}

if (!fs.existsSync(KEY_FILE)) {
  console.error(`❌ Error: Key file not found: ${KEY_FILE}`);
  console.log('\nPlease provide the path to your .p8 key file:');
  console.log('  --keyfile ./path/to/AuthKey.p8');
  console.log('  or set APPLE_KEY_FILE environment variable');
  process.exit(1);
}

try {
  console.log('🔐 Generating Apple Client Secret...\n');

  // Read the private key
  const privateKey = fs.readFileSync(path.resolve(KEY_FILE), 'utf8');

  // JWT payload
  const payload = {
    iss: TEAM_ID,
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + 86400 * 180, // 180 days (max allowed)
    aud: 'https://appleid.apple.com',
    sub: CLIENT_ID,
  };

  // JWT header
  const header = {
    alg: 'ES256',
    kid: KEY_ID,
  };

  // Generate the JWT
  const clientSecret = jwt.sign(payload, privateKey, {
    algorithm: 'ES256',
    header: header,
  });

  console.log('✅ Client Secret Generated Successfully!\n');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  console.log('Copy this to your .env file as APPLE_CLIENT_SECRET:\n');
  console.log(clientSecret);
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  console.log('Configuration used:');
  console.log(`  Team ID:   ${TEAM_ID}`);
  console.log(`  Key ID:    ${KEY_ID}`);
  console.log(`  Client ID: ${CLIENT_ID}`);
  console.log(`  Key File:  ${KEY_FILE}`);
  console.log(`  Expires:   ${new Date(payload.exp * 1000).toLocaleString()}`);
  console.log(
    "\n⚠️  Note: This token expires in 180 days. You'll need to regenerate it after that.\n",
  );
} catch (error) {
  console.error('❌ Error generating client secret:', error.message);

  if (error.message.includes('PEM')) {
    console.log('\n💡 Make sure your .p8 file is valid and properly formatted.');
    console.log('   The file should start with: -----BEGIN PRIVATE KEY-----');
  }

  process.exit(1);
}
