# Supabase on Coolify - Command Reference

A comprehensive guide for managing self-hosted Supabase instances deployed on Coolify.

---

## Table of Contents

1. [Connection Setup](#connection-setup)
2. [Database Access](#database-access)
3. [Container Management](#container-management)
4. [PostgreSQL Administration](#postgresql-administration)
5. [Backup & Restore](#backup--restore)
6. [Monitoring & Logs](#monitoring--logs)
7. [Network & Proxy Setup](#network--proxy-setup)
8. [Drizzle ORM Commands](#drizzle-orm-commands)
9. [Troubleshooting](#troubleshooting)

---

## Connection Setup

### Environment Variables Template

```bash
# Database Configuration
DB_HOST=<your-server-ip>           # e.g., 209.145.59.219
DB_PORT=5555                        # Local proxy port (if using socat)
DB_USER=postgres
DB_PASSWORD=<your-db-password>
DB_NAME=postgres

# Direct connection string
DATABASE_URL=postgresql://${DB_USER}:${DB_PASSWORD}@${DB_HOST}:${DB_PORT}/${DB_NAME}

# Coolify internal Docker network (for production deployments)
# DB_HOST=supabase-db-<service-id>
# DB_PORT=5432

# Supabase Configuration
SUPABASE_URL=https://api.<your-domain>
SUPABASE_ANON_KEY=<your-anon-key>
SUPABASE_SERVICE_ROLE_KEY=<your-service-role-key>

# Server SSH access
SERVER_HOST=<your-server-ip>
SERVER_USER=root
SERVER_PASSWORD=<your-server-password>
```

### Find Your Coolify Service ID

The service ID is in the container names. Look for patterns like:

- `supabase-db-<service-id>`
- `supabase-kong-<service-id>`
- `supabase-auth-<service-id>`

---

## Database Access

### SSH into Server

```bash
# Basic SSH
ssh root@<server-ip>

# SSH with specific port
ssh -p 22 root@<server-ip>
```

### Connect to PostgreSQL (from server)

```bash
# Via Docker exec (recommended)
docker exec -it supabase-db-<service-id> psql -U postgres

# Direct psql (if installed on host)
psql -h localhost -p 5432 -U postgres -d postgres
```

### Connect to PostgreSQL (from local machine)

```bash
# Via socat proxy (if configured)
psql -h <server-ip> -p 5555 -U postgres -d postgres

# Via SSH tunnel
ssh -L 5555:<internal-db-ip>:5432 root@<server-ip>
# Then in another terminal:
psql -h localhost -p 5555 -U postgres -d postgres
```

---

## Container Management

### List Supabase Containers

```bash
# List all running containers
docker ps

# Filter for Supabase containers
docker ps | grep supabase

# List all containers (including stopped)
docker ps -a | grep supabase
```

### Common Supabase Container Names

| Service            | Container Pattern                      |
| ------------------ | -------------------------------------- |
| Database           | `supabase-db-<service-id>`             |
| Auth               | `supabase-auth-<service-id>`           |
| REST API           | `supabase-rest-<service-id>`           |
| Realtime           | `supabase-realtime-<service-id>`       |
| Storage            | `supabase-storage-<service-id>`        |
| Kong (API Gateway) | `supabase-kong-<service-id>`           |
| Studio             | `supabase-studio-<service-id>`         |
| Edge Functions     | `supabase-edge-functions-<service-id>` |

### Container Operations

```bash
# Start a container
docker start supabase-db-<service-id>

# Stop a container
docker stop supabase-db-<service-id>

# Restart a container
docker restart supabase-db-<service-id>

# View container logs
docker logs supabase-db-<service-id>

# Follow logs in real-time
docker logs -f supabase-db-<service-id>

# Last 100 lines of logs
docker logs --tail 100 supabase-db-<service-id>

# Execute command in container
docker exec -it supabase-db-<service-id> <command>

# Get container IP address
docker inspect -f '{{range .NetworkSettings.Networks}}{{.IPAddress}}{{end}}' supabase-db-<service-id>
```

---

## PostgreSQL Administration

### Basic psql Commands

```sql
-- List all databases
\l

-- Connect to a database
\c <database_name>

-- List all tables
\dt

-- List all tables with sizes
\dt+

-- Describe a table structure
\d <table_name>

-- List all schemas
\dn

-- List all users/roles
\du

-- Show current connection info
\conninfo

-- Exit psql
\q
```

### User Management

```sql
-- Create a new user
CREATE USER <username> WITH PASSWORD '<password>';

-- Grant all privileges on database
GRANT ALL PRIVILEGES ON DATABASE <database> TO <username>;

-- Grant usage on schema
GRANT USAGE ON SCHEMA public TO <username>;

-- Grant all privileges on all tables
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO <username>;

-- Make user a superuser
ALTER USER <username> WITH SUPERUSER;

-- Remove superuser privilege
ALTER USER <username> WITH NOSUPERUSER;

-- Change user password
ALTER USER <username> WITH PASSWORD '<new_password>';

-- Delete a user
DROP USER <username>;
```

### Database Management

```sql
-- Create database
CREATE DATABASE <database_name>;

-- Create database with owner
CREATE DATABASE <database_name> OWNER <username>;

-- Drop database (be careful!)
DROP DATABASE <database_name>;

-- Rename database
ALTER DATABASE <old_name> RENAME TO <new_name>;
```

### Table Operations

```sql
-- List all tables in current schema
SELECT table_name FROM information_schema.tables
WHERE table_schema = 'public';

-- Get table row counts
SELECT schemaname, relname, n_live_tup
FROM pg_stat_user_tables
ORDER BY n_live_tup DESC;

-- Get database size
SELECT pg_size_pretty(pg_database_size('<database_name>'));

-- Get table sizes
SELECT
    relname as table_name,
    pg_size_pretty(pg_total_relation_size(relid)) as total_size
FROM pg_catalog.pg_statio_user_tables
ORDER BY pg_total_relation_size(relid) DESC;

-- Truncate table (delete all rows)
TRUNCATE TABLE <table_name>;

-- Drop table
DROP TABLE <table_name>;

-- Drop table if exists
DROP TABLE IF EXISTS <table_name>;
```

---

## Backup & Restore

### Backup Database

```bash
# Full database dump (from server)
docker exec supabase-db-<service-id> pg_dump -U postgres -d postgres > backup_$(date +%Y%m%d_%H%M%S).sql

# Compressed backup
docker exec supabase-db-<service-id> pg_dump -U postgres -d postgres | gzip > backup_$(date +%Y%m%d_%H%M%S).sql.gz

# Custom format (recommended for large databases)
docker exec supabase-db-<service-id> pg_dump -U postgres -Fc -d postgres > backup_$(date +%Y%m%d_%H%M%S).dump

# Backup specific tables
docker exec supabase-db-<service-id> pg_dump -U postgres -d postgres -t <table1> -t <table2> > tables_backup.sql

# Schema only (no data)
docker exec supabase-db-<service-id> pg_dump -U postgres -d postgres --schema-only > schema_backup.sql

# Data only (no schema)
docker exec supabase-db-<service-id> pg_dump -U postgres -d postgres --data-only > data_backup.sql
```

### Restore Database

```bash
# Restore from SQL file
docker exec -i supabase-db-<service-id> psql -U postgres -d postgres < backup.sql

# Restore from compressed file
gunzip -c backup.sql.gz | docker exec -i supabase-db-<service-id> psql -U postgres -d postgres

# Restore from custom format
docker exec -i supabase-db-<service-id> pg_restore -U postgres -d postgres < backup.dump

# Restore specific tables
docker exec -i supabase-db-<service-id> pg_restore -U postgres -d postgres -t <table_name> < backup.dump
```

### Copy Backup to Local Machine

```bash
# From server to local
scp root@<server-ip>:/path/to/backup.sql ./backup.sql

# From local to server
scp ./backup.sql root@<server-ip>:/path/to/backup.sql
```

---

## Monitoring & Logs

### View Container Logs

```bash
# Database logs
docker logs supabase-db-<service-id>

# Auth service logs
docker logs supabase-auth-<service-id>

# API Gateway (Kong) logs
docker logs supabase-kong-<service-id>

# Follow all Supabase logs
docker logs -f supabase-db-<service-id> & \
docker logs -f supabase-auth-<service-id> & \
docker logs -f supabase-kong-<service-id>
```

### Database Statistics

```sql
-- Active connections
SELECT * FROM pg_stat_activity;

-- Connection count by database
SELECT datname, count(*)
FROM pg_stat_activity
GROUP BY datname;

-- Long running queries
SELECT pid, now() - pg_stat_activity.query_start AS duration, query, state
FROM pg_stat_activity
WHERE (now() - pg_stat_activity.query_start) > interval '5 minutes';

-- Kill a specific query
SELECT pg_terminate_backend(<pid>);

-- Table statistics
SELECT * FROM pg_stat_user_tables;

-- Index usage statistics
SELECT * FROM pg_stat_user_indexes;
```

### Disk Usage

```bash
# Check disk space on server
df -h

# Check Docker disk usage
docker system df

# Clean up Docker (be careful!)
docker system prune -a
```

---

## Network & Proxy Setup

### Check PostgreSQL Listening Address

```bash
# Inside the database container
docker exec supabase-db-<service-id> cat /var/lib/postgresql/data/postgresql.conf | grep listen_addresses

# Check what port PostgreSQL is listening on
docker exec supabase-db-<service-id> cat /proc/net/tcp | awk '{print $2}' | cut -d: -f2 | sort -u
# Convert hex to decimal: 0x1539 = 5433, 0x1538 = 5432
```

### Configure PostgreSQL for External Access

```bash
# Change listen_addresses to allow all connections
docker exec supabase-db-<service-id> sed -i "s/#listen_addresses = 'localhost'/listen_addresses = '*'/" /var/lib/postgresql/data/postgresql.conf

# Restart the container to apply changes
docker restart supabase-db-<service-id>
```

### Setup socat Proxy

socat creates a TCP proxy to forward connections to the internal Docker network.

```bash
# Install socat (if not installed)
apt-get update && apt-get install -y socat

# Start socat proxy (foreground)
socat TCP-LISTEN:5555,bind=0.0.0.0,fork,reuseaddr TCP:<internal-db-ip>:5432

# Start socat proxy (background)
socat TCP-LISTEN:5555,bind=0.0.0.0,fork,reuseaddr TCP:<internal-db-ip>:5432 &

# Find internal DB IP
docker inspect -f '{{range .NetworkSettings.Networks}}{{.IPAddress}}{{end}}' supabase-db-<service-id>

# Example with actual IP
socat TCP-LISTEN:5555,bind=0.0.0.0,fork,reuseaddr TCP:10.0.2.5:5433 &

# Check if socat is running
ps aux | grep socat

# Kill socat process
pkill socat
```

### Setup SSH Tunnel (Alternative to socat)

```bash
# From local machine
ssh -L 5555:<internal-db-ip>:5432 root@<server-ip> -N

# Example
ssh -L 5555:10.0.2.5:5433 root@209.145.59.219 -N

# Then connect locally
psql -h localhost -p 5555 -U postgres
```

### Docker Network Inspection

```bash
# List all Docker networks
docker network ls

# Inspect a network
docker network inspect <network-name>

# Find which network a container is on
docker inspect <container-id> | grep -A 20 "Networks"
```

---

## Drizzle ORM Commands

### Schema Management

```bash
# Push schema changes to database (interactive)
npm run db:push

# Generate migration files
npx drizzle-kit generate

# Apply migrations
npx drizzle-kit migrate

# Pull schema from database
npx drizzle-kit introspect

# Open Drizzle Studio (database GUI)
npx drizzle-kit studio
```

### Drizzle Configuration

Create `drizzle.config.ts`:

```typescript
import { defineConfig } from 'drizzle-kit';

export default defineConfig({
  schema: './shared/schema.ts',
  out: './migrations',
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env.DATABASE_URL!,
  },
});
```

---

## Troubleshooting

### Connection Issues

```bash
# Test database connectivity
docker exec supabase-db-<service-id> pg_isready -U postgres

# Check if port is open
nc -zv <server-ip> 5555

# Check firewall rules (Ubuntu/Debian)
ufw status

# Allow port through firewall
ufw allow 5555/tcp
```

### Common Errors

| Error                                        | Solution                                                  |
| -------------------------------------------- | --------------------------------------------------------- |
| `ECONNREFUSED`                               | Database not accessible. Check socat/SSH tunnel, firewall |
| `password authentication failed`             | Wrong credentials in DATABASE_URL                         |
| `relation does not exist`                    | Run `npm run db:push` to create tables                    |
| `listen_addresses = 'localhost'`             | Update postgresql.conf and restart container              |
| `ENOTSUP: operation not supported on socket` | Add `WINDOWS_COMPAT=true` to .env (Windows only)          |

### Reset Database (DANGER!)

```bash
# Drop all tables in public schema
docker exec -it supabase-db-<service-id> psql -U postgres -d postgres -c "
DROP SCHEMA public CASCADE;
CREATE SCHEMA public;
GRANT ALL ON SCHEMA public TO postgres;
GRANT ALL ON SCHEMA public TO public;
"

# Then recreate tables
npm run db:push
```

### Check PostgreSQL Version

```bash
docker exec supabase-db-<service-id> psql -U postgres -c "SELECT version();"
```

### View PostgreSQL Configuration

```bash
# Show all settings
docker exec supabase-db-<service-id> psql -U postgres -c "SHOW ALL;"

# Show specific setting
docker exec supabase-db-<service-id> psql -U postgres -c "SHOW max_connections;"
docker exec supabase-db-<service-id> psql -U postgres -c "SHOW shared_buffers;"
```

---

## Quick Reference Card

### Most Common Commands

```bash
# SSH into server
ssh root@<server-ip>

# Connect to database
docker exec -it supabase-db-<service-id> psql -U postgres

# View logs
docker logs -f supabase-db-<service-id>

# Restart database
docker restart supabase-db-<service-id>

# Backup database
docker exec supabase-db-<service-id> pg_dump -U postgres -d postgres > backup.sql

# Start socat proxy
socat TCP-LISTEN:5555,bind=0.0.0.0,fork,reuseaddr TCP:<db-internal-ip>:5432 &

# Push schema
npm run db:push

# Check container IP
docker inspect -f '{{range .NetworkSettings.Networks}}{{.IPAddress}}{{end}}' supabase-db-<service-id>
```

---

## Environment-Specific Notes

### Development (Local Machine)

- Use socat proxy or SSH tunnel for database access
- Set `WINDOWS_COMPAT=true` on Windows
- Run `npm run dev` for hot reload

### Production (Coolify)

- Use internal Docker network hostnames (e.g., `supabase-db-<service-id>`)
- Use port 5432 (internal PostgreSQL default)
- No socat proxy needed - containers communicate directly

---

_Last updated: December 2024_
