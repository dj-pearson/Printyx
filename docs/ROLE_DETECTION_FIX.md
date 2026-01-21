# Role Detection Fix

## Issue Summary

Users were being shown as normal users instead of admins, even though they had 'admin' role in the database. The system was not properly detecting and applying role-based permissions.

## Root Cause

The database has two ways of storing role information:

1. **Legacy**: `users.role` column with string values ('admin', 'manager', 'director', etc.)
2. **New RBAC**: `users.role_id` column referencing the `roles` table

The authentication system was only checking for `role_id` and ignoring the `role` string column, causing users with string roles to be treated as basic users without admin privileges.

## Changes Made

### 1. Frontend: useSupabaseAuth Hook

**File**: `client/src/hooks/useSupabaseAuth.ts`

- Updated to read both `role` (string) and `role_id` (FK) columns
- Added role mapping logic to determine permissions based on role string
- Now detects admin roles: 'admin', 'root_admin', 'platform_admin', 'company_admin', 'system_admin'
- Maps role strings to permission levels (1-8)
- Sets `isPlatformUser` flag based on role level and name

**Role Level Mapping**:

- Level 8: admin, root_admin, platform_admin (full platform access)
- Level 7: company_admin, director (company-wide access)
- Level 5: manager, sales_manager, service_manager
- Level 3: team_lead
- Level 2: technician, sales_rep
- Level 1: default user

### 2. Backend: Enhanced RBAC Middleware

**File**: `server/middleware/enhanced-rbac-middleware.ts`

- Updated `computeUserPermissions()` to check for string role when no role assignment exists
- Admin users (role = 'admin') now receive ALL active permissions
- Non-admin users with string roles receive basic permissions
- Role level is properly computed based on role string
- Logs role detection for debugging: `[RBAC] User {id} has string role '{role}' (level {level})`

### 3. Backend: Supabase JWT Middleware

**File**: `server/middleware/supabase-auth.ts`

- Updated `authenticateSupabaseJWT` to fetch user from database after JWT verification
- Reads `role` string from database and determines `isPlatformUser` based on role
- Logs authentication: `[Auth] User {email} has role '{role}', isPlatformUser: {flag}`
- Updates JWT user object with database role information

### 4. Backend: Auth Helpers

**File**: `server/utils/auth-helpers.ts`

- Enhanced `isPlatformAdmin()` function to check multiple sources:
  - `isPlatformUser` flag
  - Role level (>= 8)
  - `hasAllPermissions` flag
  - Role code/name patterns (checks for 'admin', 'root', 'platform', 'system')

### 5. Database Schema

**File**: `shared/schema.ts`

- Added `role: varchar('role')` column to users table schema
- Documented as "Legacy string role - kept for backward compatibility"
- Both `role` and `role_id` columns now supported

## How Role Detection Now Works

### Frontend Flow

1. User logs in with Supabase Auth
2. `useSupabaseAuth` fetches user profile from `users` table
3. Checks for `role` string column
4. If role is admin-like → sets level 8, grants admin permissions
5. User object includes role level and permissions
6. Frontend shows appropriate UI based on role level

### Backend API Flow

1. Request arrives with JWT token
2. `authenticateSupabaseJWT` validates JWT
3. Fetches user from database to get role string
4. Sets `isPlatformUser` if role is admin
5. `enhanceUserContext` builds full RBAC context
6. Checks for string role if no RBAC assignment exists
7. Grants permissions based on role level
8. API endpoints check permissions using middleware

## Testing

### For User: pearsonperformance@gmail.com

This user has `role = 'admin'` in the database. After these changes:

1. **Login**: User should be able to log in normally
2. **Role Detection**: Console should show:
   ```
   [Auth] User pearsonperformance@gmail.com has role 'admin', isPlatformUser: true
   [RBAC] User {id} has string role 'admin' (level 8) - granting {N} permissions
   ```
3. **Permissions**: User should have:
   - Level 8 access (platform admin)
   - All permissions granted
   - `isPlatformUser: true`
   - `hasAllPermissions: true`
4. **UI Access**: User should see:
   - Admin navigation items
   - All tenant data
   - Platform configuration options
   - Root admin dashboard

### Verification Steps

1. **Check Browser Console** (Frontend):
   - Open DevTools → Console
   - Look for user object logged by auth system
   - Verify `isPlatformUser: true`
   - Verify `role.level: 8`
   - Verify `role.permissions` includes admin rights

2. **Check Server Logs** (Backend):
   - Look for `[Auth]` log lines showing role detection
   - Look for `[RBAC]` log lines showing permission grants
   - Verify role level is 8
   - Verify permissions set size is large (100+)

3. **Test Admin Access**:
   - Navigate to `/admin`
   - Navigate to `/root-admin-dashboard`
   - Try creating/editing users
   - Try accessing tenant management
   - All should work without 403 Forbidden errors

4. **Check API Responses**:
   - Open Network tab in DevTools
   - Make an API call (e.g., GET /api/users)
   - Check if 401/403 errors are gone
   - Check response includes expected data

## Rollback Plan

If issues occur, you can temporarily revert by:

1. Check git history: `git log --oneline`
2. Find commit before these changes
3. Revert specific files:
   ```bash
   git checkout <commit-hash> client/src/hooks/useSupabaseAuth.ts
   git checkout <commit-hash> server/middleware/enhanced-rbac-middleware.ts
   git checkout <commit-hash> server/middleware/supabase-auth.ts
   git checkout <commit-hash> server/utils/auth-helpers.ts
   ```

## Migration Path (Future)

To fully migrate to the new RBAC system:

1. Run role seeder to create roles in `roles` table
2. For each user with string role:
   - Create matching role in `roles` table
   - Create role assignment in `user_role_assignments`
   - Update `users.role_id` to reference new role
3. Once all users migrated, can remove `users.role` column

## Environment Variables

Ensure these are set correctly:

```env
# Database
DATABASE_URL=postgresql://postgres:PASSWORD@209.145.59.219:5433/postgres

# Supabase
SUPABASE_URL=https://api.printyx.net
SUPABASE_ANON_KEY=eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9...
SUPABASE_SERVICE_ROLE_KEY=eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9...
SUPABASE_JWT_SECRET=<your-jwt-secret>

# Frontend
VITE_SUPABASE_URL=https://api.printyx.net
VITE_SUPABASE_ANON_KEY=eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9...
```

## Known Limitations

1. Role string is case-insensitive but should be lowercase in DB for consistency
2. Role level mapping is hardcoded - if role names change, update mapping logic
3. Permissions are granted in bulk for admin users (all active permissions)
4. Cache TTL is 15 minutes - role changes may take up to 15 min to propagate

## Support

If role detection still not working:

1. Check server logs for `[Auth]` and `[RBAC]` messages
2. Verify user has correct role in database: `SELECT id, email, role, role_id, is_platform_user FROM users WHERE email = 'user@example.com';`
3. Clear permission cache: Restart server or wait 15 minutes
4. Check JWT token payload (use jwt.io to decode)
5. Enable verbose logging in auth middleware

---

**Last Updated**: December 16, 2024  
**Issue**: Role detection not working for admin users  
**Status**: Fixed ✅  
**Affected Users**: All users with string roles in `users.role` column
