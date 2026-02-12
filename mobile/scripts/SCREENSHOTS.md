# App Store Screenshot Automation

Automated screenshot capture for Apple App Store and Google Play Store submissions.

## Quick Start

```bash
# 1. Install Maestro
curl -Ls "https://get.maestro.mobile.dev" | bash

# 2. Install ImageMagick (for resizing and framing)
brew install imagemagick

# 3. Build and install the Expo dev client on simulators/emulators
cd mobile
npx expo prebuild
npx expo run:ios --device "iPhone 16 Pro Max"
npx expo run:android

# 4. Capture all screenshots
./scripts/screenshots.sh

# 5. Add text overlays and branding
./scripts/frame-screenshots.sh
```

## What Gets Captured

The automation navigates through **15 app screens** and captures screenshots at each:

| # | Screen | Category | Description |
|---|--------|----------|-------------|
| 01 | Login | Auth | Sign-in screen |
| 02 | Signup | Auth | Account creation |
| 03 | Dashboard | Core | KPI metrics, quick actions, activity feed |
| 04 | CRM Hub | CRM | Stats overview and navigation |
| 05 | Leads List | CRM | Searchable lead pipeline |
| 06 | Customers | CRM | Customer accounts list |
| 07 | Contacts | CRM | Contact directory with call/email |
| 08 | Deals | CRM | Deal pipeline with progress bars |
| 09 | Service Hub | Service | Ticket stats and navigation |
| 10 | Service Tickets | Service | Filterable ticket list |
| 11 | Dispatch | Service | Technician routing view |
| 12 | Field Service | Service | Time tracking and completion |
| 13 | Equipment | Equipment | Device list with barcode scan |
| 14 | Reports | Analytics | Report categories and KPIs |
| 15 | Settings | Account | Profile, support, account deletion |

## Device Sizes

### Apple App Store

| Device | Dimensions | Required? |
|--------|-----------|-----------|
| iPhone 16 Pro Max (6.9") | 1320 x 2868 | **Yes** |
| iPad Pro 13" (M4) | 2064 x 2752 | **Yes** (if iPad supported) |
| iPhone 15 Pro Max (6.7") | 1290 x 2796 | No (auto-scaled) |
| iPhone 14 Plus (6.5") | 1284 x 2778 | No (auto-scaled) |

- **Min screenshots:** 1 per device class
- **Max screenshots:** 10 per device class per localization
- **Format:** JPEG or PNG, RGB, no alpha, no transparency
- **File size:** Up to 500 MB per image

### Google Play Store

| Device | Dimensions | Required? |
|--------|-----------|-----------|
| Phone | 1080 x 1920 (9:16) | **Yes** (min 2) |
| 7" Tablet | 1200 x 1920 | Recommended (min 4 for "optimized") |
| 10" Tablet | 1600 x 2560 | Recommended (min 4 for "optimized") |

- **Min screenshots:** 2 (phone), 4 (tablet for "optimized" badge)
- **Max screenshots:** 8 per device category
- **Format:** PNG 24-bit (no alpha) or JPEG
- **File size:** Up to 8 MB per image
- **Aspect ratio:** Must be exactly 9:16 or 16:9

## Output Structure

```
screenshots/
├── ios/
│   ├── raw/                    # Raw captures from simulator
│   │   ├── iphone-6.9/
│   │   ├── iphone-6.7/
│   │   ├── iphone-6.5/
│   │   └── ipad-13/
│   └── store/                  # Store-ready (verified dimensions)
│       ├── iphone-6.9/         # <- Upload these to App Store Connect
│       ├── iphone-6.7/
│       ├── iphone-6.5/
│       └── ipad-13/
├── android/
│   ├── raw/                    # Raw captures from emulator
│   │   ├── phone/
│   │   ├── tablet-7/
│   │   └── tablet-10/
│   └── store/                  # Resized to exact Google Play dimensions
│       ├── phone/              # <- Upload these to Play Console
│       ├── tablet-7/
│       └── tablet-10/
└── framed/                     # With text overlays and branding
    ├── ios/
    │   ├── iphone-6.9/
    │   └── ipad-13/
    └── android/
        ├── phone/
        ├── tablet-7/
        └── tablet-10/
```

## Recommended Store Listing (Best 8 Screens)

For both stores, use these screens in this order for maximum impact:

1. **Dashboard** - Shows the app's main value proposition
2. **Leads List** - CRM functionality
3. **Service Tickets** - Service management
4. **Field Service** - Mobile field operations (key differentiator)
5. **Equipment List** - Equipment management with barcode scan
6. **Reports** - Analytics and insights
7. **Deals Pipeline** - Sales pipeline visualization
8. **Settings** - Shows security and account features

## Setup Requirements

### iOS Simulators

Install these simulators via Xcode:
```
Xcode -> Settings -> Platforms -> Download:
  - iOS 18 Simulator
  - Devices: iPhone 16 Pro Max, iPhone 15 Pro Max, iPad Pro 13-inch (M4)
```

### Android Emulators

Create these AVDs via Android Studio:
```
Android Studio -> Device Manager -> Create Device:
  - Pixel 8 Pro (API 35)
  - Nexus 7 (API 35)
  - Pixel Tablet (API 35)
```

The script will auto-detect available AVD names. If your AVDs have different names,
update the `ANDROID_DEVICES` map in `screenshots.sh`.

### Test Account

Create a dedicated screenshot account with pre-seeded demo data:
```bash
# Set credentials (or edit in screenshots.sh)
export TEST_EMAIL="screenshots@printyx.net"
export TEST_PASSWORD="Screenshots2024!"
```

The account should have:
- Sample leads, customers, and contacts
- Open service tickets with technician assignments
- Equipment records with meter readings
- Active deals in various pipeline stages
- Recent activity data for the dashboard

## Customization

### Adding New Screens

1. Create a new Maestro flow YAML in `scripts/maestro/flows/`:
   ```yaml
   appId: com.printyx.app
   name: "16 - New Screen"
   ---
   - waitForAnimationToEnd
   - tapOn: "Tab Name"
   - waitForAnimationToEnd
   - takeScreenshot: "16-new-screen"
   ```

2. Add the flow name to `SCREEN_FLOWS` in `screenshots.sh`

3. Add headline/subtitle to `SCREEN_HEADLINES` and `SCREEN_SUBTITLES` in `frame-screenshots.sh`

### Changing Branding

Edit `frame-screenshots.sh`:
```bash
BG_COLOR="#f0f5ff"      # Background color
TEXT_COLOR="#1e3a8a"     # Headline color
ACCENT_COLOR="#3b82f6"   # Accent color
```

### Clean Status Bars

The scripts automatically set clean status bars:
- **iOS:** 9:41 AM, full battery, full signal (via `xcrun simctl status_bar`)
- **Android:** 10:00, full battery, full signal (via demo mode broadcast)
