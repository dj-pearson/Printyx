# Ralph - Autonomous AI Agent Loop

Ralph is an autonomous development system that runs Claude Code repeatedly to implement user stories from a PRD.

## Quick Start

### 1. Install Prerequisites

**Windows (PowerShell):**
```powershell
# Install jq for JSON processing
winget install jqlang.jq

# Install Claude Code if not already installed
npm install -g @anthropic-ai/claude-code
```

**macOS/Linux:**
```bash
# Install jq
brew install jq  # macOS
# OR
sudo apt install jq  # Ubuntu/Debian

# Install Claude Code
npm install -g @anthropic-ai/claude-code
```

### 2. Create a PRD

Create a `prd.json` file in your project root (see `prd.json.example` for format) with your user stories.

Each story should have:
- `id`: Unique identifier
- `title`: Brief description
- `description`: Detailed description
- `acceptanceCriteria`: Array of testable criteria
- `passes`: Boolean (false initially)
- `priority`: Number (lower = higher priority)
- `dependsOn`: Optional array of story IDs

### 3. Run Ralph

**Windows (PowerShell):**
```powershell
# Run for up to 10 iterations
.\scripts\ralph\ralph.ps1

# Specify max iterations
.\scripts\ralph\ralph.ps1 -MaxIterations 20

# Specify different tool (default is claude)
.\scripts\ralph\ralph.ps1 -Tool amp
```

**macOS/Linux (Bash):**
```bash
# Make executable (first time only)
chmod +x scripts/ralph/ralph.sh

# Run for up to 10 iterations
./scripts/ralph/ralph.sh

# Specify max iterations
./scripts/ralph/ralph.sh 20

# Specify different tool
./scripts/ralph/ralph.sh --tool amp 20
```

### 4. Monitor Progress

Ralph will:
1. Create a feature branch (from `branchName` in prd.json)
2. Pick the highest priority story where `passes: false`
3. Implement that story
4. Run quality checks
5. Commit if checks pass
6. Mark story as `passes: true` in prd.json
7. Update `progress.txt`
8. Repeat until all stories pass or max iterations reached

## How It Works

### Fresh Context Each Iteration

Each iteration spawns a **new Claude Code instance** with clean context. Memory persists via:
- **Git history** - All commits from previous iterations
- **progress.txt** - Learnings and context log
- **prd.json** - Which stories are complete
- **CLAUDE.md** - Project-specific conventions and patterns

### One Story at a Time

Ralph implements ONE user story per iteration. Each story should be small enough to complete in a single context window.

**Good story size:**
- Add a database column and migration
- Create a new API endpoint
- Build a UI component
- Add a filter to a list

**Too large (split into multiple stories):**
- "Build the entire dashboard"
- "Add authentication system"
- "Refactor the API layer"

### Quality Gates

Before marking a story complete, Ralph runs:
```bash
npm run check          # TypeScript validation
npm run lint           # ESLint
npm run format:write   # Prettier formatting
npm run test           # Unit tests
npm run build          # Production build
```

All checks must pass. Failed checks mean the story stays `passes: false`.

### Memory System

**progress.txt** - Append-only log of learnings:
```
Iteration 1 - story-001: Add database schema
Completed: 2025-01-20 14:30

Key Changes:
- Created business_activities table with tenantId
- Added indexes for common queries
- Applied with npm run db:push

Files Modified:
- shared/activities-schema.ts
- server/routes-activities.ts

---
```

**CLAUDE.md** (project root) - Updated with patterns discovered:
- "The settings panel is in client/src/pages/Settings.tsx"
- "Equipment fields require validation in shared/equipment-schema.ts"
- "Service caching uses 5-minute stale time"

## Files

| File | Purpose |
|------|---------|
| `ralph.ps1` | PowerShell version (Windows) |
| `ralph.sh` | Bash version (macOS/Linux) |
| `CLAUDE.md` | Prompt template for each iteration |
| `README.md` | This file |
| `prd.json.example` | Example PRD format |

## Troubleshooting

### "jq not found"

**Windows:**
```powershell
winget install jqlang.jq
```

**macOS:**
```bash
brew install jq
```

**Linux:**
```bash
sudo apt install jq
```

### "CLAUDE.md not found"

The prompt file should be in your project root or in `scripts/ralph/`. Copy it:
```bash
cp scripts/ralph/CLAUDE.md .
```

### Stories not completing

Check `progress.txt` for context. Common issues:
- Quality checks failing (TypeScript errors, test failures)
- Story too large for one iteration
- Missing dependencies
- Acceptance criteria unclear

### Need to restart

If Ralph gets stuck or you need to start over:

```bash
# Reset prd.json (mark all stories incomplete)
# Edit prd.json manually, set all "passes": false

# Clear progress log
rm progress.txt

# Start fresh
./scripts/ralph/ralph.ps1  # Windows
./scripts/ralph/ralph.sh   # macOS/Linux
```

## Best Practices

### Write Clear Acceptance Criteria

**Good:**
- "Schema file created in shared/activities-schema.ts"
- "All endpoints use requireAuth and requireTenant middleware"
- "Component renders at 375px, 768px, 1024px widths"
- "npm run test passes with >80% coverage"

**Too vague:**
- "Make it work"
- "Add the feature"
- "Fix bugs"

### Break Down Large Features

If a feature is complex, break it into small stories:

1. Database schema
2. Backend API endpoints
3. Frontend components
4. Page and routing
5. RBAC permissions
6. Unit tests
7. E2E tests
8. Documentation

### Include Dependencies

Use `dependsOn` to ensure correct order:

```json
{
  "id": "story-002",
  "title": "Create API endpoints",
  "dependsOn": ["story-001"],  // Must complete schema first
  "passes": false
}
```

### Keep progress.txt Clean

Append structured notes after each iteration:
- What was implemented
- What was learned
- Any gotchas
- Files modified

Future iterations will read this for context.

### Update CLAUDE.md Frequently

When you discover patterns, conventions, or gotchas, add them to the project root `CLAUDE.md`. This helps all future iterations.

## Integration with Printyx

Ralph is configured for the Printyx project with:

- **Multi-tenant architecture** - All stories must respect tenant isolation
- **RBAC** - Use requirePermission middleware
- **Database** - Drizzle ORM with PostgreSQL
- **Frontend** - React + TanStack Query + shadcn/ui
- **Testing** - Vitest (unit) + Playwright (E2E)

See the project root `CLAUDE.md` for complete architectural guidance.

## Credits

Ralph is based on Geoffrey Huntley's Ralph pattern. This implementation is adapted for the Printyx tech stack and Windows development environment.

Learn more: https://github.com/snarktank/ralph
