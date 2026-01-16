# NEON to Supabase Migration via SSH

Since your Supabase database is **not publicly accessible** and requires SSH access, you have two migration approaches:

---

## 🎯 Method 1: Automated SSH Migration (Recommended)

Uses PowerShell to handle everything automatically via SSH.

### Quick Start:

```powershell
# Run the automated SSH migration
.\tools\migrate-via-ssh.ps1 -ServerHost "209.145.59.219" -ServerUser "root"
```

**What it does**:
1. Tests SSH connection
2. Uploads NEON export to server
3. Creates migration script
4. Runs migration on server
5. Verifies success

---

## 🎯 Method 2: Manual SSH Migration (More Control)

SSH into your server and run the migration manually.

### Step-by-Step:

#### 1. SSH into Your Server

```powershell
ssh root@209.145.59.219
```

#### 2. Upload NEON Export

From your local machine (separate PowerShell window):

```powershell
scp .\database-exports\complete-with-schema.sql root@209.145.59.219:/tmp/neon-export.sql
```

#### 3. On the Server - Find Your Database

```bash
# Check if Supabase is running in Docker
docker ps | grep supabase

# Or check for PostgreSQL process
ps aux | grep postgres

# Or check Coolify/deployment
coolify ps  # if using Coolify
```

#### 4. Run Migration

**If using Docker**:

```bash
# Get container name
CONTAINER=$(docker ps | grep supabase-db | awk '{print $1}')

# Backup current database
echo "Creating backup..."
docker exec $CONTAINER pg_dump -U postgres > /tmp/backup-$(date +%Y%m%d-%H%M%S).sql

# Count current tables
echo "Current table count:"
docker exec $CONTAINER psql -U postgres -t -c "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'public';"

# Import NEON data
echo "Importing NEON data (this will take 10-30 minutes)..."
docker exec -i $CONTAINER psql -U postgres < /tmp/neon-export.sql

# Verify
echo "New table count:"
docker exec $CONTAINER psql -U postgres -t -c "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'public';"

# Check core tables
docker exec $CONTAINER psql -U postgres -c "
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name IN ('users', 'companies', 'customers', 'invoices', 'quotes', 'service_tickets', 'equipment')
ORDER BY table_name;"
```

**If running directly (no Docker)**:

```bash
# Backup
pg_dump "postgresql://postgres:PASSWORD@localhost:5433/postgres" > /tmp/backup-$(date +%Y%m%d-%H%M%S).sql

# Import
psql "postgresql://postgres:PASSWORD@localhost:5433/postgres" < /tmp/neon-export.sql

# Verify
psql "postgresql://postgres:PASSWORD@localhost:5433/postgres" -c "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'public';"
```

---

## 🔍 Finding Your Database Setup

### Check Coolify

If using Coolify to host Supabase:

```bash
# SSH into server
ssh root@209.145.59.219

# Check Coolify services
cd /data/coolify
docker-compose ps

# Find Supabase database container
docker ps | grep -i "supabase\|postgres"

# Get database environment variables
docker inspect <container-id> | grep -i "POSTGRES_PASSWORD\|POSTGRES_USER\|POSTGRES_DB"
```

### Check Docker Compose

```bash
# Find docker-compose files
find /opt -name "docker-compose.yml" -o -name "docker-compose.yaml" 2>/dev/null
find /data -name "docker-compose.yml" -o -name "docker-compose.yaml" 2>/dev/null
find ~ -name "docker-compose.yml" -o -name "docker-compose.yaml" 2>/dev/null

# View Supabase compose file
cat /path/to/supabase/docker-compose.yml | grep -A 10 "postgres"
```

### Check Environment Variables

```bash
# Check for Supabase env file
cat /opt/supabase/.env
cat /data/supabase/.env
cat ~/.supabase/.env

# Or check systemd service
systemctl status supabase
```

---

## 📋 Quick Reference: Common Setups

### Setup 1: Coolify with Docker

```bash
# Container name is usually: coolify-supabase-db or similar
docker ps | grep supabase

# Run migration
docker exec -i <container-name> psql -U postgres < /tmp/neon-export.sql
```

### Setup 2: Supabase Self-Hosted (Docker Compose)

```bash
cd /opt/supabase  # or wherever it's installed

# Container is defined in docker-compose.yml
docker-compose ps

# Run migration
docker-compose exec db psql -U postgres < /tmp/neon-export.sql
```

