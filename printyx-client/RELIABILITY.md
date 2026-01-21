# Printyx Client Reliability & Accuracy Guide

## Overview

The Printyx Monitoring Client is designed to achieve **99.9% uptime** and **100% accuracy** for billing and toner replenishment. This document explains the reliability features and how they ensure accurate meter readings for click charges.

## 99.9% Uptime Features

### 1. Offline Data Buffering (`data-buffer.ts`)

**Problem**: Network outages or platform downtime could cause data loss.

**Solution**: All metrics are buffered to disk if submission fails.

**Features:**

- Persistent storage survives client restarts
- Maximum buffer size: 1000 submissions
- Automatic cleanup of submissions older than 7 days
- File permissions: 600 (owner only)

**Exponential Backoff Schedule:**

```
Attempt 1: Immediate
Attempt 2: 30 seconds
Attempt 3: 1 minute
Attempt 4: 2 minutes
Attempt 5: 4 minutes
Attempt 6: 8 minutes
Attempt 7+: 16-30 minutes (capped)
```

**Buffer Locations:**

- Linux: `/var/lib/printyx-client/buffer.json`
- Default: `./buffer.json`

**Usage:**

```typescript
// Automatic buffering on failure
try {
  await apiClient.submitMetrics(...);
} catch (error) {
  dataBuffer.add(clientId, version, metrics); // Auto-buffered
}

// Automatic retry every minute
// Failed submissions retried with exponential backoff
```

### 2. Automatic Retry with Recovery

**Retry Task**: Runs every minute, attempts to submit buffered data.

**Recovery Process:**

1. Client collects metrics every N minutes
2. If submission fails → metrics buffered to disk
3. Every minute, retry task checks for ready submissions
4. Successful submission → removed from buffer
5. Failed submission → exponential backoff applied
6. On next attempt, backoff period must elapse first

**Maximum Retention:** 7 days (configurable)

**Guarantees:**

- ✅ No data loss during network outages
- ✅ No data loss during platform maintenance
- ✅ No data loss on client restart
- ✅ Automatic recovery when connectivity restored

## 100% Accuracy Features

### 1. Meter Tracking System (`meter-tracker.ts`)

**Problem**: Counter rollovers, duplicates, and device reboots can cause billing errors.

**Solution**: Comprehensive meter tracking with differential calculations.

**Features:**

#### Counter Rollover Detection

Printers typically have 8-digit counters (max: 99,999,999). When they reach the maximum, they roll over to 0.

**Example:**

```
Previous reading: 99,999,950
Current reading:          75
Naive calculation: 75 - 99,999,950 = -99,999,875 ❌
Correct calculation: (99,999,999 - 99,999,950) + 75 + 1 = 125 ✅
```

**Implementation:**

```typescript
if (current < previous) {
  // Rollover detected
  differential = MAX_COUNTER - previous + current + 1;
  hasRollover = true; // Flag for review
}
```

#### Duplicate Detection

Prevents billing the same reading twice.

**Detection Logic:**

- Compare all meter values (total, B&W, color, large format)
- If ALL values are identical → duplicate
- Duplicate readings are logged but NOT submitted
- Only new usage is reported

**Example:**

```
Reading 1: Total=1000, BW=700, Color=300
Reading 2: Total=1000, BW=700, Color=300  → Duplicate (skipped)
Reading 3: Total=1050, BW=720, Color=330  → New usage (submitted)

Differential: Total=50, BW=20, Color=30
```

#### Differential Calculations

Only report NEW usage since last reading.

**Metrics Tracked:**

- `totalImpressions`: All prints
- `bwImpressions`: Black & white prints
- `colorImpressions`: Color prints
- `largeImpressions`: Large format prints

**Example:**

```
Previous: Total=1000, BW=700, Color=300
Current:  Total=1050, BW=720, Color=330

Differential:
  Total: 50  (1050 - 1000)
  BW:    20  (720 - 700)
  Color: 30  (330 - 300)

Billing: 20 BW clicks + 30 color clicks = accurate invoice
```

