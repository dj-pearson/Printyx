# Printyx Mobile Technician App

**React Native mobile app for field technicians**

Built with Expo, React Native, and TypeScript to provide offline-first field service capabilities.

---

## 📱 Overview

The Printyx Mobile Technician App enables field technicians to:

- ✅ View assigned service tickets
- ✅ Start and complete work orders
- ✅ Capture photos on-site
- ✅ Scan equipment QR codes
- ✅ Track GPS location
- ✅ Capture customer signatures
- ✅ Work offline with data sync

---

## 🏗️ Tech Stack

**Core Framework:**

- **React Native 0.76.5**: Cross-platform mobile framework
- **Expo ~52.0.0**: Development platform and build tools
- **TypeScript 5.6.3**: Type-safe development

**Navigation:**

- **@react-navigation/native 7.0.0**: Navigation framework
- **@react-navigation/native-stack**: Stack navigator
- **@react-navigation/bottom-tabs**: Tab navigator

**State Management:**

- **@tanstack/react-query 5.60.5**: Server state management
- **React Context**: Local state (authentication)

**Offline Support:**

- **@watermelondb/watermelondb 0.27.0**: Offline-first database
- **expo-sqlite**: Local SQLite database

**Device Features:**

- **expo-camera 16.0.0**: QR scanning and photo capture
- **expo-location 18.0.0**: GPS tracking
- **expo-secure-store 13.0.2**: Secure credential storage
- **react-native-signature-canvas 4.7.2**: Signature capture

**UI Components:**

- **@expo/vector-icons**: Ionicons icon set
- **react-native-safe-area-context**: Safe area handling

**API Communication:**

- **axios 1.7.9**: HTTP client
- **@tanstack/query-sync-storage-persister**: Query cache persistence

---

## 📁 Project Structure

```
mobile-app/
├── app.json                      # Expo configuration
├── package.json                  # Dependencies
├── tsconfig.json                 # TypeScript config
├── App.tsx                       # Main app entry
│
└── src/
    ├── navigation/               # Navigation setup
    │   ├── AppNavigator.tsx      # Authenticated routes
    │   ├── AuthNavigator.tsx     # Login flow
    │   └── Navigation.tsx        # Root navigation
    │
    ├── screens/                  # App screens
    │   ├── auth/
    │   │   └── LoginScreen.tsx   # Login screen
    │   ├── DashboardScreen.tsx   # Home dashboard
    │   ├── TicketListScreen.tsx  # All tickets
    │   ├── TicketDetailScreen.tsx # Ticket details
    │   ├── ProfileScreen.tsx     # User profile
    │   └── ScanQRScreen.tsx      # QR code scanner
    │
    ├── contexts/                 # React contexts
    │   └── AuthContext.tsx       # Authentication state
    │
    ├── services/                 # Business logic
    │   └── api.ts                # API client (Axios)
    │
    ├── components/               # Reusable components (future)
    ├── hooks/                    # Custom hooks (future)
    └── utils/                    # Utilities (future)
```

---

## 🚀 Getting Started

### Prerequisites

- Node.js 18+ and npm
- Expo CLI: `npm install -g expo-cli`
- iOS Simulator (macOS) or Android Emulator
- Physical device with Expo Go app (optional)

### Installation

1. **Install dependencies:**

   ```bash
   cd mobile-app
   npm install
   ```

2. **Configure API endpoint:**

   The API client is configured in `src/services/api.ts`:

   ```typescript
   const baseURL = __DEV__
     ? 'http://localhost:5000/api' // Development
     : 'https://api.printyx.com/api'; // Production
   ```

   **Important:**
   - For iOS Simulator: Use `http://localhost:5000`
   - For Android Emulator: Use `http://10.0.2.2:5000`
   - For physical device: Use your computer's IP (e.g., `http://192.168.1.100:5000`)

3. **Start development server:**

   ```bash
   npm start
   ```