### Setup 3: Direct PostgreSQL (No Docker)

```bash
# Find PostgreSQL port
netstat -tulpn | grep postgres

# Usually runs on port 5432 or 5433
psql -U postgres -p 5433 -h localhost < /tmp/neon-export.sql
```

---

## ⚠️ Important Notes

### Before Migration:

1. **Always backup first!**
   ```bash
   # Docker
   docker exec <container> pg_dump -U postgres > backup.sql
   
   # Direct
   pg_dump "postgresql://postgres:PASSWORD@localhost:5433/postgres" > backup.sql
   ```

2. **Check disk space:**
   ```bash
   df -h
   # Make sure you have at least 5GB free
   ```

3. **Test your backup:**
   ```bash
   head -n 100 backup.sql
   # Should show SQL commands, not errors
   ```

### During Migration:

- **Don't interrupt the process!** It can take 10-30 minutes
- You might see "NOTICE" messages - these are normal
- "already exists" warnings are OK (skipping duplicate objects)

### After Migration:

1. **Verify table count:**
   ```bash
   # Should show ~218 tables (181 from NEON + 37 new)
   docker exec <container> psql -U postgres -c "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'public';"
   ```

2. **Check data counts:**
   ```bash
   docker exec <container> psql -U postgres -c "
   SELECT 'users' as table, COUNT(*) FROM users
   UNION ALL SELECT 'companies', COUNT(*) FROM companies
   UNION ALL SELECT 'customers', COUNT(*) FROM customers
   UNION ALL SELECT 'invoices', COUNT(*) FROM invoices
   UNION ALL SELECT 'quotes', COUNT(*) FROM quotes;"
   ```

3. **Test your app:**
   - Go to https://printyx.net
   - Try to view customers list
   - Try to view an old invoice
   - Try to create a new customer

---

## 🔄 Rollback (If Needed)

If something goes wrong:

```bash
# Find your backup
ls -lh /tmp/backup-*.sql

# Restore it
docker exec -i <container> psql -U postgres < /tmp/backup-XXXXXX.sql

# Or for direct PostgreSQL:
psql "postgresql://postgres:PASSWORD@localhost:5433/postgres" < /tmp/backup-XXXXXX.sql
```

---

## 🆘 Troubleshooting

### "Permission denied"
```bash
# Make sure you're root or use sudo
sudo docker exec -i <container> psql -U postgres < /tmp/neon-export.sql
```

### "Could not translate host name to address"
```bash
# Database is inside Docker, use container name
docker exec -i <container> psql -U postgres < /tmp/neon-export.sql
```

### "relation already exists"
```bash
# This is OK - it means table already exists
# The import will skip it and continue
```

### "out of memory"
```bash
# Split the import into chunks
grep "CREATE TABLE" /tmp/neon-export.sql > schema-only.sql
docker exec -i <container> psql -U postgres < schema-only.sql

# Then import data table by table
# (This is more advanced - let me know if you need this)
```

---

## 📞 Need Help?

**Can't find your database?**

Run these commands and share the output:

```bash
# Check what's running
docker ps

# Check for PostgreSQL
ps aux | grep postgres
netstat -tulpn | grep 543

# Check Coolify (if using)
ls -la /data/coolify

# Check common Supabase locations
ls -la /opt/supabase
ls -la /data/supabase
ls -la ~/.supabase
```

---

## ✅ Success Checklist

After migration, you should have:

- [ ] ~218 total tables in database
- [ ] Can see old customer data in app
- [ ] Can view historical invoices
- [ ] Can view historical quotes
- [ ] Can create new customers (still works)
- [ ] All 177 missing tables now present
- [ ] Backup file saved in /tmp/

---

## 🎉 Quick Migration (If You Know Your Setup)

**One-liner for Docker**:

```bash
ssh root@209.145.59.219 "
docker exec $(docker ps | grep supabase-db | awk '{print $1}') pg_dump -U postgres > /tmp/backup.sql && 
scp YOUR_LOCAL_MACHINE:/path/to/complete-with-schema.sql /tmp/neon.sql &&
docker exec -i $(docker ps | grep supabase-db | awk '{print $1}') psql -U postgres < /tmp/neon.sql
"
```

(Replace YOUR_LOCAL_MACHINE with your local machine path)