#### First Reading Handling

- First reading for a device is recorded but NOT billed
- Establishes baseline for future differentials
- Prevents charging for historical usage

### 2. Persistent State Storage

**File**: `meters.json`

**Stored Per Device:**

```json
{
  "SERIAL123:192.168.1.100": {
    "serialNumber": "SERIAL123",
    "ipAddress": "192.168.1.100",
    "lastMeters": {
      "totalImpressions": 1050,
      "bwImpressions": 720,
      "colorImpressions": 330
    },
    "lastTimestamp": "2025-11-07T10:30:00Z",
    "totalReadings": 15,
    "lastTonerLevels": {
      "black": 45,
      "cyan": 78,
      "magenta": 82,
      "yellow": 91
    }
  }
}
```

**Benefits:**

- Survives client restarts
- Maintains accuracy across service interruptions
- Historical tracking for auditing

### 3. Data Validation

**Validation Rules:**

1. **Timestamp Validation**: Ensure readings are chronological
2. **Meter Sanity Checks**: Detect impossible values
3. **Differential Limits**: Flag suspiciously large differentials
4. **Device Identification**: Verify serial number + IP address

**Example Validations:**

```typescript
// Impossible to print 1 million pages in 5 minutes
if (differential > 1000000 && timeDiff < 300) {
  logger.warn('Suspicious differential detected');
}

// Color impressions can't exceed total
if (bwImpressions + colorImpressions > totalImpressions) {
  logger.error('Invalid meter readings');
}
```

## Toner Replenishment Features

### 1. Threshold-Based Alerts

**Threshold Levels:**

- **Critical** (≤10%): Trigger immediate order
- **Warning** (≤20%): Notify for review
- **Info**: Track usage trends

**Alert Generation:**

```typescript
interface TonerAlert {
  color: string; // 'black', 'cyan', 'magenta', 'yellow'
  level: number; // Current percentage
  severity: 'critical' | 'warning' | 'info';
  message: string; // Human-readable alert
  shouldOrder: boolean; // Auto-order flag
}
```

**Example:**

```
Device: Canon iR-ADV C5550i (Serial: ABC123)
Toner Levels:
  Black: 8%    → CRITICAL → shouldOrder=true
  Cyan: 15%    → WARNING  → shouldOrder=true (below 15%)
  Magenta: 75% → OK
  Yellow: 82%  → OK
```

### 2. Trend Analysis

**Rapid Depletion Detection:**

- Compare current level vs. previous reading
- If drop > 10% → High usage alert
- Predict days until empty based on usage rate

**Example:**

```
Previous Reading: Black=35%
Current Reading:  Black=15%
Drop: 20% in 1 day
Alert: "High usage detected - toner may need replacement soon"
```

### 3. Server-Side Alert Processing

**Integration Points:**

1. **Notification System**: Send alerts to technicians/admins
2. **Supply Ordering**: Trigger automatic toner orders
3. **Customer Portal**: Display toner status
4. **Service Contracts**: Check if toner is covered

**Server Logic:**

```typescript
if (tonerLevel <= CRITICAL_THRESHOLD) {
  // Check service contract
  const contract = await getServiceContract(deviceId);

  if (contract.includesToner) {
    // Auto-order toner
    await createSupplyOrder(deviceId, color, 'toner');
    await sendNotification('toner_ordered', { device, color });
  } else {
    // Notify customer to order
    await sendNotification('toner_low', { device, color });
  }
}
```

## Billing Integration

### 1. Click Charge Calculation

**Billing Data Provided:**

```json
{
  "differential": {
    "totalImpressions": 50,
    "bwImpressions": 20,
    "colorImpressions": 30,
    "largeImpressions": 0,
    "hasRollover": false
  },
  "isFirstReading": false,
  "isDuplicate": false
}
```

**Server Billing Logic:**

