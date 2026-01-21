# Printyx Knowledge Capture - Chrome Extension

Capture web content and save it directly to your Printyx Knowledge Base.

## Features

- 📄 **Full Page Capture**: Extract and save entire web pages
- ✂️ **Selection Capture**: Capture selected text from any webpage
- 🤖 **Intelligent Extraction**: Uses reader mode algorithms for clean content
- 📊 **Metadata Collection**: Automatically captures author, date, and description
- 🎨 **Structure Preservation**: Maintains headers, lists, code blocks, and images
- 🏷️ **Smart Tagging**: Auto-tags content based on source and type
- 🔄 **Real-time Sync**: Instantly saves to your knowledge base

## Installation

### From Source

1. Clone the repository
2. Navigate to `browser-extensions/chrome/`
3. Open Chrome and go to `chrome://extensions/`
4. Enable "Developer mode" (toggle in top right)
5. Click "Load unpacked"
6. Select the `browser-extensions/chrome/` directory

### Requirements

- Chrome version 88 or higher
- Active Printyx account with API access
- Admin or Editor privileges for knowledge base

## Configuration

### Initial Setup

1. Click the extension icon in your Chrome toolbar
2. Navigate to the **Settings** tab
3. Configure your connection:

```
API URL: https://printyx.net/api
(or http://localhost:5000 for local development)

Auth Token: <your-authentication-token>
Tenant ID: <your-tenant-id>
User ID: <your-user-id>
Default Category ID: <knowledge-base-category-id>
```

### Getting Your Credentials

1. **Auth Token**: Log into Printyx → Settings → API Keys → Generate Token
2. **Tenant ID**: Found in Settings → Account → Tenant Information
3. **User ID**: Found in Settings → Profile → User ID
4. **Default Category ID**:
   - Navigate to Knowledge Base → Categories
   - Click on your preferred default category
   - Copy the ID from the URL

## Usage

### Quick Page Capture

1. Navigate to any webpage you want to save
2. Click the Printyx extension icon
3. Click **"Capture Current Page"**
4. Content will be automatically extracted and saved
5. Success notification will appear

### Context Menu Capture

**Full Page:**

1. Right-click anywhere on the page
2. Select **"Capture entire page to Printyx KB"**

**Selected Text:**

1. Highlight the text you want to capture
2. Right-click on the selection
3. Select **"Capture to Printyx KB"**

### Custom Capture

For more control over what you save:

1. Click the extension icon
2. Click **"Custom Capture"**
3. Fill in the form:
   - **Title**: Article title
   - **Content**: Paste or type content
   - **Category**: Choose category (or use default)
   - **Tags**: Add comma-separated tags
4. Click **"Save to KB"**

## Content Extraction

The extension uses intelligent algorithms to extract clean, structured content:

### What Gets Captured

- ✅ Article title
- ✅ Main content (paragraphs)
- ✅ Headers (H1-H6)
- ✅ Lists (bullet and numbered)
- ✅ Code blocks
- ✅ Images (with alt text)
- ✅ Blockquotes
- ✅ Author information
- ✅ Publication date
- ✅ Meta description
- ✅ Source URL

### What Gets Filtered Out

- ❌ Navigation menus
- ❌ Sidebar content
- ❌ Advertisements
- ❌ Footer content
- ❌ Cookie notices
- ❌ Social media widgets
- ❌ Comments sections

## Permissions

The extension requires the following permissions:

- **activeTab**: To capture content from the current tab
- **storage**: To save your settings
- **contextMenus**: To add right-click menu options
- **scripting**: To extract page content
- **host_permissions**: To communicate with Printyx API

All permissions are used solely for the stated functionality. We never collect or share your data.

## Keyboard Shortcuts

Set custom keyboard shortcuts in Chrome:

1. Go to `chrome://extensions/shortcuts`
2. Find "Printyx Knowledge Capture"
3. Set your preferred shortcuts:
   - Capture Current Page: e.g., `Ctrl+Shift+K`
   - Custom Capture: e.g., `Ctrl+Shift+C`

## Content Structure

Captured content is saved in structured JSON format:

```json
{
  "sections": [
    {
      "type": "header",
      "content": "Main Title",
      "order": 1,
      "level": 1
    },
    {
      "type": "paragraph",
      "content": "Article content...",
      "order": 2
    },
    {
      "type": "list",
      "content": ["Item 1", "Item 2"],
      "order": 3,
      "listType": "bullet"
    },
    {
      "type": "code",
      "content": "const example = 'code block';",
      "order": 4
    },
    {
      "type": "image",
      "content": {
        "url": "https://...",
        "alt": "Image description",
        "caption": "Figure 1"
      },
      "order": 5
    }
  ]
}
```

## Automatic Metadata

Every captured article includes:

