# Printyx CRM - LinkedIn Lead Importer Chrome Extension

Import LinkedIn profiles directly to your Printyx CRM with one click. Automatically enriches contacts with email, phone, and company data using Apollo.io or ZoomInfo.

## Features

- **One-Click Import**: Add LinkedIn profiles to Printyx CRM instantly
- **Automatic Enrichment**: Enriches contacts with email, phone, and detailed company information
- **Duplicate Detection**: Prevents duplicate entries by checking LinkedIn URL, email, and name+company
- **Smart Fallback**: Uses Apollo.io (primary) and ZoomInfo (fallback) for enrichment
- **Import History**: Track all imported contacts with statistics
- **Session-Based Auth**: Secure authentication using your existing Printyx login

## Installation

### Development Mode (Local Testing)

1. **Build the Backend API** (if not already running):
   ```bash
   cd /home/user/Printyx
   npm run dev
   ```

2. **Load Extension in Chrome**:
   - Open Chrome and navigate to `chrome://extensions/`
   - Enable "Developer mode" (top right toggle)
   - Click "Load unpacked"
   - Select the `printyx-extension` directory

3. **Configure Extension**:
   - Click the Printyx extension icon in Chrome toolbar
   - Enter your Printyx API URL:
     - Local development: `http://localhost:5000`
     - Production: `https://printyx.net`
   - Click "Save Configuration"
   - Click "Test Connection" to verify

4. **Log in to Printyx**:
   - Open Printyx in another tab and log in
   - The extension uses your session cookies for authentication

### Production Deployment (Chrome Web Store)

1. **Create Icon Assets**:
   ```bash
   # Create icons in assets/icons/
   # Required sizes: 16x16, 32x32, 48x48, 128x128
   ```

2. **Package Extension**:
   ```bash
   cd printyx-extension
   zip -r printyx-extension.zip .
   ```

