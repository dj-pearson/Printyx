# GitHub Actions Secrets for iOS Deployment

The following secrets must be configured in your GitHub repository settings
(**Settings > Secrets and variables > Actions > New repository secret**) for
the `ios-deploy.yml` workflow to build, sign, and upload to App Store Connect.

---

## Required Secrets

### Apple Developer Identity

| Secret | Description | How to Get |
|--------|-------------|------------|
| `APPLE_DEVELOPER_TEAM_ID` | Your 10-character Apple Developer Team ID | [developer.apple.com](https://developer.apple.com/account) > Membership > Team ID |
| `IOS_CERTIFICATE_P12` | Base64-encoded iOS Distribution Certificate (.p12) | See "Exporting Certificate" below |
| `IOS_CERTIFICATE_PASSWORD` | Password used when exporting the .p12 file | The password you set during export |
| `IOS_PROVISIONING_PROFILE` | Base64-encoded App Store provisioning profile | See "Creating Provisioning Profile" below |
| `KEYCHAIN_PASSWORD` | Any random string (used for temp keychain in CI) | Generate with `openssl rand -hex 32` |

### App Store Connect API

| Secret | Description | How to Get |
|--------|-------------|------------|
| `APP_STORE_CONNECT_API_KEY_ID` | API Key ID (e.g., `ABC123DEFG`) | [appstoreconnect.apple.com](https://appstoreconnect.apple.com/access/integrations/api) > Keys > Generate |
| `APP_STORE_CONNECT_ISSUER_ID` | Issuer ID (UUID format) | Same page as API Key, shown at the top |
| `APP_STORE_CONNECT_API_KEY_P8` | Base64-encoded `.p8` private key file contents | Downloaded when you create the API Key (one-time download) |

### App Configuration

| Secret | Description | Example |
|--------|-------------|---------|
| `SUPABASE_URL` | Supabase project API URL | `https://api.printyx.net` |
| `SUPABASE_ANON_KEY` | Supabase anonymous/public key | `eyJhbGciOiJIUzI1NiIs...` |

---

## How to Prepare Each Secret

### Exporting the Distribution Certificate (.p12)

1. Open **Keychain Access** on your Mac
2. Find your "Apple Distribution" certificate under "My Certificates"
3. Right-click > **Export** > Save as `.p12` with a password
4. Base64-encode: `base64 -i Certificate.p12 | pbcopy`
5. Paste into `IOS_CERTIFICATE_P12` secret
6. Set the password as `IOS_CERTIFICATE_PASSWORD`

### Creating the Provisioning Profile

1. Go to [developer.apple.com/account/resources/profiles](https://developer.apple.com/account/resources/profiles/list)
2. Click **+** > **App Store Connect** > Select your App ID (`net.printyx.ios`)
3. Select your Distribution Certificate > Generate > Download
4. Base64-encode: `base64 -i Profile.mobileprovision | pbcopy`
5. Paste into `IOS_PROVISIONING_PROFILE` secret

### Creating the App Store Connect API Key

1. Go to [appstoreconnect.apple.com/access/integrations/api](https://appstoreconnect.apple.com/access/integrations/api)
2. Click **Generate API Key**
3. Name: "GitHub Actions", Access: "App Manager"
4. Download the `.p8` file (you can only download it ONCE)
5. Base64-encode: `base64 -i AuthKey_XXXXXX.p8 | pbcopy`
6. Paste into `APP_STORE_CONNECT_API_KEY_P8`
7. Copy the **Key ID** into `APP_STORE_CONNECT_API_KEY_ID`
8. Copy the **Issuer ID** (shown at the top of the page) into `APP_STORE_CONNECT_ISSUER_ID`

---

## Version Control

The workflow supports two version control methods:

### Automatic (on push to main)
- Build number auto-increments from the value in `project.yml`
- Marketing version stays as defined in `project.yml`

### Manual (workflow_dispatch)
You can trigger a manual deploy from the Actions tab with:
- **version**: Override the marketing version (e.g., `2.0.0`)
- **build_number**: Override the build number (e.g., `100`)
- **submit_for_review**: Whether to submit directly for App Store review

---

## Apple Developer Prerequisites

Before the workflow can run, ensure you have:

1. An **Apple Developer Program** membership ($99/year)
2. An **App ID** registered for `net.printyx.ios`
3. An **App Store Connect** app record created for Printyx
4. A valid **iOS Distribution Certificate** (not expired)
5. An **App Store provisioning profile** linked to the certificate and App ID

---

## Quick Setup Checklist

```bash
# 1. Export certificate
base64 -i ~/Desktop/Certificate.p12 | pbcopy
# Paste as: IOS_CERTIFICATE_P12

# 2. Export provisioning profile
base64 -i ~/Desktop/Profile.mobileprovision | pbcopy
# Paste as: IOS_PROVISIONING_PROFILE

# 3. Export API key
base64 -i ~/Desktop/AuthKey_ABC123.p8 | pbcopy
# Paste as: APP_STORE_CONNECT_API_KEY_P8

# 4. Generate keychain password
openssl rand -hex 32 | pbcopy
# Paste as: KEYCHAIN_PASSWORD
```

All 10 secrets configured? You're ready to deploy.