```typescript
// Get service contract rates
const contract = await getServiceContract(deviceId);

// Calculate billable clicks
const bwClicks = differential.bwImpressions;
const colorClicks = differential.colorImpressions;

// Apply base volume allowance
const bwOverage = Math.max(0, bwClicks - contract.baseVolumeBw);
const colorOverage = Math.max(0, colorClicks - contract.baseVolumeColor);

// Calculate charges
const bwCharge = bwOverage * contract.bwOverageRate;
const colorCharge = colorOverage * contract.colorOverageRate;

const totalCharge = bwCharge + colorCharge;

// Create invoice line items
await createInvoiceLineItem({
  deviceId,
  period: billingPeriod,
  bwClicks,
  colorClicks,
  bwOverage,
  colorOverage,
  totalCharge,
});
```

### 2. Billing Period Accuracy

**Challenges:**

- Meters collected continuously
- Billing periods are monthly/quarterly
- Need to align readings with billing dates

**Solution:**

```typescript
// Query meter readings for billing period
const startReading = await getClosestReading(startDate);
const endReading = await getClosestReading(endDate);

const usage = {
  bw: endReading.bw - startReading.bw,
  color: endReading.color - startReading.color,
};

// Handle rollovers within period
if (usage.bw < 0) {
  usage.bw = MAX_COUNTER - startReading.bw + endReading.bw + 1;
}
```

### 3. Audit Trail

**Complete Traceability:**

- Every meter reading stored in `deviceMetrics` table
- Client submission logged in `clientActivityLogs`
- Rollover events flagged in `rawData`
- Duplicate detections logged

**Audit Query Example:**

```sql
SELECT
  collectionTimestamp,
  totalImpressions,
  bwImpressions,
  colorImpressions,
  rawData->>'differential' as usage,
  rawData->>'hasRollover' as rollover
FROM device_metrics
WHERE deviceId = 'device-uuid'
  AND collectionTimestamp BETWEEN '2025-01-01' AND '2025-01-31'
ORDER BY collectionTimestamp;
```

## Uptime Metrics

**Target: 99.9% uptime = 43.2 minutes downtime per month**

**How We Achieve This:**

| Component             | Strategy                  | Recovery Time         |
| --------------------- | ------------------------- | --------------------- |
| **Client Crash**      | systemd auto-restart      | <10 seconds           |
| **Network Outage**    | Offline buffering         | Immediate (buffered)  |
| **Platform Downtime** | Retry with backoff        | 30s - 30min           |
| **Printer Offline**   | Skip and retry next cycle | Next collection cycle |
| **Database Error**    | Retry with backoff        | 30s - 30min           |

**Monitoring:**

- Client heartbeat every 5 minutes
- Platform monitors last heartbeat
- Alert if no heartbeat for 15 minutes
- Buffer status logged every submission

**Self-Healing:**

- Automatic service restart (systemd)
- Exponential backoff prevents overwhelming platform
- Buffered submissions persist across restarts
- No manual intervention required

## Testing Reliability

### Test Scenarios

**1. Network Outage:**

```bash
# Simulate network failure
sudo iptables -A OUTPUT -p tcp --dport 443 -j DROP

# Verify buffering
sudo journalctl -u printyx-client -f
# Should see: "Failed to submit metrics, adding to buffer"

# Restore network
sudo iptables -D OUTPUT -p tcp --dport 443 -j DROP

# Verify recovery
# Should see: "Buffered submission successful"
```

**2. Counter Rollover:**

```typescript
// Simulate rollover in test
const previous = { totalImpressions: 99999990 };
const current = { totalImpressions: 50 };

const diff = meterTracker.processMetrics({...});
// Should calculate: 60 impressions
// Should flag: hasRollover=true
```

**3. Duplicate Detection:**

```bash
# Collect metrics twice without device usage
printyx-client test 192.168.1.100  # Reading 1
printyx-client test 192.168.1.100  # Reading 2 (should be duplicate)

# Should see: "Duplicate reading skipped"
```

