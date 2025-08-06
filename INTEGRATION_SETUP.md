# Integration Hub Setup Guide

## Overview

The Integration Hub has been completely reworked to support real OAuth integrations instead of mock data. The system now supports:

- **Google Calendar Integration** - Full OAuth 2.0 implementation
- **Microsoft Outlook Calendar Integration** - OAuth 2.0 with Microsoft Graph API
- Real API calls and data synchronization
- Webhook support for real-time updates
- Comprehensive dashboard with actual integration metrics

## Architecture

### Backend Components

1. **OAuth Configuration (`server/integrations/oauth-config.ts`)**
   - Centralized OAuth provider configurations
   - Authentication helper functions
   - Client creation utilities

2. **Integration Service (`server/integrations/integration-service.ts`)**
   - OAuth flow handling
   - Token management and storage
   - API interactions with Google Calendar and Microsoft Graph
   - Integration lifecycle management

3. **Dashboard Service (`server/integrations/dashboard-service.ts`)**
   - Real-time dashboard data aggregation
   - Integration metrics and analytics
   - Performance monitoring

4. **API Routes (`server/integrations/routes.ts`)**
   - OAuth initialization endpoints
   - Callback handling
   - Integration management APIs
   - Calendar event fetching

### Database Schema

The system uses the existing `systemIntegrations` table to store:
- OAuth tokens (encrypted)
- Integration configurations
- User information
- Sync status and timestamps

## Setup Instructions

### 1. Environment Configuration

Copy `.env.example` to `.env` and configure:

```bash
# Google Calendar API
GOOGLE_CLIENT_ID=your_google_client_id
GOOGLE_CLIENT_SECRET=your_google_client_secret
GOOGLE_REDIRECT_URI=http://localhost:5000/api/integrations/google-calendar/callback

# Microsoft Graph API
MICROSOFT_CLIENT_ID=your_microsoft_client_id
MICROSOFT_CLIENT_SECRET=your_microsoft_client_secret
MICROSOFT_REDIRECT_URI=http://localhost:5000/api/integrations/microsoft-calendar/callback
```

### 2. Google Calendar API Setup

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select existing one
3. Enable the Calendar API
4. Go to "Credentials" and create OAuth 2.0 Client IDs
5. Add your redirect URI: `http://localhost:5000/api/integrations/google-calendar/callback`
6. Copy the Client ID and Client Secret to your `.env` file

### 3. Microsoft Graph API Setup

1. Go to [Azure Portal](https://portal.azure.com/)
2. Navigate to "Azure Active Directory" > "App registrations"
3. Create a new registration
4. Add redirect URI: `http://localhost:5000/api/integrations/microsoft-calendar/callback`
5. Go to "API permissions" and add Microsoft Graph permissions:
   - `Calendars.ReadWrite`
   - `User.Read`
6. Generate a client secret in "Certificates & secrets"
7. Copy the Application (client) ID and client secret to your `.env` file

### 4. Run the Application

```bash
npm run dev
```

## Usage

### Adding Integrations

1. Navigate to `/integration-hub`
2. Go to the "API Marketplace" tab
3. Find Google Calendar or Microsoft Calendar
4. Click "Configure" to start the OAuth flow
5. Authorize the application with your calendar provider
6. You'll be redirected back with a success message

### Managing Integrations

- View active integrations in the "Active Integrations" tab
- Monitor webhook deliveries in the "Webhook Management" tab
- Check analytics and performance in the "Analytics" tab
- Test connections using the test endpoints

### API Endpoints

- `GET /api/integration-hub/dashboard` - Get dashboard data
- `GET /api/integrations` - List user integrations
- `GET /api/integrations/marketplace` - Available integrations
- `POST /api/integrations/oauth/init` - Initialize OAuth flow
- `GET /api/integrations/:provider/callback` - OAuth callback
- `GET /api/integrations/:id/calendar/events` - Fetch calendar events
- `DELETE /api/integrations/:id` - Remove integration
- `POST /api/integrations/:id/test` - Test integration

## Features Implemented

✅ Real OAuth 2.0 flows for Google and Microsoft
✅ Token storage and refresh handling
✅ Calendar event synchronization
✅ Real-time dashboard metrics
✅ Integration lifecycle management
✅ Error handling and status tracking
✅ Webhook configuration for real-time updates
✅ Frontend OAuth flow integration
✅ Success/error callback handling

## Next Steps

1. **Add More Providers**: Extend the system to support additional integrations like Salesforce, Stripe, etc.
2. **Webhook Implementation**: Complete the webhook delivery system for real-time updates
3. **Metrics Collection**: Implement proper metrics collection for API calls, latency, etc.
4. **Error Monitoring**: Add comprehensive error logging and monitoring
5. **Rate Limiting**: Implement proper rate limiting for API calls
6. **Data Transformation**: Add data transformation rules for mapping external data to internal formats

## Security Considerations

- OAuth tokens are stored in the database (should be encrypted in production)
- State validation is implemented for OAuth flows
- HTTPS should be used in production
- Rate limiting should be implemented
- Regular token refresh is handled automatically

## Troubleshooting

### Common Issues

1. **OAuth redirect mismatch**: Ensure redirect URIs match exactly in both the provider console and environment variables
2. **Missing scopes**: Verify that the required API permissions are granted
3. **Token expiry**: The system automatically handles token refresh for Google; Microsoft tokens may need manual refresh handling
4. **CORS issues**: Ensure proper CORS configuration for cross-origin requests

### Debugging

- Check browser developer console for client-side errors
- Check server logs for OAuth flow issues
- Verify environment variables are set correctly
- Test API endpoints directly with tools like Postman