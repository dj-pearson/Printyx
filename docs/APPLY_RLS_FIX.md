# Apply RLS Fix for User Role Detection

## Problem

The frontend cannot read user records from the `users` table due to missing Row Level Security (RLS) policies in Supabase. This causes all users to appear as "User" instead of showing their actual role (admin, manager, etc.).

## Solution

Apply RLS policies that allow:

1. Users to read their own user record
2. Service role to read all users
3. Platform admins to read all users

## How to Apply (Choose ONE method)

### Method 1: Using Supabase Dashboard (Recommended)

1. **Open Supabase SQL Editor**:
   - Go to https://api.printyx.net (or your Supabase dashboard URL)
   - Log in as admin
   - Navigate to: **SQL Editor** in the left sidebar

2. **Run the Migration**:
   - Click **New Query**
   - Copy the contents of `supabase/migrations/002_users_rls_policies.sql`
   - Paste into the SQL Editor
   - Click **Run** (or press Ctrl+Enter)

3. **Verify Success**:
   - You should see: "Success. No rows returned"
   - Scroll to bottom to see the policy verification query results
   - Should show 4 policies created

### Method 2: Using psql Command Line

```bash
# Connect to your Supabase database
psql "postgresql://postgres:YOUR_PASSWORD@209.145.59.219:5432/postgres"

# Run the migration file
\i supabase/migrations/002_users_rls_policies.sql

# Exit
\q
```

### Method 3: Using Supabase CLI

```bash
# Make sure you're in the project directory
cd /path/to/Printyx

# Apply the migration
supabase db push

# Or apply specific migration
supabase migration up
```

### Method 4: Quick Fix via SQL Editor (Fastest) ⭐ START HERE

**This is the fastest way to fix the 403 error!**

Run this minimal SQL in Supabase SQL Editor:

```sql
-- Quick fix: Allow users to read their own data
ALTER TABLE users ENABLE ROW LEVEL SECURITY;

-- Drop policy if it exists (for idempotency)
DROP POLICY IF EXISTS "Users can read own data" ON users;

-- Create policy to allow users to read their own record
CREATE POLICY "Users can read own data"
ON users FOR SELECT TO authenticated
USING (auth.uid()::text = id);

-- Grant permissions
GRANT SELECT ON users TO authenticated;
```

**That's it!** Refresh your browser after running this.

## Verify the Fix

After applying the migration:

1. **Refresh your browser** (Ctrl+Shift+R / Cmd+Shift+R)
2. **Check console logs** - you should see:
   ```
   ✅ GET https://api.printyx.net/rest/v1/users?... 200 (OK)
   Using role string 'admin' - level 8, isAdmin: true
   ```
3. **Check your user display** - should show "Admin" or your actual role instead of "User"

## Expected Results

After applying RLS policies, the console should show:

- ✅ No 403 Forbidden errors
- ✅ User profile successfully loaded
- ✅ Role detected from database
- ✅ Correct permissions granted

Example:

```
Using role string 'admin' - level 8, isAdmin: true
isPlatformUser: true
role.level: 8
role.name: "admin"
```

## Troubleshooting

### Still getting 403 Forbidden?

1. **Check if RLS is causing the issue**:

   ```sql
   -- Temporarily disable RLS to test (NOT for production!)
   ALTER TABLE users DISABLE ROW LEVEL SECURITY;
   ```

   If this fixes it, the RLS policies aren't configured correctly.

2. **Check your JWT token**:
   - Copy your access token from browser DevTools → Application → Local Storage
   - Go to https://jwt.io and paste the token
   - Verify the `sub` field matches your user ID

3. **Check Supabase Auth settings**:
   - In Supabase Dashboard → Authentication → Settings
   - Ensure JWT expiration is reasonable (default: 3600 seconds)
   - Check if any additional RLS helpers are enabled

4. **Use Service Role Key** (temporary workaround):
   You can temporarily bypass RLS by using the service role key in the frontend, but this is NOT recommended for production:

   In `.env`:

   ```env
   # TEMPORARY - DO NOT USE IN PRODUCTION
   VITE_SUPABASE_ANON_KEY=<your-service-role-key>
   ```

### Alternative: Backend API Endpoint

If RLS continues to be problematic, we can create a backend API endpoint to fetch user data:

```typescript
// server/routes/user-profile-routes.ts
app.get('/api/auth/me', authenticateSupabaseJWT, async (req, res) => {
  const userId = req.supabaseUser?.id;
  if (!userId) {
    return res.status(401).json({ error: 'Not authenticated' });
  }

  const [user] = await db.select().from(users).where(eq(users.id, userId)).limit(1);

  return res.json(user);
});
```

Then update `useSupabaseAuth.ts` to use this endpoint instead of direct Supabase query.

## Security Notes

- ✅ Users can only read their own user record
- ✅ Users cannot change their role, tenant_id, or is_platform_user
- ✅ Service role has full access for backend operations
- ✅ Platform admins can read all users for admin features

## Rollback

If you need to rollback the RLS policies:

```sql
-- Remove all policies
DROP POLICY IF EXISTS "Users can read their own data" ON users;
DROP POLICY IF EXISTS "Service role can read all users" ON users;
DROP POLICY IF EXISTS "Platform admins can read all users" ON users;
DROP POLICY IF EXISTS "Users can update their own data" ON users;

-- Disable RLS (use with caution!)
ALTER TABLE users DISABLE ROW LEVEL SECURITY;
```

---

**Next Steps**:

1. Apply the RLS migration using one of the methods above
2. Refresh your browser
3. Check console for successful user profile fetch
4. Verify you see your admin role instead of "User"

**Questions?**
If you still see issues after applying the RLS policies, check:

- Supabase server logs for RLS policy violations
- Your JWT token payload (jwt.io)
- Database connection settings