```json
{
  "metadata": {
    "sourceUrl": "https://example.com/article",
    "captureDate": "2025-11-25T10:30:00Z",
    "captureType": "full_page",
    "author": "John Doe",
    "publishedDate": "2025-11-20",
    "description": "Article description..."
  }
}
```

## Tags

Articles are automatically tagged with:

- `web-capture`: All captured content
- `full_page` or `selection`: Based on capture type
- `manual-capture`: For custom captures
- Additional tags you specify

## Troubleshooting

### Extension Not Capturing

**Problem**: Nothing happens when clicking capture

**Solutions:**

1. Refresh the page and try again
2. Check that you're on a webpage (not chrome:// or extension pages)
3. Verify your API credentials in Settings
4. Check browser console for errors (F12 → Console)

### Authentication Errors

**Problem**: "Not authenticated" or 401 errors

**Solutions:**

1. Verify your Auth Token is correct
2. Check that your token hasn't expired
3. Ensure Tenant ID and User ID are accurate
4. Try generating a new API token

### Content Not Appearing

**Problem**: Capture succeeds but article is empty

**Solutions:**

1. Check that the page has readable content
2. Some sites use dynamic loading - wait for content to load
3. Try custom capture and paste content manually
4. Verify the Default Category ID is set

### CORS Errors

**Problem**: "CORS policy" errors in console

**Solutions:**

1. Verify KB_EXTENSION_ALLOWED_ORIGINS in server .env
2. Ensure your API URL is correct in extension settings
3. Check that the server is running and accessible

## Development

### Project Structure

```
chrome/
├── manifest.json          # Extension manifest
├── background.js          # Background service worker
├── content.js            # Content extraction script
├── content.css           # Content styling
├── popup.html            # Extension popup UI
├── popup.js              # Popup functionality
├── icons/                # Extension icons
│   ├── icon16.png
│   ├── icon48.png
│   └── icon128.png
└── README.md            # This file
```

### Building

No build step required. The extension runs directly from source files.

### Testing Locally

1. Set API URL to `http://localhost:5000` in extension settings
2. Ensure your local Printyx server is running
3. Test capture on any webpage
4. Check server logs for API calls
5. Verify articles appear in your local knowledge base

### Debugging

Enable debug mode:

1. Open extension popup
2. Right-click anywhere → Inspect
3. Console will show debug logs
4. Network tab shows API calls

## Security

### Data Handling

- Extension **never** stores article content locally
- All data is sent directly to your Printyx instance
- API credentials are stored in Chrome's secure storage
- No data is sent to third parties

### API Security

- All API calls use HTTPS in production
- Authentication token required for all requests
- Tenant-based data isolation
- Session-based authentication

### Permissions Security

The extension requests minimal permissions:

- **activeTab**: Only accesses the current tab when you trigger capture
- **storage**: Only stores your API settings
- **contextMenus**: Only adds menu items
- **scripting**: Only runs when you initiate capture

## Privacy

- **No Tracking**: We don't track your browsing or capture history
- **No Analytics**: No usage data is collected
- **Local Storage**: Settings stay in your Chrome profile
- **Your Data**: All captured content belongs to you

## API Compatibility

### Supported Versions

- API Version: v1
- Minimum Server Version: 1.0.0
- Required Endpoints:
  - `POST /api/knowledge-base/articles`
  - `GET /api/knowledge-base/categories`

### Server Configuration

Ensure your server has KB extension support enabled:

```bash
# .env
KB_EXTENSION_ALLOWED_ORIGINS=https://printyx.net,http://localhost:5000
KB_EXTENSION_API_VERSION=v1
```

## Support

### Getting Help

1. **Documentation**: Check `/docs/KNOWLEDGE_BASE_ADMIN_GUIDE.md`
2. **API Issues**: Review server logs
3. **Bug Reports**: Submit to GitHub Issues
4. **Feature Requests**: Open a GitHub Discussion

### Common Questions

**Q: Can I use this with self-hosted Printyx?**
A: Yes! Just set your API URL to your server address.

**Q: Does this work offline?**
A: No, it requires an active connection to your Printyx server.

**Q: Can I capture from private/authenticated sites?**
A: Yes, the extension captures from any page you can view.

**Q: Is there a limit to capture size?**
A: Server-side limits apply (default: 10,000 words per article).

**Q: Can I edit after capturing?**
A: Yes, use the Knowledge Base admin interface to edit captured articles.

## Changelog

### v1.0.0 (2025-11-25)

- Initial release
- Full page capture
- Selection capture
- Custom capture
- Intelligent content extraction
- Metadata collection
- Chrome context menu integration
- Settings management
- Error handling and notifications

## License

Proprietary - Printyx Platform

## Credits

Developed by the Printyx Team

---

**Version**: 1.0.0
**Last Updated**: 2025-11-25
**Minimum Chrome Version**: 88+