3. **Submit to Chrome Web Store**:
   - Visit [Chrome Web Store Developer Dashboard](https://chrome.google.com/webstore/devconsole)
   - Upload `printyx-extension.zip`
   - Fill in store listing details
   - Submit for review

## Usage

### Importing a LinkedIn Profile

1. Navigate to any LinkedIn profile page (e.g., `linkedin.com/in/john-smith`)

2. Look for the **"Add to Printyx CRM"** button on the profile

3. Click the button to import

4. The extension will:
   - Extract name, title, company, location from the visible profile
   - Check if contact already exists in your CRM
   - Enrich with email/phone using Apollo.io (tenant's API key)
   - Create a new lead in Printyx CRM
   - Show success notification with enrichment details

5. View import history by clicking the extension icon

### Managing Enrichment

The extension uses **your tenant's Apollo.io API key** (configured in Printyx settings) to enrich contacts. This means:

- Each tenant uses their own API credits
- No shared API keys
- Server-side enrichment keeps credentials secure
- Automatic fallback to manual import if enrichment fails

## Architecture

### Data Flow

```
LinkedIn Profile
    ↓ (parse visible data)
Chrome Extension (Content Script)
    ↓ (POST /api/extension/leads/quick-import)
Printyx Backend
    ↓ (check duplicates)
    ↓ (enrich via Apollo.io using tenant's API key)
    ↓ (create business_record)
Chrome Extension
    ↓ (show success notification)
User sees enriched contact in CRM
```

### Files Structure

```
printyx-extension/
├── manifest.json                   # Extension configuration
├── background/
│   └── service-worker.js          # Background tasks, notifications
├── content-scripts/
│   ├── linkedin-injector.js       # Inject "Add to Printyx" button
│   └── injector.css               # Button and notification styles
├── popup/
│   ├── popup.html                 # Extension popup UI
│   ├── popup.js                   # Popup logic, settings
│   └── popup.css                  # Popup styles
├── lib/
│   ├── api-client.js              # Printyx API wrapper
│   └── linkedin-parser.js         # Parse LinkedIn profile data
├── assets/
│   └── icons/                     # Extension icons (16-128px)
└── README.md                      # This file
```

### Backend API Endpoints

The extension communicates with these endpoints:

- `POST /api/extension/leads/quick-import` - Import lead with enrichment
- `GET /api/extension/leads/check-duplicate` - Check for existing contact
- `GET /api/extension/health` - Health check and feature availability

See `server/routes/chrome-extension-routes.ts` for implementation.

## Security & Compliance

### LinkedIn Terms of Service

This extension is designed to comply with LinkedIn's ToS:

- **User-Initiated Only**: No automated scraping - only works when user clicks button
- **Public Data Only**: Extracts only visible profile information
- **No Heavy Scraping**: Minimal DOM parsing of basic fields
- **Rate Limiting**: Server-side rate limiting prevents abuse
- **Session-Based**: Uses existing LinkedIn session (no credentials stored)

### Data Privacy

- **No Data Storage in Extension**: All data stored server-side in Printyx
- **Secure Authentication**: Uses session cookies (httpOnly, secure)
- **Tenant Isolation**: All imports scoped to user's tenant
- **Audit Trail**: All imports tracked with user ID and timestamp

### API Key Security

- **Server-Side Only**: API keys never exposed to browser
- **Tenant-Specific**: Each tenant uses their own Apollo.io/ZoomInfo keys
- **Encrypted Storage**: Credentials encrypted in database
- **No Shared Keys**: Platform-level keys not used for enrichment

## Development

### Prerequisites

- Chrome browser (v88+)
- Node.js (v18+)
- Printyx backend running locally or access to production instance
- Apollo.io API key (configured in Printyx tenant settings)

### Local Development

1. **Start Printyx Backend**:
   ```bash
   cd /home/user/Printyx
   npm run dev
   ```

2. **Load Extension** (see Installation section above)

3. **Make Changes**:
   - Edit files in `printyx-extension/`
   - Reload extension in `chrome://extensions/`
   - Refresh LinkedIn page to see content script changes

4. **Debug**:
   - Background script: `chrome://extensions/` → "Service worker" link
   - Content script: Right-click page → "Inspect" → Console
   - Popup: Right-click extension icon → "Inspect popup"

### Adding New Features

1. **Content Script Changes**: Edit `content-scripts/linkedin-injector.js`
2. **API Changes**: Edit `server/routes/chrome-extension-routes.ts`
3. **Popup Changes**: Edit `popup/popup.html` and `popup/popup.js`
4. **Styling Changes**: Edit CSS files

### Testing

1. **Test LinkedIn Parsing**:
   - Visit various LinkedIn profiles (different layouts)
   - Check browser console for parsing errors
   - Verify extracted data accuracy

2. **Test API Integration**:
   - Test with and without Apollo.io configured
   - Test duplicate detection (try importing same profile twice)
   - Test error handling (invalid data, network errors)

3. **Test Multi-Tenant**:
   - Switch between different Printyx tenants
   - Verify data isolation
   - Check API key usage

## Troubleshooting

### Button Not Appearing

1. Check if you're on a LinkedIn profile page (`/in/` in URL)
2. Open browser console and look for errors
3. Verify extension is enabled in `chrome://extensions/`
4. Try refreshing the page

### Import Failing

1. Check connection status in extension popup
2. Verify you're logged in to Printyx
3. Check browser console for API errors
4. Test API connection in popup ("Test Connection" button)

### Enrichment Not Working

1. Verify Apollo.io API key is configured in Printyx
2. Check API key status in Integration Hub
3. Verify tenant has remaining API credits
4. Check server logs for enrichment errors

### "Not Authenticated" Error

1. Make sure you're logged in to Printyx in another tab
2. Clear browser cookies and log in again
3. Check API URL configuration in extension popup
4. Verify CORS settings allow extension origin

## Support

- **Documentation**: https://printyx.net/docs/chrome-extension
- **Issues**: Report bugs via GitHub Issues
- **Contact**: support@printyx.net

## Changelog

### v1.0.0 (2024)

- Initial release
- LinkedIn profile import
- Apollo.io enrichment
- Duplicate detection
- Import history tracking
- Session-based authentication

## License

Proprietary - Printyx, Inc. All rights reserved.
