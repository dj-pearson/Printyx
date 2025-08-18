# Database Updater System

## Overview
A modular, CRON-based database updater system for Root Admin to inject new information into specific tenant tables with realistic, time-based data generation.

## Architecture

### Core Components
- **BaseUpdater**: Abstract base class for all updaters
- **UpdaterRegistry**: Central registry for managing updaters
- **CronScheduler**: CRON-based scheduling system
- **ConfigurationManager**: Centralized configuration management
- **Logger**: Comprehensive logging and monitoring

### Table Handlers
- **BusinessRecordActivityUpdater**: Updates business_record_activities table
- **ServiceTicketUpdater**: Updates service_tickets table
- **BusinessRecordUpdater**: Creates new leads in business_records table

## Configuration

### Target Parameters
- **Tenant ID**: `550e8400-e29b-41d4-a716-446655440000`
- **Customer ID**: `cust-1` (for service tickets)

### Default Schedule
- **Business Activities**: Every 2 hours during business hours (9 AM - 5 PM, Mon-Fri)
- **Service Tickets**: Every 6 hours
- **New Leads**: Daily at 10 AM

## Features

- ✅ Modular architecture for easy extension
- ✅ Realistic data generation with business logic
- ✅ CRON-based scheduling with timezone support
- ✅ Comprehensive logging and error handling
- ✅ Configuration-driven execution
- ✅ Root Admin control panel
- ✅ Dry-run mode for testing
- ✅ Database transaction safety

## Usage

```typescript
import { DatabaseUpdaterManager } from './DatabaseUpdaterManager';

const updater = new DatabaseUpdaterManager();
await updater.start();
```

## Files Structure

```
server/database-updater/
├── README.md
├── DatabaseUpdaterManager.ts      # Main orchestrator
├── config/
│   ├── UpdaterConfig.ts           # Configuration management
│   └── ScheduleConfig.ts          # CRON schedule definitions
├── core/
│   ├── BaseUpdater.ts             # Abstract base class
│   ├── UpdaterRegistry.ts         # Registry for updaters
│   ├── CronScheduler.ts           # CRON scheduler
│   └── Logger.ts                  # Logging system
├── updaters/
│   ├── BusinessRecordActivityUpdater.ts
│   ├── ServiceTicketUpdater.ts
│   └── BusinessRecordUpdater.ts
├── data-generators/
│   ├── ActivityGenerator.ts        # Activity data generation
│   ├── ServiceTicketGenerator.ts   # Service ticket data
│   └── LeadGenerator.ts           # Lead data generation
└── utils/
    ├── DataValidation.ts          # Data validation utilities
    └── DatabaseHelpers.ts         # Database helper functions
```
