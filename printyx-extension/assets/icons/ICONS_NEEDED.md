# Extension Icons Required

Chrome extensions require icon files in multiple sizes. You'll need to create PNG icons for:

- **icon16.png**: 16x16 pixels (toolbar icon)
- **icon32.png**: 32x32 pixels (toolbar icon @2x)
- **icon48.png**: 48x48 pixels (extension management page)
- **icon128.png**: 128x128 pixels (Chrome Web Store)

## Design Guidelines

- Use the Printyx brand colors (purple gradient: #667eea to #764ba2)
- Icon should be recognizable at small sizes
- Include a simple symbol representing CRM/contacts (e.g., person icon + plus sign)
- Transparent background
- High contrast for visibility

## Quick Create (Temporary Placeholder)

For development, you can use any PNG image in the required sizes. Here are some options:

### Option 1: Use an Online Icon Generator

- Visit https://www.favicon-generator.org/
- Upload your logo or use a simple design
- Download all sizes

### Option 2: Use ImageMagick (if installed)

```bash
# Convert a single image to all required sizes
convert logo.png -resize 16x16 icon16.png
convert logo.png -resize 32x32 icon32.png
convert logo.png -resize 48x48 icon48.png
convert logo.png -resize 128x128 icon128.png
```

### Option 3: Use Figma/Sketch/Photoshop

- Create a 128x128 artboard
- Design your icon
- Export at 16x16, 32x32, 48x48, and 128x128

## Current Status

⚠️ **Icons are currently missing**. The extension will not load without these files.

You can create temporary placeholder icons using any graphic editing tool or online generator for development testing.