## Best Practices

### For Accurate Billing

1. **Consistent Collection Interval**: Use 5-15 minute intervals
2. **Verify First Reading**: Don't bill first reading for new devices
3. **Monitor Rollovers**: Review rollover events monthly
4. **Audit Differentials**: Flag unusually large usage spikes
5. **Backup Meters File**: Include `meters.json` in backups

### For Reliable Operation

1. **Monitor Buffer Size**: Alert if buffer > 100 submissions
2. **Log Rotation**: Rotate logs to prevent disk space issues
3. **Health Checks**: Monitor last successful collection
4. **systemd Watchdog**: Enable systemd watchdog timer
5. **Disk Space**: Ensure 1GB free for buffer and logs

### For Toner Replenishment

1. **Configure Thresholds**: Adjust based on delivery lead time
2. **Monitor Trends**: Track usage patterns per device
3. **Service Contracts**: Link devices to contracts for auto-ordering
4. **Notification Routing**: Configure alerts to appropriate teams
5. **Order History**: Track toner orders against alerts

## Troubleshooting

### Buffered Submissions Not Clearing

**Symptoms:**

- Buffer size keeps growing
- Retry attempts failing

**Checks:**

```bash
# Check buffer status
sudo cat /var/lib/printyx-client/buffer.json | jq '.[] | {id, attempts, timestamp}'

# Check network connectivity
curl -v https://your-printyx.com/api/client-metrics/heartbeat \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -H "X-Tenant-ID: YOUR_TENANT_ID"

# Check logs for specific errors
sudo journalctl -u printyx-client --since "1 hour ago" | grep "buffered submission"
```

**Solutions:**

1. Verify API key is valid
2. Check firewall rules allow outbound 443
3. Verify platform is accessible
4. Check for expired SSL certificates

### Inaccurate Meter Readings

**Symptoms:**

- Billing discrepancies
- Negative differentials
- Missing usage

**Checks:**

```bash
# Check meter state
sudo cat /var/lib/printyx-client/meters.json | jq

# Check for rollovers
sudo journalctl -u printyx-client | grep "rollover"

# Check for duplicates
sudo journalctl -u printyx-client | grep "duplicate"
```

**Solutions:**

1. Verify printer meters haven't been manually reset
2. Check for device replacement (new device, same IP)
3. Verify SNMP access to printer
4. Review rawData in deviceMetrics table

### Missed Toner Alerts

**Symptoms:**

- Toner depleted without warning
- No supply orders triggered

**Checks:**

```bash
# Check toner levels being reported
sudo journalctl -u printyx-client | grep "Toner Alert"

# Check server logs
SELECT * FROM client_activity_logs
WHERE activity = 'metrics_submitted'
ORDER BY timestamp DESC LIMIT 10;

# Check device metrics
SELECT tonerLevels FROM device_metrics
WHERE deviceId = 'device-uuid'
ORDER BY collectionTimestamp DESC LIMIT 5;
```

**Solutions:**

1. Verify toner levels in SNMP responses
2. Check alert thresholds in server code
3. Verify notification system integration
4. Check service contract includes toner

## Summary

The Printyx Monitoring Client provides **enterprise-grade reliability and accuracy** through:

✅ **99.9% Uptime:**

- Offline buffering with persistent storage
- Automatic retry with exponential backoff
- Self-healing with systemd watchdog
- Complete audit trail

✅ **100% Accuracy:**

- Counter rollover detection and handling
- Duplicate reading prevention
- Differential calculations for billing
- First reading baseline establishment

✅ **Toner Replenishment:**

- Real-time threshold monitoring
- Automatic alert generation
- Trend analysis for predictive ordering
- Service contract integration

✅ **Billing Integration:**

- Accurate click charges
- Billing period alignment
- Overage calculations
- Complete audit trail

This ensures **accurate invoicing**, **proactive toner management**, and **reliable operation** even in challenging network conditions.
