# Google Play Data Safety Declaration

Use this reference when completing the Data Safety section in Google Play Console.

## Data Collection Summary

| Data Type | Collected | Shared | Purpose |
|-----------|-----------|--------|---------|
| Email address | Yes | No | Account functionality |
| Name | Yes | No | Account functionality, personalization |
| Phone number | Yes (optional) | No | Account functionality |
| Company name | Yes | No | Account functionality (multi-tenant) |
| Approximate location | Yes | No | Service dispatch routing |
| Precise location | Yes | No | Field technician tracking |
| Photos | Yes | No | Service documentation |
| App interactions | Yes | No | Analytics, app functionality |
| Device identifiers | Yes | No | Push notifications, analytics |
| Crash logs | Yes | No | App stability |

## Data Handling

- **Encryption in transit**: Yes (HTTPS/TLS)
- **Encryption at rest**: Yes (AES-256 on server, device keychain for tokens)
- **User data deletion**: Available (account deletion flow in Settings)
- **Data retention**: As per privacy policy

## Permissions Required

| Permission | Purpose |
|------------|---------|
| CAMERA | Barcode scanning, equipment photos, service documentation |
| ACCESS_FINE_LOCATION | Service dispatch routing, field tech tracking |
| ACCESS_COARSE_LOCATION | Approximate location for dispatch optimization |
| ACCESS_BACKGROUND_LOCATION | Continuous field service tracking (when enabled) |
| READ_MEDIA_IMAGES | Attach photos to service tickets |
| POST_NOTIFICATIONS | Service alerts, dispatch notifications |
| INTERNET | API communication |
| USE_BIOMETRIC | Biometric authentication |
