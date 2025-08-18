# Database Updater Integration Guide

## Overview

The Database Updater system provides automated, CRON-based injection of realistic data into specific database tables for tenant `550e8400-e29b-41d4-a716-446655440000`. This system is designed for Root Admin control and includes comprehensive logging, monitoring, and configuration capabilities.

## Quick Start

### 1. Install Dependencies

```bash
npm install node-cron commander
```

### 2. Basic Usage

#### Start the System (Production)
```bash
npm run updater:start
```

#### Get System Status
```bash
npm run updater:status
```

#### Test in Dry-Run Mode
```bash
npm run updater:test
```

### 3. Programmatic Usage

```typescript
import { startDatabaseUpdater } from './server/database-updater';

// Start with default configuration
const manager = await startDatabaseUpdater({
  logLevel: 'info',
  enableScheduling: true,
});

// Check status
const status = manager.getStatus();
console.log('System running:', status.isRunning);

// Stop when needed
await manager.stop();
```

## System Architecture

### Core Components

```
DatabaseUpdaterManager
├── CronScheduler (CRON-based scheduling)
├── UpdaterRegistry (Updater management)
├── Logger (Comprehensive logging)
└── UpdaterConfig (Configuration management)

Updaters:
├── BusinessRecordActivityUpdater (CRM activities)
├── ServiceTicketUpdater (Service requests)
└── BusinessRecordUpdater (New leads)
```

### Target Configuration

- **Tenant ID**: `550e8400-e29b-41d4-a716-446655440000`
- **Customer ID**: `cust-1` (for service tickets)

### Default Schedule

| Updater | Schedule | Description |
|---------|----------|-------------|
| Business Activities | `0 */2 9-17 * * 1-5` | Every 2 hours, 9 AM - 5 PM, Mon-Fri |
| Service Tickets | `0 0 */6 * * *` | Every 6 hours |
| New Leads | `0 0 10 * * 1-5` | Daily at 10 AM, Mon-Fri |

## API Endpoints

### REST API Integration

Add to your Express app:

```typescript
import { updaterRoutes } from './server/database-updater';

app.use('/api/database-updater', updaterRoutes);
```

#### Available Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/database-updater/status` | Get system status |
| POST | `/api/database-updater/start` | Start the system |
| POST | `/api/database-updater/stop` | Stop the system |
| POST | `/api/database-updater/execute/:updaterName` | Execute specific updater |
| PUT | `/api/database-updater/config` | Update configuration |
| GET | `/api/database-updater/logs` | Get recent logs |
| GET | `/api/database-updater/metrics` | Get system metrics |
| POST | `/api/database-updater/dry-run/:updaterName` | Test updater |
| GET | `/api/database-updater/health` | Health check |

#### Example API Usage

```bash
# Get system status
curl http://localhost:5000/api/database-updater/status

# Execute business activities updater
curl -X POST http://localhost:5000/api/database-updater/execute/business_record_activities

# Get recent logs
curl http://localhost:5000/api/database-updater/logs?count=50

# Update configuration
curl -X PUT http://localhost:5000/api/database-updater/config \
  -H "Content-Type: application/json" \
  -d '{"config": {"scheduleConfig": {"businessActivities": "0 */1 9-17 * * 1-5"}}}'
```

## CLI Commands

### Available Commands

```bash
# System management
npm run updater start              # Start with scheduling
npm run updater start --dry-run    # Start in dry-run mode
npm run updater status             # Get system status
npm run updater config             # Show configuration

# Manual execution
npm run updater execute business_record_activities
npm run updater execute service_tickets
npm run updater execute business_records

# Testing and logs
npm run updater test               # Test all updaters (dry-run)
npm run updater logs               # Show recent logs
npm run updater logs --count 100  # Show 100 recent logs
```

### CLI Examples

```bash
# Start system with debug logging
npm run updater start --log-level debug

# Execute single updater in dry-run mode
npm run updater execute business_records --dry-run

# Show last 200 log entries
npm run updater logs --count 200
```

## Configuration

### Environment Variables

```bash
# Optional: Set log level
export DATABASE_UPDATER_LOG_LEVEL=info

# Optional: Set timezone
export DATABASE_UPDATER_TIMEZONE=America/New_York
```

### Programmatic Configuration

