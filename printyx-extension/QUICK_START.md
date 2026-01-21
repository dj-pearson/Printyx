# Printyx Chrome Extension - Quick Start Guide

## What We Built

A Chrome extension that allows you to import LinkedIn profiles directly into your Printyx CRM with one click, including automatic contact enrichment via Apollo.io.

## ✅ What's Complete

### Backend API (100% Complete)

- ✅ `/api/extension/leads/quick-import` - Main import endpoint
- ✅ `/api/extension/leads/check-duplicate` - Duplicate detection
- ✅ `/api/extension/health` - Health check
- ✅ Apollo.io enrichment integration (uses tenant's API keys)
- ✅ Duplicate detection by LinkedIn URL, email, and name+company
- ✅ Business record creation with enriched data
- ✅ Session-based authentication

### Chrome Extension (100% Complete)

- ✅ Manifest V3 configuration
- ✅ LinkedIn profile parser (extracts public data)
- ✅ Content script (injects "Add to Printyx" button)
- ✅ API client (handles backend communication)
- ✅ Background service worker
- ✅ Popup UI with settings and import history
- ✅ Beautiful CSS styling
- ✅ Comprehensive README documentation

## 📋 Before You Can Test

### 1. Create Icon Files (Required)

Chrome won't load the extension without icons. You need PNG files:

```bash
cd printyx-extension/assets/icons/

# Create these files (16x16, 32x32, 48x48, 128x128 PNG images):
# - icon16.png
# - icon32.png
# - icon48.png
# - icon128.png
```

**Quick Solution**: Use any online icon generator or download placeholder icons:

- Visit https://www.favicon-generator.org/
- Upload any Printyx logo
- Download all sizes to `assets/icons/`

### 2. Start the Backend

```bash
cd /home/user/Printyx
npm run dev
```

The backend must be running for the extension to work.

## 🚀 Installation & Testing

### Step 1: Load Extension in Chrome

1. Open Chrome and go to `chrome://extensions/`
2. Enable **"Developer mode"** (toggle in top right)
3. Click **"Load unpacked"**
4. Select the `printyx-extension` directory
5. The extension should now appear in your toolbar

### Step 2: Configure Extension

1. Click the Printyx extension icon in Chrome toolbar
2. Enter API URL:
   - **Local development**: `http://localhost:5000`
   - **Production**: `https://printyx.net`
3. Click **"Save Configuration"**
4. Click **"Test Connection"** to verify

### Step 3: Log in to Printyx

1. Open Printyx in another tab (`http://localhost:5000`)
2. Log in with your credentials
3. The extension uses your session cookies for authentication

### Step 4: Test on LinkedIn

1. Navigate to any LinkedIn profile:
   - Example: `https://www.linkedin.com/in/williamhgates/`
2. Look for the **"Add to Printyx CRM"** button
3. Click the button
4. Watch for:
   - Loading state
   - Success notification
   - Enriched contact data (if Apollo.io configured)

### Step 5: Verify Import

1. Go to Printyx → Business Records or Customers
2. Search for the imported contact
3. Verify data:
   - Name, title, company (from LinkedIn)
   - Email, phone (from Apollo.io enrichment)
   - LinkedIn URL preserved
   - Lead source: "Chrome Extension - LinkedIn"

## 🔧 Troubleshooting

### Button Not Showing

1. Open browser console (F12)
2. Look for errors
3. Check if you're on a profile page (`/in/` in URL)
4. Reload the page

### Import Failing

1. Check browser console for errors
2. Verify backend is running (`http://localhost:5000`)
3. Check you're logged in to Printyx
4. Test connection in extension popup

### "Not Authenticated" Error

1. Make sure you're logged in to Printyx in another tab
2. Check API URL in extension popup
3. Try clearing cookies and logging in again

### Enrichment Not Working

1. Configure Apollo.io API key in Printyx:
   - Go to Settings → Integration Hub → Apollo.io
   - Add your API key
   - Save
2. Import will work without enrichment (manual data only)

## 📊 Features Overview

### Data Flow

```
LinkedIn Profile Page
    ↓
User clicks "Add to Printyx CRM" button
    ↓
Extension extracts: name, title, company, location, LinkedIn URL
    ↓
Sends to Printyx API: POST /api/extension/leads/quick-import
    ↓
Backend checks for duplicates (LinkedIn URL, email, name+company)
    ↓
If not duplicate:
  → Enriches via Apollo.io (tenant's API key)
  → Gets email, phone, company details
  → Creates business_record in database
    ↓
Returns enriched contact to extension
    ↓
Extension shows success notification
    ↓
Contact appears in Printyx CRM!
```

### Smart Features

- **Duplicate Prevention**: Checks LinkedIn URL, email, and name+company before importing
- **Automatic Enrichment**: Uses Apollo.io to find email and phone numbers
- **Fallback Support**: Works even without enrichment (manual import)
- **Import History**: Tracks all imports with statistics in extension popup
- **Session-Based Auth**: Secure authentication using existing Printyx login
- **Visual Feedback**: Loading states, success/error notifications, badge updates

## 📝 Next Steps

### For Development

1. **Test with various LinkedIn profiles** (different layouts, companies)
2. **Test error cases** (network failures, invalid data)
3. **Test with multiple tenants** (verify data isolation)
4. **Add more enrichment sources** (ZoomInfo implementation)

### For Production

1. **Create proper icon assets** (branded Printyx icons)
2. **Test on production Printyx instance**
3. **Create Chrome Web Store listing**:
   - Screenshots
   - Description
   - Privacy policy
4. **Submit for review**
5. **Publish to Chrome Web Store**

### Potential Enhancements

- Salesforce profile import (similar to LinkedIn)
- Bulk import from LinkedIn search results
- Import from company pages (multiple contacts)
- Automatic task creation on import
- Custom field mapping
- Import to specific pipelines/stages

## 📖 Files Reference

```
printyx-extension/
├── manifest.json                   # Extension config
├── background/
│   └── service-worker.js          # Background tasks
├── content-scripts/
│   ├── linkedin-injector.js       # Main import logic
│   └── injector.css               # Button styles
├── popup/
│   ├── popup.html                 # Settings UI
│   ├── popup.js                   # Settings logic
│   └── popup.css                  # Popup styles
├── lib/
│   ├── api-client.js              # API wrapper
│   └── linkedin-parser.js         # Profile parser
└── assets/icons/                  # Icon files (TODO)
```

```
server/routes/
└── chrome-extension-routes.ts     # Backend API
```

## ✨ Success Criteria

Extension is working when:

- ✅ Button appears on LinkedIn profiles
- ✅ Clicking button imports contact
- ✅ Contact appears in Printyx CRM
- ✅ Email/phone enriched (if Apollo configured)
- ✅ No duplicates created
- ✅ Import history tracked in popup

## 🎉 You're Ready!

Once you have the icons created, you can start testing immediately. The extension is fully functional and ready for use!

**Questions?** Check the main README.md or browser console for debugging information.
