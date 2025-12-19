# 🚀 Quick Fix - Get Admin Access in 2 Minutes

## The Problem
You're seeing "User" instead of "admin" because of a 403 Forbidden error when fetching your profile.

## The Fix (Choose ONE)

### Option 1: RLS Policy Fix (Recommended - 1 minute) ⭐

1. **Open Supabase Dashboard**:
   - Go to your Supabase project dashboard
   - Click **SQL Editor** in left sidebar

2. **Paste and Run This SQL**:
```sql
ALTER TABLE users ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can read own data" ON users;

CREATE POLICY "Users can read own data"
ON users FOR SELECT TO authenticated
USING (auth.uid()::text = id);

GRANT SELECT ON users TO authenticated;
```

3. **Refresh Browser**: `Ctrl + Shift + R`

**Done!** You should now see "admin" and have full access.

---

### Option 2: Backend API Fallback (Already implemented!)

**Don't want to touch Supabase right now?**

1. **Restart Backend Server**:
```bash
npm run dev
```

2. **Hard Refresh Browser**: `Ctrl + Shift + R`

The app will automatically use `/api/auth/me` endpoint which bypasses RLS.

**Done!** Should work immediately.

---

## Verify It Worked

Open browser console, you should see:
- ✅ No 403 errors
- ✅ `Using role string 'admin' - level 8, isAdmin: true`
- ✅ User display shows "admin" instead of "User"

## Still Not Working?

1. **Check server logs**: Should see `✅ User profile routes registered`
2. **Check network tab**: Look for `/api/auth/me` request
3. **Clear cache**: Browser DevTools → Application → Clear Storage
4. **Try incognito**: Open in private/incognito window

---

## What's Happening?

- **403 Error**: Supabase RLS (Row Level Security) is blocking the query
- **Fix 1**: Adds a policy allowing you to read your own user record
- **Fix 2**: Uses backend API that has admin access to database

Both work! Choose whichever is easier for you.

---

**Need Help?**  
Check `docs/ROLE_DETECTION_COMPLETE_FIX.md` for full details.
