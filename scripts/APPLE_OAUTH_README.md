# Apple OAuth Client Secret Generator

This script generates the `client_secret` JWT token required for Sign in with Apple OAuth integration.

## Prerequisites

1. **Apple Developer Account** with Sign in with Apple enabled
2. **Services ID** created in Apple Developer Console
3. **Private Key (.p8 file)** downloaded from Apple Developer Console
4. Your **Team ID** and **Key ID** from Apple Developer

## How to Get Your Credentials

### 1. Team ID
1. Go to [Apple Developer Account](https://developer.apple.com/account)
2. Click on "Membership" in the sidebar
3. Your Team ID is displayed there (format: `ABC1234567`)

### 2. Create a Services ID (Client ID)
1. Go to [Certificates, Identifiers & Profiles](https://developer.apple.com/account/resources)
2. Click "Identifiers" → "+"
3. Select "Services IDs" → Continue
4. Enter:
   - Description: `Printyx Web Auth`
   - Identifier: `com.printyx.web` (or your domain format)
5. Enable "Sign in with Apple"
6. Configure:
   - Domains: `yourdomain.com`
   - Return URLs: `https://yourdomain.com/auth/callback`

### 3. Create a Key (.p8 file)
1. Go to "Keys" → "+"
2. Enter Key Name: `Printyx Sign in with Apple Key`
3. Enable "Sign in with Apple"
4. Click "Configure" next to Sign in with Apple
5. Select your Primary App ID
6. Click "Save" → "Continue" → "Register"
7. **Download the .p8 file** (you can only download it once!)
8. Note your **Key ID** (format: `ABC123DEFG`)

## Usage

### Option 1: PowerShell (Windows)

```powershell
# Run with parameters
.\scripts\generate-apple-client-secret.ps1 `
  -TeamId "YOUR_TEAM_ID" `
  -KeyId "YOUR_KEY_ID" `
  -KeyFile ".\path\to\AuthKey.p8" `
  -ClientId "com.yourapp.service"

# Or set environment variables
$env:APPLE_TEAM_ID = "ABC1234567"
$env:APPLE_KEY_ID = "ABC123DEFG"
$env:APPLE_KEY_FILE = ".\AuthKey.p8"
$env:APPLE_CLIENT_ID = "com.printyx.web"

.\scripts\generate-apple-client-secret.ps1
```

### Option 2: Node.js (Cross-platform)

```bash
# Run with parameters
node scripts/generate-apple-client-secret.js \
  --team YOUR_TEAM_ID \
  --keyid YOUR_KEY_ID \
  --keyfile ./path/to/AuthKey.p8 \
  --clientid com.yourapp.service

# Or set environment variables
export APPLE_TEAM_ID="ABC1234567"
export APPLE_KEY_ID="ABC123DEFG"
export APPLE_KEY_FILE="./AuthKey.p8"
export APPLE_CLIENT_ID="com.printyx.web"

node scripts/generate-apple-client-secret.js
```

## Example Output

```
🔐 Generating Apple Client Secret...

✅ Client Secret Generated Successfully!

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Copy this to your .env file as APPLE_CLIENT_SECRET:

eyJhbGciOiJFUzI1NiIsImtpZCI6IkFCQzEyM0RFRkcifQ.eyJpc3MiOiJBQkMxMjM0NTY3IiwiaWF0IjoxNjc...

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Configuration used:
  Team ID:   ABC1234567
  Key ID:    ABC123DEFG
  Client ID: com.printyx.web
  Key File:  ./AuthKey.p8
  Expires:   8/9/2026, 10:30:00 AM

⚠️  Note: This token expires in 180 days. You'll need to regenerate it after that.
```

## Add to Your Environment

Copy the generated token to your `.env` file:

```env
# Apple OAuth Configuration
APPLE_CLIENT_ID=com.printyx.web
APPLE_CLIENT_SECRET=eyJhbGciOiJFUzI1NiIsImtpZCI6IkFCQzEyM0RFRkcifQ...
```

## Troubleshooting

### "Key file not found"
- Make sure the path to your .p8 file is correct
- Use relative paths from the project root (e.g., `./AuthKey.p8`)

### "PEM format error"
- Verify your .p8 file is valid
- It should start with: `-----BEGIN PRIVATE KEY-----`
- Make sure it's not corrupted or modified

### "Invalid signature"
- Double-check your Team ID matches your Apple Developer account
- Verify the Key ID matches the key you downloaded
- Ensure your Services ID (Client ID) is correct

## Token Expiration

Apple requires JWT tokens to expire. The maximum allowed is **180 days** (6 months).

**Set a reminder to regenerate your client secret every 6 months!**

You can automate this by running the script in your CI/CD pipeline or setting up a calendar reminder.

## Security Notes

⚠️ **Never commit your .p8 file or generated client_secret to version control!**

Add to `.gitignore`:
```
*.p8
AuthKey*.p8
.env
.env.local
```

## Related Documentation

- [OAUTH_SELF_HOSTED_GUIDE.md](../OAUTH_SELF_HOSTED_GUIDE.md) - How to implement OAuth with self-hosted Supabase
- [AUTH_SETUP_DOCUMENTATION.md](../AUTH_SETUP_DOCUMENTATION.md) - Complete auth setup guide
- [Apple Sign In Documentation](https://developer.apple.com/sign-in-with-apple/get-started/)