4. **Run on device/simulator:**
   - Press `i` for iOS Simulator
   - Press `a` for Android Emulator
   - Scan QR code with Expo Go app on physical device

---

## 🔧 Development

### Available Scripts

```bash
# Start Expo development server
npm start

# Start with cache cleared
npm start --clear

# Run on iOS Simulator
npm run ios

# Run on Android Emulator
npm run android

# Run on web browser
npm run web

# Type check
npm run type-check

# Build for production
npm run build:ios       # iOS build
npm run build:android   # Android build
```

### Backend API Setup

The mobile app requires the Printyx backend to be running:

```bash
# In main project directory
npm run dev
```

The backend should be accessible at `http://localhost:5000`.

### Test Credentials

Use credentials from your Printyx platform (technician role required).

---

## 📱 Features Implementation Status

### ✅ Implemented (Phase 1)

- [x] Authentication (login/logout)
- [x] Navigation structure (tabs + stack)
- [x] Dashboard with stats
- [x] Ticket list with filtering
- [x] Ticket detail view
- [x] Profile screen
- [x] QR code scanning
- [x] API integration
- [x] Secure token storage

### 🚧 In Progress (Phase 2)

- [ ] Photo capture and upload
- [ ] Offline data sync
- [ ] GPS tracking
- [ ] Customer signature capture
- [ ] Ticket completion flow
- [ ] Add notes to tickets
- [ ] Parts tracking

### ⏳ Planned (Phase 3)

- [ ] Push notifications
- [ ] Real-time updates (WebSocket)
- [ ] Route optimization
- [ ] Time tracking
- [ ] Inventory management
- [ ] Dark mode

---

## 🎨 UI Design

**Design System:**

- Primary color: `#2563eb` (Blue)
- Success: `#10b981` (Green)
- Warning: `#f59e0b` (Amber)
- Error: `#ef4444` (Red)
- Text: `#111827` (Gray 900)
- Subtitle: `#6b7280` (Gray 500)

**Typography:**

- Default: System font (San Francisco on iOS, Roboto on Android)
- Sizes: 12px, 14px, 16px, 20px, 24px

**Spacing:**

- Base unit: 4px
- Common: 8px, 12px, 16px, 24px, 32px

---

## 🔐 Security

**Authentication:**

- JWT token stored in Expo SecureStore (encrypted)
- Automatic token refresh on app launch
- Session management with timeout

**Data Protection:**

- All API requests use HTTPS in production
- Bearer token authentication
- Secure credential storage

**Permissions:**

- Camera: For QR scanning and photos
- Location: For GPS tracking
- Storage: For offline data

---

## 🌐 Offline Support

**WatermelonDB Integration** (Coming Soon)

The app will support full offline functionality:

1. **Initial Sync**: Downloads all assigned tickets and related data
2. **Local Database**: WatermelonDB stores data in SQLite
3. **Offline Operations**: All actions work offline and queue for sync
4. **Background Sync**: Automatically syncs when connection restored
5. **Conflict Resolution**: Last-write-wins with timestamp comparison

**Data Synced:**

- Assigned tickets
- Customer details
- Equipment information
- Photos (queued for upload)
- GPS breadcrumbs

---

## 📸 Screenshots

_(Coming Soon)_

|                  Dashboard                   |               Ticket List                |             Ticket Detail              |           QR Scanner           |
| :------------------------------------------: | :--------------------------------------: | :------------------------------------: | :----------------------------: |
| ![Dashboard](docs/screenshots/dashboard.png) | ![Tickets](docs/screenshots/tickets.png) | ![Detail](docs/screenshots/detail.png) | ![QR](docs/screenshots/qr.png) |

---

## 🏭 Production Build

### iOS Build

**Requirements:**

- macOS with Xcode
- Apple Developer account
- Expo Application Services (EAS) account

**Build Steps:**

```bash
# Install EAS CLI
npm install -g eas-cli

# Login to Expo
eas login

# Configure build
eas build:configure

# Build for iOS
eas build --platform ios

# Submit to App Store
eas submit --platform ios
```

