# Database Schema Reporter - SSH Tunnel Mode

## Overview

The Database Schema Reporter now supports **SSH tunnel connections** for secure access to remote databases behind firewalls or in private networks.

---

## 🔐 **Two Connection Modes**

### **1. Direct Connection (Default)**
Uses `DATABASE_URL` to connect directly to the database.

```bash
npm run check:schema
```

**When to use:**
- Database is publicly accessible
- Already using SSL/TLS
- DATABASE_URL is configured

---

### **2. SSH Tunnel Connection**
Creates an SSH tunnel to the database server, then connects through localhost.

```bash
npm run check:schema:ssh
```

**When to use:**
- Database is behind a firewall
- SSH access to the database server
- Need extra security layer
- Can't connect directly to port 5432/5433

---

## 📋 **Required Environment Variables**

### **For SSH Tunnel Mode**

Add these to your `.env` file:

```env
# Database Connection (required)
DB_HOST=209.145.59.219          # Database server IP/hostname
DB_PORT=5433                     # Database port (default: 5432)
DB_USER=postgres                 # Database username
DB_PASSWORD=your_password        # Database password
DB_NAME=postgres                 # Database name

# SSH Connection (required for SSH mode)
SSH_HOST=209.145.59.219         # SSH server (often same as DB_HOST)
SSH_PORT=22                      # SSH port (default: 22)
SSH_USER=postgres               # SSH username
SSH_PASSWORD=your_ssh_password  # SSH password (or use SSH_PRIVATE_KEY)

# OR use private key instead of password:
# SSH_PRIVATE_KEY=/path/to/private/key

# Optional
LOCAL_TUNNEL_PORT=5532          # Local port for tunnel (default: 5532)
```

---

## 🚀 **Usage Examples**

### **Example 1: SSH with Password**

```env
# .env
DB_HOST=209.145.59.219
DB_PORT=5433
DB_USER=postgres
DB_PASSWORD=your_db_password
DB_NAME=postgres

SSH_HOST=209.145.59.219
SSH_PORT=22
SSH_USER=root
SSH_PASSWORD=your_ssh_password
```

```bash
npm run check:schema:ssh
```

---

### **Example 2: SSH with Private Key**

```env
# .env
DB_HOST=209.145.59.219
DB_PORT=5433
DB_USER=postgres
DB_PASSWORD=your_db_password
DB_NAME=postgres

SSH_HOST=209.145.59.219
SSH_PORT=22
SSH_USER=ubuntu
SSH_PRIVATE_KEY=/home/user/.ssh/id_rsa
```

```bash
npm run check:schema:ssh
```

---

### **Example 3: Environment Variable Override**

```bash
# Use SSH tunnel mode via environment variable
USE_SSH_TUNNEL=true npm run check:schema
```

---

## 🔧 **How It Works**

### **SSH Tunnel Flow:**

```
Your Computer → SSH Tunnel → Remote Server → PostgreSQL Database
  (localhost:5532) ──SSH──> (209.145.59.219:22) ──local──> (localhost:5433)
```

**Steps:**
1. Script connects to SSH server (`SSH_HOST:SSH_PORT`)
2. SSH tunnel forwards local port (`LOCAL_TUNNEL_PORT`) to remote database (`DB_HOST:DB_PORT`)
3. Script connects to database via `localhost:5532`
4. All traffic encrypted through SSH tunnel
5. Database sees connection from localhost (no firewall issues)

---

## 📊 **Expected Output**

### **SSH Mode:**