```typescript
import { DatabaseUpdaterManager } from './server/database-updater';

const manager = new DatabaseUpdaterManager({
  dryRun: false,
  logLevel: 'info',
  enableScheduling: true,
  configOverrides: {
    scheduleConfig: {
      businessActivities: '0 */1 9-17 * * 1-5', // Every hour
      serviceTickets: '0 0 */4 * * *',           // Every 4 hours
      newLeads: '0 0 8 * * 1-5',                 // Daily at 8 AM
    },
    executionConfig: {
      enabledUpdaters: {
        businessActivities: true,
        serviceTickets: true,
        newLeads: false, // Disable new leads
      },
      maxConcurrentExecutions: 2,
      executionTimeoutMinutes: 10,
    },
  },
});
```

## Generated Data Examples

### Business Record Activities

- **Types**: calls, emails, meetings, demos, proposals, tasks, notes
- **Realistic subjects**: "Discovery call with prospect", "Equipment proposal sent"
- **Business logic**: Follow-up dates, duration tracking, outcome recording
- **Frequency**: 1-3 activities per execution

### Service Tickets

- **Types**: paper jams, quality issues, network problems, maintenance
- **Realistic scenarios**: Error codes, customer descriptions, required parts
- **Auto-numbering**: Sequential ticket numbers (ST-1000, ST-1001, etc.)
- **Frequency**: 1-2 tickets per execution

### New Leads

- **Industries**: Healthcare, legal, education, manufacturing, etc.
- **Realistic data**: Company names, contact info, revenue estimates
- **Lead scoring**: Interest levels, estimated deal values
- **Frequency**: 1 lead per execution (daily)

## Monitoring and Logging

### Log Levels

- **debug**: Detailed execution information
- **info**: General system information (default)
- **warn**: Warning conditions
- **error**: Error conditions

### Log Files

Logs are stored in the `logs/` directory:
```
logs/
├── database-updater-2024-01-15.log
├── database-updater-2024-01-16.log
└── ...
```

### Metrics Tracking

Each updater tracks:
- Total executions
- Successful executions
- Failed executions
- Average execution time
- Last execution timestamp
- Error messages

### Health Monitoring

```typescript
import { checkUpdaterHealth } from './server/database-updater';

const health = checkUpdaterHealth();
console.log('Health status:', health.status);
```

## Troubleshooting

### Common Issues

#### 1. System Won't Start
```bash
# Check logs
npm run updater logs

# Verify configuration
npm run updater config

# Test in dry-run mode
npm run updater test
```

#### 2. Updaters Not Executing
```bash
# Check if system is running
npm run updater status

# Verify CRON expressions
npm run updater config

# Check recent logs for errors
npm run updater logs --count 50
```

#### 3. Database Connection Issues
- Verify database credentials in environment
- Check network connectivity
- Ensure tables exist in target tenant

#### 4. Permission Issues
- Verify user permissions for target tenant
- Check table access permissions
- Ensure proper RBAC configuration

### Debug Mode

Enable debug logging for detailed information:

```bash
npm run updater start --log-level debug
```

### Dry-Run Testing

Always test in dry-run mode first:

```bash
# Test all updaters
npm run updater test

# Test specific updater
npm run updater execute business_records --dry-run
```

## Security Considerations

1. **Tenant Isolation**: All operations are strictly limited to the configured tenant ID
2. **Input Validation**: All generated data is validated before insertion
3. **Transaction Safety**: Database operations use transactions for consistency
4. **Error Handling**: Comprehensive error handling prevents system crashes
5. **Audit Logging**: All operations are logged for audit trails

## Performance Considerations

1. **Batch Operations**: Updates are batched for efficiency
2. **Connection Pooling**: Database connections are pooled
3. **Configurable Concurrency**: Limit concurrent executions
4. **Timeout Protection**: Operations have configurable timeouts
5. **Resource Monitoring**: Memory and CPU usage are monitored

## Support and Maintenance

### Adding New Updaters

1. Extend `BaseUpdater` class
2. Implement required methods
3. Register in `DatabaseUpdaterManager`
4. Add configuration options
5. Update documentation

### Modifying Schedules

```typescript
await manager.updateConfiguration({
  scheduleConfig: {
    businessActivities: '0 */3 9-17 * * 1-5', // Every 3 hours
  },
});
```

### Custom Data Generation

Override data generation methods in updater classes to customize generated data patterns.

## Examples

See `/server/database-updater/examples/` for complete usage examples:

```bash
# Run basic example
npm run example basic

# Run dry-run example
npm run example dry-run

# Run custom configuration example
npm run example custom
```

---

For additional support or feature requests, contact the development team or create an issue in the project repository.
