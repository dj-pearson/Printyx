# How to Find and Run the Migration on Your Server

## Step 1: SSH to Server

```bash
ssh root@209.145.59.219
```

## Step 2: Find the Printyx Directory

Try these commands to locate your Printyx project:

### Option A: Search from root

```bash
# Search for the project by finding package.json with "rest-express"
find / -name "package.json" -type f 2>/dev/null | xargs grep -l "rest-express" | head -5

# Or search for the supabase directory
find / -type d -name "supabase" 2>/dev/null | grep -i printyx

# Or search for a unique file
find / -name "create-missing-tables-server.sh" 2>/dev/null

# Or search for drizzle.config.ts
find / -name "drizzle.config.ts" 2>/dev/null
```

### Option B: Check common deployment locations

```bash
# Check common locations
ls -la /root/Printyx 2>/dev/null || echo "Not in /root/Printyx"
ls -la /home/*/Printyx 2>/dev/null || echo "Not in home directories"
ls -la /opt/Printyx 2>/dev/null || echo "Not in /opt/Printyx"
ls -la /var/www/Printyx 2>/dev/null || echo "Not in /var/www/Printyx"
ls -la ~/printyx 2>/dev/null || echo "Not in ~/printyx (lowercase)"

# Check Coolify deployment directories
find /data -name "shared" -type d 2>/dev/null | grep -i printyx
ls -la /data/coolify/applications/* 2>/dev/null | grep -i printyx
```

### Option C: Check running Docker containers for clues

```bash
# List all containers and look for paths
docker ps --format "table {{.Names}}\t{{.Command}}" | grep -E "(printyx|edge|functions)"

# Inspect a container to find mounted volumes
docker inspect $(docker ps -q) | grep -i printyx | grep -i "Source\|Destination"

# Check Docker compose files
find / -name "docker-compose.yml" -type f 2>/dev/null | xargs grep -l "printyx" 2>/dev/null
```

### Option D: Check recent Git operations

```bash
# Find recently modified Git repositories
find / -name ".git" -type d 2>/dev/null | while read git; do
    dir=$(dirname "$git")
    lastcommit=$(cd "$dir" && git log -1 --format="%ar" 2>/dev/null)
    if [ ! -z "$lastcommit" ]; then
        echo "$dir - Last commit: $lastcommit"
    fi
done | grep -i printyx
```

## Step 3: Once You Find It

```bash
# Let's say you found it at /data/coolify/applications/xxxxx
cd /data/coolify/applications/xxxxx  # Use the actual path you found

# Verify it's the right place
ls -la | grep -E "(package.json|shared|supabase)"

# Pull latest code
git pull

# Make script executable
chmod +x create-missing-tables-server.sh

# Run the migration
./create-missing-tables-server.sh
```

## Step 4: Alternative - Run Without Finding Directory

If you can't find it easily, just download and run inline:

```bash
# Set up connection
DB_HOST="127.0.0.1"
DB_PORT="5433"
DB_USER="postgres"
DB_PASS="Ta881v34EPbKK92E2F0oZpc4Els39giz"
export DATABASE_URL="postgresql://${DB_USER}:${DB_PASS}@${DB_HOST}:${DB_PORT}/${DB_NAME}"

# Clone fresh copy to temp location
cd /tmp
git clone https://github.com/dj-pearson/Printyx.git
cd Printyx

# Install dependencies
npm install

# Run Drizzle push
npm run db:push

# Apply triggers
export PGPASSWORD="$DB_PASS"
psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d postgres -f supabase/migrations/005_comprehensive_schema.sql

# Reload schema
psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d postgres -c "NOTIFY pgrst, 'reload schema';"

# Restart PostgREST
docker ps | grep "supabase-rest" | awk '{print $1}' | xargs docker restart

# Check results
psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d postgres -c "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'public';"
```

## Quick One-Liner to Find It

```bash
ssh root@209.145.59.219 "find / -name 'drizzle.config.ts' -type f 2>/dev/null | head -1 | xargs dirname"
```

This will show you the exact directory path!
