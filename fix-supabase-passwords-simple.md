# Fix Supabase PostgreSQL & Dashboard Passwords After Leak

## Two passwords to update:

### 1. PostgreSQL Database Password (CRITICAL - Fixes the `supabase_admin` errors)

### 2. Supabase Dashboard/Studio Password (For UI login)

---

## Part 1: Fix PostgreSQL Password (Fixes Analytics/Logflare)

### Step 1: Find PostgreSQL Container

```powershell
docker ps | Select-String postgres
```

### Step 2: Connect to PostgreSQL

```powershell
# Replace <container-name> with the actual container name from Step 1
docker exec -it <container-name> psql -U postgres -d postgres
```

### Step 3: Update the Database Password

```sql
-- This fixes the "invalid_password" error for supabase_admin
ALTER USER postgres WITH PASSWORD 'your-new-db-password';
ALTER USER supabase_admin WITH PASSWORD 'your-new-db-password';
\q
```

### Step 4: Update Environment Variables in Coolify

Make sure these match your new database password:

- `POSTGRES_PASSWORD=your-new-db-password`
- `DB_PASSWORD=your-new-db-password`

### Step 5: Restart All Services in Coolify

This will make Logflare/Analytics reconnect with the new password.

---

## Part 2: Fix Supabase Dashboard/Studio Password

The dashboard password is controlled by this environment variable:

- `DASHBOARD_PASSWORD` or `STUDIO_PASSWORD`

### Update in Coolify:

1. Go to your Supabase service → Environment Variables
2. Find `DASHBOARD_PASSWORD` (or `STUDIO_PASSWORD`)
3. Set it to your new password
4. Restart the Studio service

That's it! The Studio password doesn't require database changes - it's just an environment variable.

---

## Expected Results After Fix:

✅ Analytics/Logflare service shows **GREEN** (no more `invalid_password` errors)
✅ Can log into Supabase Dashboard with new password
✅ All services healthy

---

## Quick Command Reference

### One-liner to update PostgreSQL passwords:

```powershell
docker exec -i <postgres-container-name> psql -U postgres -d postgres -c "ALTER USER postgres WITH PASSWORD 'your-new-password'; ALTER USER supabase_admin WITH PASSWORD 'your-new-password';"
```

### Check if Logflare connects successfully:

```powershell
docker logs <analytics-container-name> --tail 50
```

Should see successful connection instead of password errors.
