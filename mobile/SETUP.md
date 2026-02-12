# Printyx Mobile App - Setup Guide

## Prerequisites

- Node.js 18+ and npm
- Expo CLI: `npm install -g @expo/cli`
- EAS CLI: `npm install -g eas-cli`
- For iOS: macOS with Xcode 16+
- For Android: Android Studio with SDK 35+

## Getting Started

### 1. Install Dependencies

```bash
cd mobile
npm install
```

### 2. Environment Setup

Create a `.env` file (or configure in eas.json):

```env
EXPO_PUBLIC_SUPABASE_URL=https://api.printyx.net
EXPO_PUBLIC_SUPABASE_ANON_KEY=your_anon_key_here
EXPO_PUBLIC_API_BASE_URL=https://functions.printyx.net
EXPO_PUBLIC_APP_URL=https://app.printyx.net
```

### 3. Start Development

```bash
# Start Expo development server
npm start

# Run on iOS Simulator
npm run ios

# Run on Android Emulator
npm run android
```

## Building for Production

### EAS Build Setup

```bash
# Login to Expo
eas login

# Configure project
eas build:configure

# Build for iOS
npm run build:ios

# Build for Android
npm run build:android

# Build both
npm run build:all
```

### App Store Submission

```bash
# Submit to App Store
npm run submit:ios

# Submit to Google Play
npm run submit:android
```

## Project Structure

```
mobile/
├── app/                    # Expo Router file-based routes
│   ├── _layout.tsx         # Root layout (providers)
│   ├── index.tsx           # Entry redirect
│   ├── (auth)/             # Auth screens (login, signup, forgot-password)
│   └── (app)/              # Authenticated screens
│       ├── (dashboard)/    # Dashboard
│       ├── (crm)/          # CRM (leads, customers, contacts, deals)
│       ├── (service)/      # Service (tickets, dispatch, field service)
│       ├── (equipment)/    # Equipment management
│       ├── (reports)/      # Reports & analytics
│       └── (settings)/     # Settings & profile
├── src/
│   ├── config/             # App configuration
│   ├── lib/                # Supabase client, API client, query client
│   ├── providers/          # AuthProvider
│   ├── hooks/              # useAuth, usePushNotifications
│   ├── components/ui/      # Reusable UI components
│   └── theme/              # Design tokens (colors, spacing, typography)
├── assets/                 # App icons and splash screens
├── app.json                # Expo configuration (with privacy manifests)
├── eas.json                # EAS Build configuration
└── package.json            # Dependencies
```

## Architecture

- **Framework**: React Native via Expo SDK 52
- **Navigation**: Expo Router (file-based)
- **State**: TanStack Query (server state), React Context (auth)
- **Auth**: Supabase GoTrue (tokens stored in Keychain/EncryptedSharedPreferences)
- **API**: Same backend as web (Express + Supabase Edge Functions)
- **Styling**: React Native StyleSheet with centralized design tokens

## Compliance

### Apple (iOS)
- Privacy manifest configured in `app.json` → `ios.privacyManifests`
- ATT prompt via `expo-tracking-transparency`
- Account deletion in Settings screen
- Associated domains for Universal Links

### Google (Android)
- Target API 35 (Android 15)
- Data safety declaration reference in `data-safety.md`
- Intent filters for App Links
- Notification channels configured

## Key Differences from Web

| Feature | Web | Mobile |
|---------|-----|--------|
| Auth storage | localStorage | Keychain / EncryptedSharedPreferences |
| Token refresh | On 401 + window focus | On 401 + app foreground |
| Navigation | Wouter | Expo Router (React Navigation) |
| Styling | Tailwind CSS | React Native StyleSheet |
| Push | Web Push API | APNs (iOS) / FCM (Android) |
| Deep links | URL routing | Universal Links / App Links |
| Biometric | N/A | Face ID / Fingerprint |
