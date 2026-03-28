# Disaster Recovery Runbook

**Last Updated**: 2026-03-28
**Owner**: Platform Operations Team

---

## Overview

This runbook documents the procedures for backing up and restoring the Printyx database infrastructure. It covers automated daily backups, manual backup procedures, and disaster recovery steps.

## Infrastructure

| Component | Details |
|-----------|---------|
| **Database** | PostgreSQL via Supabase (209.145.59.219:5433) |
| **Backup Storage** | Google Cloud Storage (GCS) |
| **Backup Tool** | pg_dump + gzip |
| **Automation** | K8s CronJob (`k8s/base/cronjob-backup.yaml`) |
| **Schedule** | Daily at 2:00 AM UTC |

## Retention Policy

| Tier | Retention | Description |
|------|-----------|-------------|
| Daily | 7 days | Every daily backup |
| Weekly | 4 weeks | Sunday backups |
| Monthly | 12 months | 1st of month backups |

---

## 1. Automated Backups

### K8s CronJob

The automated backup runs via `k8s/base/cronjob-backup.yaml`:

- **Schedule**: `0 2 * * *` (daily at 2:00 AM UTC)
- **Concurrency**: `Forbid` (prevents overlapping runs)
- **Timeout**: 1 hour (`activeDeadlineSeconds: 3600`)
- **Retries**: 2 (`backoffLimit: 2`)
- **History**: Keeps last 7 successful, 3 failed jobs

### What Gets Backed Up

1. **Main database** → `printyx-backup-YYYY-MM-DD-HHmmss.sql.gz`
2. **Forecasting schema** → `printyx-forecast-backup-YYYY-MM-DD-HHmmss.sql.gz`

### Verification

Check backup CronJob status:

```bash
kubectl get cronjobs -n printyx
kubectl get jobs -n printyx --sort-by=.metadata.creationTimestamp | tail -5
```

Check the most recent job logs:

```bash
kubectl logs -n printyx job/$(kubectl get jobs -n printyx --sort-by=.metadata.creationTimestamp -o jsonpath='{.items[-1].metadata.name}')
```

---

## 2. Manual Backup Procedures

### Run a Full Backup

```bash
npm run db:backup
```

This backs up both databases and runs retention cleanup.

### Backup Main Database Only

```bash
npm run db:backup:main
```

### Backup Forecasting Database Only

```bash
npm run db:backup:forecast
```

### List Available Backups

```bash
npm run db:backup:list
```

Lists backups from both GCS and local storage.

---

## 3. Disaster Recovery Procedure

### Scenario: Database Corruption or Data Loss

**Estimated Recovery Time**: 15-30 minutes (depending on backup size)

#### Step 1: Assess the Situation

```bash
# Check current database status
npm run db:migrate:status

# List available backups
npm run db:backup:list
```

#### Step 2: Select a Backup

Choose the most recent backup before the incident:

```bash
# List backups with timestamps
npm run db:restore -- --list
```

#### Step 3: Restore

**Option A: Restore the most recent backup**

```bash
npm run db:restore -- --latest
```

**Option B: Restore a specific backup**

```bash
npm run db:restore -- printyx-backup-2026-03-28-020000.sql.gz
```

> **WARNING**: Restore requires interactive double confirmation for production databases. This is intentional - read the prompts carefully.

#### Step 4: Verify Restoration

```bash
# Check migration status
npm run db:migrate:status

# Run application health check
curl -s http://localhost:5000/health | jq .

# Verify key tables have data
npm run db:push -- --dry-run  # Shows schema diff without applying
```

#### Step 5: Restart Application

```bash
# If running in K8s
kubectl rollout restart deployment/printyx -n printyx

# If running locally
npm run dev
```

### Scenario: Restore to a Different Database

Set `RESTORE_TARGET_DB` to restore to a non-production database for testing:

```bash
RESTORE_TARGET_DB=postgresql://postgres:PASSWORD@localhost:5433/restore_test \
  npm run db:restore -- --latest
```

---

## 4. Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `BACKUP_GCS_BUCKET` | `printyx-backups` | GCS bucket for backups |
| `GOOGLE_APPLICATION_CREDENTIALS` | — | Path to GCS service account key |
| `DATABASE_URL` | — | PostgreSQL connection string |
| `RESTORE_TARGET_DB` | — | Override DB for restore target |

---

## 5. Monitoring & Alerts

### Check Backup Health

- Verify the K8s CronJob has `LAST SCHEDULE` within the last 24 hours
- Check GCS bucket for today's backup file
- Monitor failed job count (`failedJobsHistoryLimit: 3`)

### Common Issues

| Issue | Cause | Resolution |
|-------|-------|------------|
| Backup job timeout | Large database / slow network | Increase `activeDeadlineSeconds` |
| GCS upload failure | Credentials expired | Refresh `gcs-backup-credentials` secret |
| pg_dump connection refused | Database unreachable | Check VPN/firewall, verify DB_HOST |
| Restore fails midway | Disk space / permissions | Check available disk, verify DB user permissions |

---

## 6. Pre-Launch Checklist

Before accepting production data, verify the following:

- [ ] Run `npm run db:backup` and confirm backup file is created
- [ ] Verify backup is uploaded to GCS bucket
- [ ] Verify `npm run db:backup:list` shows the backup
- [ ] Test restore on a test database (NOT production)
- [ ] Verify retention cleanup works correctly
- [ ] Confirm K8s CronJob schedule is correct (daily 2:00 AM UTC)
- [ ] Verify GCS credentials are configured in K8s secrets
- [ ] Test alerting for failed backup jobs
