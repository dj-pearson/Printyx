# Database Schema Reporter - Usage Guide

## ✅ **Recommended: Docker Exec Mode** (Working)

The Docker exec approach successfully connects and generates schema reports by executing `psql` directly inside the PostgreSQL container via SSH.

### Quick Start

```bash
npm run check:schema:docker
```

### Requirements

**.env Configuration:**
```env
# Database
DB_USER=postgres
DB_PASSWORD=your_db_password
DB_NAME=postgres
DB_CONTAINER=Supabase-DB-cgkko0cscowggwk8sss44wkw

# SSH (for Docker exec mode)
DB_HOST=209.145.59.219
# Script automatically uses DB_PASSWORD for SSH authentication
# Or set explicitly:
# SSH_USER=root
# SSH_PASSWORD=your_ssh_password
```

### How It Works

1. **SSH Connection**: Connects to server as `root` using `DB_PASSWORD`
2. **Container Discovery**: Auto-discovers correct container name (case-insensitive matching)
3. **Direct Query**: Executes `psql` commands directly inside the container
4. **Bypasses Issues**: Avoids all pooler, SSL, and network configuration problems

### Output

- `database-schema-report.json` - Complete schema in JSON format
- `docs/DATABASE_SCHEMA.md` - Human-readable Markdown documentation

### Success Output

```
✅ Found 210 tables with 4,274 columns
📄 Schema report saved to: database-schema-report.json
📄 Markdown report saved to: docs/DATABASE_SCHEMA.md
```

---

## 🔧 **Alternative Methods** (For Reference)

### Direct Connection (SSL Auto-Retry)

```bash
npm run check:schema
```

**Status**: ❌ Fails with connection reset
- Tries 3 SSL configurations automatically
- Supabase pooler (port 5433) not accessible from external network

### SSH Tunnel Mode

```bash
npm run check:schema:ssh
```

**Status**: ⚠️ Requires explicit SSH_USER setting
- SSH tunnel works correctly
- Database connection through tunnel fails due to pooler configuration
- Use: `$env:SSH_USER='root'; npm run check:schema:ssh` for testing

**Known Issues**:
- Pooler port (5433) requires specific configuration
- Connection terminated unexpectedly even with correct SSL settings
- Docker exec approach is more reliable

---

## 🎯 **Why Docker Exec Works Best**

| Method | SSH | Network | Pooler | SSL | Status |
|--------|-----|---------|--------|-----|--------|
| **Docker Exec** | ✅ | ✅ | N/A | N/A | ✅ **Works** |
| Direct Connection | ❌ | ❌ | ❌ | ❌ | ❌ Fails |
| SSH Tunnel | ✅ | ✅ | ❌ | ⚠️ | ⚠️ Partial |

**Benefits**:
- ✅ No pooler configuration needed
- ✅ No SSL/TLS troubleshooting
- ✅ Direct PostgreSQL access
- ✅ Container auto-discovery
- ✅ Simple, reliable, fast

---

## 📊 **Generated Reports**

### JSON Report (`database-schema-report.json`)

Complete schema data structure:
```json
{
  "public.users": {
    "schema": "public",
    "name": "users",
    "description": "",
    "columns": [...]
  }
}
```

### Markdown Report (`docs/DATABASE_SCHEMA.md`)

Human-readable documentation with:
- Table listings
- Column definitions
- Data types and constraints
- Descriptions (if available)

---

## 🐛 **Troubleshooting**

### Container Not Found

If you get `No such container: Supabase-DB-*`:
1. Script auto-corrects case (Docker names are lowercase)
2. Check container name in `.env` matches: `docker ps | grep supabase-db`

### SSH Authentication Failed

```env
# Option 1: Use DB_PASSWORD for SSH (current setup)
DB_PASSWORD=your_password

# Option 2: Set explicit SSH credentials
SSH_USER=root
SSH_PASSWORD=your_ssh_password
```

### Permission Denied

Ensure SSH user has Docker access:
```bash
# On server
usermod -aG docker root
```

---

## 🔍 **Script Details**

### Location
- `scripts/database-schema-via-docker.ts` - Docker exec approach (✅ recommended)
- `scripts/database-schema-reporter.ts` - Direct/SSH tunnel approach

### Dependencies
- `ssh2` - SSH client library
- `pg` - PostgreSQL client (for direct/tunnel modes)

### Configuration Precedence

For SSH user:
```
SSH_USER > SERVER_USER > DB_USER > 'root'
```

For SSH password:
```
SSH_PASSWORD > DB_PASSWORD
```

---

## 📝 **Summary**

**✅ Use `npm run check:schema:docker`** for reliable schema reporting.

This approach:
- Successfully retrieves all 210 tables and 4,274 columns
- Bypasses network, SSL, and pooler configuration issues
- Auto-discovers the correct container name
- Generates comprehensive JSON and Markdown documentation

No additional configuration needed beyond standard `.env` database credentials!
