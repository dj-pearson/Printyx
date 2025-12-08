# How to Identify Your PrintyxSupabase Container in Coolify

## Method 1: Check Container Names in Coolify

1. Go to **Coolify Dashboard**
2. Find your **"PrintyxSupabase"** service
3. Click on it
4. Look at the **Service Details** or **Containers** tab
5. The PostgreSQL container name usually includes:
   - The project name (e.g., `printyx`)
   - Service identifier (e.g., `supabase`)
   - Component (e.g., `db`, `postgres`, `database`)

**Example container names:**
- `printyx-supabase-db`
- `printyx_supabase_postgres`
- `printyx-db-1`
- `supabase-db-printyx`

## Method 2: Use Docker to Find Containers

```powershell
# Show all running containers with details
docker ps --format "table {{.Names}}\t{{.Image}}\t{{.Status}}" | Select-String -Pattern "printyx"
```

## Method 3: Check Container Labels

```powershell
# Show containers with Coolify labels for your project
docker ps --filter "label=coolify.name=PrintyxSupabase" --format "{{.Names}}"
```

Or:

```powershell
# Show all Supabase-related containers
docker ps | Select-String -Pattern "supabase"
```

## Method 4: Look for PostgreSQL Port

```powershell
# Find containers exposing PostgreSQL port (5432)
docker ps --format "table {{.Names}}\t{{.Ports}}" | Select-String -Pattern "5432"
```

## In the Updated Script

When you run `.\fix-postgres-password.ps1`, it will now:

1. **List all PostgreSQL/Supabase containers** with numbers
2. **Highlight** any with "printyx" in the name with ⭐
3. **Let you choose** by entering the number

Example output:
```
Found PostgreSQL/Supabase containers:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  [1] printyx-supabase-db ⭐ (Likely PrintyxSupabase)
      Image: supabase/postgres:15.1.0.117
      Status: Up 2 hours
      
  [2] other-project-postgres
      Image: postgres:15
      Status: Up 5 days
      
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Select the PostgreSQL container number for PrintyxSupabase [1-2]: 
```

Just enter **1** to select the PrintyxSupabase container!

## Tips

- If you're unsure, look for containers with:
  - `supabase` in the name
  - `postgres` in the image
  - Recently restarted (if you just changed passwords)
  
- The script is safe - it will show you what it found before making changes

- You can always cancel with `Ctrl+C` if you're not sure

