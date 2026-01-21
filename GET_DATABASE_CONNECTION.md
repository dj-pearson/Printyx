# How to Get Your Supabase Database Connection String

## 🎯 What You Need

A **PostgreSQL connection string** in this format:

```
postgresql://postgres:YOUR_PASSWORD@YOUR_HOST:5432/postgres
```

**NOT** an HTTP URL like `https://api.printyx.net`

---

## 📍 For Self-Hosted Supabase

### Method 1: Check Your Deployment Configuration

Your Supabase is likely hosted at your own infrastructure. Check:

1. **Docker Compose file** (if using Docker):

   ```bash
   # Look for database settings
   cat docker-compose.yml

   # Look for:
   # - POSTGRES_HOST
   # - POSTGRES_PORT (usually 5432)
   # - POSTGRES_PASSWORD
   # - POSTGRES_DB (usually 'postgres')
   ```

2. **Coolify Dashboard** (if using Coolify):
   - Go to your Supabase service
   - Look for "Environment Variables"
   - Find: `POSTGRES_HOST`, `POSTGRES_PASSWORD`, `POSTGRES_PORT`

3. **Environment Variables**:
   ```bash
   # Check your .env file or environment
   cat .env | grep POSTGRES
   ```

### Method 2: From Supabase Studio

If you have Supabase Studio running (usually at `http://localhost:3000`):

1. Open Supabase Studio
2. Go to **Settings** → **Database**
3. Look for **Connection Info**
4. Copy the **Connection string** (URI format)

### Method 3: Construct It Manually

Based on your setup, it's likely:

```
postgresql://postgres:YOUR_PASSWORD@printyx.net:5432/postgres
```

Or if running locally:

```
postgresql://postgres:YOUR_PASSWORD@localhost:5432/postgres
```

Or if using a specific internal host:

```
postgresql://postgres:YOUR_PASSWORD@db.printyx.net:5432/postgres
```

---

## 🔍 How to Test Your Connection String

Once you have it, test with:

```powershell
# Set the variable
$env:SUPABASE_DB_URL = "postgresql://postgres:YOUR_PASSWORD@YOUR_HOST:5432/postgres"

# Test connection
psql $env:SUPABASE_DB_URL -c "SELECT version();"
```

If successful, you'll see:

```
                                                 version
---------------------------------------------------------------------------------------------------------
 PostgreSQL 15.x on x86_64-pc-linux-gnu, compiled by gcc (GCC) 9.3.0, 64-bit
(1 row)
```

---

## 📋 Common Connection String Formats

### Self-Hosted (Docker)

```
postgresql://postgres:your_password@localhost:5432/postgres
```

### Self-Hosted (Remote)

```
postgresql://postgres:your_password@db.printyx.net:5432/postgres
```

### Supabase Cloud (if you were using it)

```
postgresql://postgres.xxxxxxxxxxxx:password@aws-0-us-east-1.pooler.supabase.com:5432/postgres
```

### With Supavisor Pooler (connection pooling)

```
postgresql://postgres.xxxxxxxxxxxx:password@aws-0-us-east-1.pooler.supabase.com:6543/postgres
```

---

## 🔐 Where to Find Your Password

### If You Don't Know Your Password:

1. **Check deployment files**:

   ```bash
   # Docker Compose
   cat docker-compose.yml | grep POSTGRES_PASSWORD

   # Environment file
   cat .env | grep POSTGRES_PASSWORD
   ```

2. **Check Coolify**:
   - Coolify Dashboard → Your Supabase Service → Environment Variables
   - Look for `POSTGRES_PASSWORD`

3. **Reset it** (if you have access):

   ```bash
   # Connect to your Supabase container
   docker exec -it supabase-db psql -U postgres

   # Reset password
   ALTER USER postgres PASSWORD 'new_password_here';
   ```

---

## 🚀 Once You Have It

### PowerShell:

```powershell
# Set the environment variable (current session only)
$env:SUPABASE_DB_URL = "postgresql://postgres:YOUR_PASSWORD@YOUR_HOST:5432/postgres"

# Run migration
.\tools\migrate-neon-to-supabase.ps1
```

### Or set it permanently:

```powershell
# Set for current user permanently
[System.Environment]::SetEnvironmentVariable('SUPABASE_DB_URL', 'postgresql://postgres:YOUR_PASSWORD@YOUR_HOST:5432/postgres', 'User')

# Then restart PowerShell and run:
.\tools\migrate-neon-to-supabase.ps1
```

---

## ❓ Still Can't Find It?

Check these locations:

1. **Supabase configuration files**:
   - `/opt/supabase/config.toml`
   - `~/.supabase/config.toml`
   - `./supabase/config.toml`

2. **Ask your hosting provider**:
   - If using Coolify, check the service logs
   - If using Docker, check container environment variables:
     ```bash
     docker inspect supabase-db | grep -i postgres
     ```

3. **Check your API endpoint configuration**:
   - Since you know `https://api.printyx.net` works
   - The database is likely at `db.printyx.net:5432` or `printyx.net:5432`

---

## 💡 Quick Test Commands

Try these to find your database:

```powershell
# Try common hosts
psql "postgresql://postgres:YOUR_PASSWORD@localhost:5432/postgres" -c "SELECT 1;"
psql "postgresql://postgres:YOUR_PASSWORD@printyx.net:5432/postgres" -c "SELECT 1;"
psql "postgresql://postgres:YOUR_PASSWORD@db.printyx.net:5432/postgres" -c "SELECT 1;"
psql "postgresql://postgres:YOUR_PASSWORD@127.0.0.1:5432/postgres" -c "SELECT 1;"
```

Replace `YOUR_PASSWORD` with your actual password.

The one that returns `(1 row)` is your correct connection string!