### Android Build

**Requirements:**

- Google Play Console account
- Expo Application Services (EAS) account

**Build Steps:**

```bash
# Build for Android
eas build --platform android

# Submit to Google Play
eas submit --platform android
```

### Over-the-Air (OTA) Updates

Expo supports OTA updates for JavaScript/React code:

```bash
# Publish update
eas update --branch production --message "Bug fixes"
```

Users will receive updates automatically without App Store approval.

---

## 🧪 Testing

### Manual Testing Checklist

**Authentication:**

- [ ] Login with valid credentials
- [ ] Login fails with invalid credentials
- [ ] Token persists after app restart
- [ ] Logout clears token

**Tickets:**

- [ ] Dashboard shows correct stats
- [ ] Ticket list loads assigned tickets
- [ ] Filters work correctly
- [ ] Ticket detail shows all information
- [ ] Start ticket updates status

**QR Scanning:**

- [ ] Camera permission requested
- [ ] QR code scans successfully
- [ ] Equipment lookup works
- [ ] Invalid QR shows error

**Offline:**

- [ ] App works without network
- [ ] Data syncs when reconnected

---

## 🐛 Troubleshooting

### Common Issues

**1. Metro bundler won't start**

```bash
# Clear cache and restart
npm start --clear
```

**2. Cannot connect to API**

- Check backend is running on `http://localhost:5000`
- For Android emulator, use `http://10.0.2.2:5000`
- For physical device, use your computer's IP address
- Ensure firewall allows connections

**3. Camera not working**

- Check camera permissions in device settings
- Restart Expo development server
- For iOS Simulator, camera is not available

**4. TypeScript errors**

```bash
# Run type check
npm run type-check
```

**5. Build errors**

```bash
# Clear node_modules and reinstall
rm -rf node_modules package-lock.json
npm install
```

---

## 📚 API Documentation

The mobile app communicates with these endpoints:

**Authentication:**

- `POST /api/auth/login` - Login with email/password
- `POST /api/auth/logout` - Logout
- `GET /api/auth/me` - Get current user

**Tickets:**

- `GET /api/mobile/sync` - Initial/incremental data sync
- `GET /api/mobile/tickets` - List assigned tickets
- `GET /api/mobile/tickets/:id` - Get ticket details
- `PATCH /api/mobile/tickets/:id` - Update ticket
- `POST /api/mobile/tickets/:id/start` - Start ticket
- `POST /api/mobile/tickets/:id/complete` - Complete ticket
- `POST /api/mobile/tickets/:id/notes` - Add note
- `POST /api/mobile/tickets/:id/photos` - Upload photos

**Equipment:**

- `GET /api/mobile/equipment/:id` - Get equipment details
- `POST /api/mobile/equipment/scan` - QR/serial lookup

**Location:**

- `POST /api/mobile/location` - Track GPS location

**Stats:**

- `GET /api/mobile/stats` - Performance metrics

See `src/services/api.ts` for complete API client implementation.

---

## 🤝 Contributing

### Code Style

- Use TypeScript for all new files
- Follow existing naming conventions
- Components use PascalCase (e.g., `TicketListScreen.tsx`)
- Utilities use camelCase (e.g., `formatDate.ts`)
- Add JSDoc comments to exported functions

### Pull Request Process

1. Create feature branch from `main`
2. Implement changes with tests
3. Update documentation
4. Submit PR with description

---

## 📄 License

Copyright © 2025 Printyx. All rights reserved.

---

## 🆘 Support

**Documentation:**

- Main docs: `/docs/IMPLEMENTATION_MOBILE_TECHNICIAN_APP.md`
- Backend API: `/docs/BUILD_SESSION_SUMMARY_2025-11-23.md`

**Issues:**

- Report bugs in GitHub Issues
- Feature requests welcome

**Contact:**

- Email: support@printyx.com
- Website: https://printyx.com

---

**Built with ❤️ by the Printyx team**