```bash
$ npm run check:schema:ssh

🔍 Starting Database Schema Report Generation...

🔐 SSH Tunnel Mode Enabled

🔐 Connecting to SSH server: postgres@209.145.59.219:22
✅ SSH connection established
✅ SSH tunnel active: localhost:5532 → 209.145.59.219:5433
✅ Connected to database
📊 Fetching all tables and columns...
   Found 127 tables

📝 Generating reports...

✅ Generated: docs/DATABASE_SCHEMA.md
✅ Generated: docs/DATABASE_QUICK_REFERENCE.md
✅ Generated: docs/DATABASE_VALIDATION_HELPER.md
✅ Generated: database-schema-report.json

================================================================================
📋 SUMMARY

📁 public
   Tables: 127
   Columns: 1,543
   Total Rows: 45,678

================================================================================

✅ Schema report generation complete!

🔌 Database connection closed
🔌 SSH tunnel closed
```

---

## ⚠️ **Troubleshooting**

### **Error: "Connection refused on port 22"**

**Cause:** SSH server is not accessible or firewall blocking.

**Fix:**
```bash
# Test SSH connectivity
ssh postgres@209.145.59.219

# Or with custom port
ssh -p 2222 postgres@209.145.59.219
```

---

### **Error: "Authentication failed"**

**Cause:** Wrong SSH username, password, or key.

**Fix:**
- Verify `SSH_USER` and `SSH_PASSWORD` are correct
- If using key, ensure `SSH_PRIVATE_KEY` path is correct
- Check SSH key permissions: `chmod 600 ~/.ssh/id_rsa`

---

### **Error: "Port 5532 already in use"**

**Cause:** Previous tunnel didn't close or port is used by another process.

**Fix:**
```bash
# Kill process using port
netstat -ano | findstr :5532  # Windows
lsof -ti:5532 | xargs kill    # Linux/Mac

# Or use different port
LOCAL_TUNNEL_PORT=5533 npm run check:schema:ssh
```

---

### **Error: "Database connection timeout"**

**Cause:** Database is not listening on the specified port or host.

**Fix:**
1. SSH into server and verify database is running:
   ```bash
   ssh postgres@209.145.59.219
   sudo systemctl status postgresql
   ```

2. Check PostgreSQL is listening:
   ```bash
   netstat -tln | grep 5433
   ```

3. Verify `pg_hba.conf` allows localhost connections:
   ```bash
   # Should have line like:
   host all all 127.0.0.1/32 md5
   ```

---

## 🔒 **Security Best Practices**

### **1. Use SSH Keys (Not Passwords)**

```bash
# Generate SSH key pair
ssh-keygen -t rsa -b 4096 -f ~/.ssh/database_key

# Copy public key to server
ssh-copy-id -i ~/.ssh/database_key.pub postgres@209.145.59.219

# Use in .env
SSH_PRIVATE_KEY=~/.ssh/database_key
```

**Benefits:**
- More secure than passwords
- No password in environment variables
- Can be easily revoked

---

### **2. Restrict SSH Access**

On the database server, edit `/etc/ssh/sshd_config`:

```bash
# Only allow specific users
AllowUsers postgres ubuntu

# Disable password auth (key only)
PasswordAuthentication no

# Disable root login
PermitRootLogin no
```

---

### **3. Use SSH Config File**

Create `~/.ssh/config`:

```
Host printyx-db
    HostName 209.145.59.219
    User postgres
    Port 22
    IdentityFile ~/.ssh/database_key
    ServerAliveInterval 60
```

Then in `.env`:
```env
SSH_HOST=printyx-db  # Uses SSH config
```

---

### **4. Environment Variable Security**

**⚠️ NEVER commit `.env` to git!**

Ensure `.gitignore` includes:
```
.env
.env.*
!.env.example
```

---

## 🔄 **Comparison: Direct vs SSH**

| Feature | Direct Connection | SSH Tunnel |
|---------|------------------|------------|
| **Speed** | Faster | Slightly slower |
| **Security** | SSL/TLS only | SSH encryption + SSL |
| **Firewall** | Needs open port | SSH port only |
| **Setup** | Simple | More complex |
| **Use Case** | Public databases | Private/secured databases |
| **Command** | `npm run check:schema` | `npm run check:schema:ssh` |

---

## 📚 **Environment Variable Reference**

### **Database Connection**

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `DATABASE_URL` | Direct mode | - | Full connection string |
| `DB_HOST` | SSH mode | - | Database server IP/hostname |
| `DB_PORT` | SSH mode | `5432` | Database port |
| `DB_USER` | SSH mode | `postgres` | Database username |
| `DB_PASSWORD` | SSH mode | - | Database password |
| `DB_NAME` | SSH mode | `postgres` | Database name |
| `DB_SSL` | Direct mode | `false` | Enable SSL |
| `DB_SSL_REJECT_UNAUTHORIZED` | Direct mode | `true` | Verify SSL cert |

### **SSH Tunnel**

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `SSH_HOST` | Yes | `DB_HOST` | SSH server |
| `SSH_PORT` | No | `22` | SSH port |
| `SSH_USER` | Yes | `DB_USER` | SSH username |
| `SSH_PASSWORD` | One of† | - | SSH password |
| `SSH_PRIVATE_KEY` | One of† | - | SSH key path |
| `LOCAL_TUNNEL_PORT` | No | `5532` | Local tunnel port |
| `USE_SSH_TUNNEL` | No | `false` | Force SSH mode |

**†** Must provide either `SSH_PASSWORD` or `SSH_PRIVATE_KEY`

---

## 💡 **Tips & Tricks**

### **1. Test SSH Connection First**

Before running the reporter, test SSH:

```bash
ssh -v postgres@209.145.59.219
```

This will show any SSH issues before running the script.

---

### **2. Use Verbose Logging**

Add `DEBUG=*` for detailed SSH debugging:

```bash
DEBUG=* npm run check:schema:ssh
```

---

### **3. Keep Tunnel Open for Multiple Commands**

The tunnel automatically closes after the script. For multiple operations, consider a persistent tunnel:

```bash
# Open persistent tunnel (separate terminal)
ssh -L 5532:localhost:5433 postgres@209.145.59.219 -N

# Then use direct mode (tunnel already open)
DATABASE_URL=postgresql://postgres:password@localhost:5532/postgres npm run check:schema
```

---

### **4. Scripting Multiple Operations**

```bash
#!/bin/bash
# setup-and-run.sh

# Set SSH mode
export USE_SSH_TUNNEL=true

# Run schema report
npm run check:schema:ssh

# Run system check
npm run check:system

# Run transformations
npm run lint:transformations
```

---

## 🧪 **Testing Your Setup**

### **Quick Connection Test**

Create `test-ssh-connection.ts`:

```typescript
import { Client } from 'ssh2';

const ssh = new Client();

ssh.on('ready', () => {
  console.log('✅ SSH connection successful!');
  ssh.end();
}).on('error', (err) => {
  console.error('❌ SSH connection failed:', err.message);
});

ssh.connect({
  host: process.env.SSH_HOST || '209.145.59.219',
  port: parseInt(process.env.SSH_PORT || '22'),
  username: process.env.SSH_USER || 'postgres',
  password: process.env.SSH_PASSWORD,
});
```

Run:
```bash
tsx test-ssh-connection.ts
```

---

## 📖 **Full Example Workflow**

### **Step 1: Set Up Environment**

```env
# .env
DB_HOST=209.145.59.219
DB_PORT=5433
DB_USER=postgres
DB_PASSWORD=your_secure_db_password
DB_NAME=postgres

SSH_HOST=209.145.59.219
SSH_PORT=22
SSH_USER=postgres
SSH_PASSWORD=your_secure_ssh_password
```

### **Step 2: Run Reporter**

```bash
npm run check:schema:ssh
```

### **Step 3: Review Output**

```bash
# View schema docs
code docs/DATABASE_SCHEMA.md

# Check JSON report
cat database-schema-report.json | jq '.totalTables'
```

### **Step 4: Validate Code**

```bash
npm run check:system
```

---

**You now have secure SSH tunnel support for accessing your database!** 🎉

---

*Last Updated: January 24, 2026*
