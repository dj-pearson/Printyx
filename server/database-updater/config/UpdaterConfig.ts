/**
 * Updater Configuration Management
 * Centralized configuration for the database updater system
 */

export interface ScheduleConfig {
  businessActivities: string;  // CRON expression for business activities
  serviceTickets: string;      // CRON expression for service tickets
  newLeads: string;           // CRON expression for new leads
}

export interface DatabaseConfig {
  connectionPool: {
    min: number;
    max: number;
    acquireTimeoutMillis: number;
    idleTimeoutMillis: number;
  };
  transactionTimeout: number;
  retryAttempts: number;
  retryDelay: number;
}

export interface DataGenerationConfig {
  businessActivities: {
    typesDistribution: Record<string, number>; // Activity type probabilities
    minDurationMinutes: number;
    maxDurationMinutes: number;
    businessHoursOnly: boolean;
  };
  serviceTickets: {
    priorityDistribution: Record<string, number>; // Priority probabilities
    statusDistribution: Record<string, number>;   // Status probabilities
    minEstimatedDuration: number;
    maxEstimatedDuration: number;
    includeWeekends: boolean;
  };
  newLeads: {
    sourceDistribution: Record<string, number>;   // Lead source probabilities
    industryDistribution: Record<string, number>; // Industry probabilities
    scoreRange: { min: number; max: number };
    revenueRange: { min: number; max: number };
  };
}

export class UpdaterConfig {
  // Target configuration
  public readonly targetTenantId = '550e8400-e29b-41d4-a716-446655440000';
  public readonly targetCustomerId = 'cust-1';

  // Schedule configuration (CRON expressions)
  public scheduleConfig: ScheduleConfig = {
    businessActivities: '0 */2 9-17 * * 1-5', // Every 2 hours, 9 AM - 5 PM, Mon-Fri
    serviceTickets: '0 0 */6 * * *',           // Every 6 hours
    newLeads: '0 0 10 * * 1-5',               // Daily at 10 AM, Mon-Fri
  };

  // Database configuration
  public databaseConfig: DatabaseConfig = {
    connectionPool: {
      min: 2,
      max: 10,
      acquireTimeoutMillis: 30000,
      idleTimeoutMillis: 600000,
    },
    transactionTimeout: 30000,
    retryAttempts: 3,
    retryDelay: 1000,
  };

  // Data generation configuration
  public dataGenerationConfig: DataGenerationConfig = {
    businessActivities: {
      typesDistribution: {
        'call': 0.35,
        'email': 0.25,
        'meeting': 0.15,
        'demo': 0.10,
        'proposal': 0.05,
        'task': 0.05,
        'note': 0.05,
      },
      minDurationMinutes: 5,
      maxDurationMinutes: 120,
      businessHoursOnly: true,
    },
    serviceTickets: {
      priorityDistribution: {
        'low': 0.40,
        'medium': 0.35,
        'high': 0.20,
        'urgent': 0.05,
      },
      statusDistribution: {
        'open': 0.30,
        'assigned': 0.25,
        'in-progress': 0.25,
        'completed': 0.20,
      },
      minEstimatedDuration: 30,
      maxEstimatedDuration: 480, // 8 hours max
      includeWeekends: false,
    },
    newLeads: {
      sourceDistribution: {
        'website': 0.30,
        'referral': 0.25,
        'cold_call': 0.15,
        'trade_show': 0.10,
        'social_media': 0.10,
        'advertisement': 0.05,
        'partner': 0.05,
      },
      industryDistribution: {
        'healthcare': 0.20,
        'legal': 0.15,
        'education': 0.15,
        'manufacturing': 0.12,
        'retail': 0.10,
        'professional_services': 0.10,
        'government': 0.08,
        'non_profit': 0.05,
        'real_estate': 0.05,
      },
      scoreRange: { min: 10, max: 95 },
      revenueRange: { min: 100000, max: 10000000 },
    },
  };

  // Execution configuration
  public executionConfig = {
    enabledUpdaters: {
      businessActivities: true,
      serviceTickets: true,
      newLeads: true,
    },
    maxConcurrentExecutions: 3,
    executionTimeoutMinutes: 15,
    enableMetrics: true,
    enableAlerts: true,
  };

  // Timezone configuration
  public timezoneConfig = {
    timezone: 'America/New_York',
    businessHours: {
      start: 9,  // 9 AM
      end: 17,   // 5 PM
    },
    businessDays: [1, 2, 3, 4, 5], // Monday to Friday
  };

  constructor(overrides?: Partial<UpdaterConfig>) {
    if (overrides) {
      this.update(overrides);
    }
  }

  /**
   * Update configuration with new values
   */
  update(updates: Partial<UpdaterConfig>): void {
    if (updates.scheduleConfig) {
      this.scheduleConfig = { ...this.scheduleConfig, ...updates.scheduleConfig };
    }
    if (updates.databaseConfig) {
      this.databaseConfig = { ...this.databaseConfig, ...updates.databaseConfig };
    }
    if (updates.dataGenerationConfig) {
      this.dataGenerationConfig = this.mergeDeep(this.dataGenerationConfig, updates.dataGenerationConfig);
    }
    if (updates.executionConfig) {
      this.executionConfig = { ...this.executionConfig, ...updates.executionConfig };
    }
    if (updates.timezoneConfig) {
      this.timezoneConfig = { ...this.timezoneConfig, ...updates.timezoneConfig };
    }
  }

  /**
   * Get all configuration values
   */
  getAll() {
    return {
      targetTenantId: this.targetTenantId,
      targetCustomerId: this.targetCustomerId,
      scheduleConfig: this.scheduleConfig,
      databaseConfig: this.databaseConfig,
      dataGenerationConfig: this.dataGenerationConfig,
      executionConfig: this.executionConfig,
      timezoneConfig: this.timezoneConfig,
    };
  }

  /**
   * Validate configuration values
   */
  validate(): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];

    // Validate tenant ID
    if (!this.targetTenantId || !this.isValidUuid(this.targetTenantId)) {
      errors.push('Invalid target tenant ID');
    }

    // Validate customer ID
    if (!this.targetCustomerId || this.targetCustomerId.trim() === '') {
      errors.push('Invalid target customer ID');
    }

    // Validate probability distributions sum to 1.0 (or close)
    const distributions = [
      this.dataGenerationConfig.businessActivities.typesDistribution,
      this.dataGenerationConfig.serviceTickets.priorityDistribution,
      this.dataGenerationConfig.serviceTickets.statusDistribution,
      this.dataGenerationConfig.newLeads.sourceDistribution,
      this.dataGenerationConfig.newLeads.industryDistribution,
    ];

    distributions.forEach((dist, index) => {
      const sum = Object.values(dist).reduce((acc, val) => acc + val, 0);
      if (Math.abs(sum - 1.0) > 0.01) {
        errors.push(`Distribution ${index} does not sum to 1.0 (sum: ${sum})`);
      }
    });

    // Validate ranges
    const { scoreRange, revenueRange } = this.dataGenerationConfig.newLeads;
    if (scoreRange.min >= scoreRange.max) {
      errors.push('Invalid score range: min must be less than max');
    }
    if (revenueRange.min >= revenueRange.max) {
      errors.push('Invalid revenue range: min must be less than max');
    }

    // Validate business hours
    const { businessHours } = this.timezoneConfig;
    if (businessHours.start >= businessHours.end || businessHours.start < 0 || businessHours.end > 24) {
      errors.push('Invalid business hours configuration');
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  }

  /**
   * Check if current time is within business hours
   */
  isBusinessHours(date: Date = new Date()): boolean {
    const day = date.getDay(); // 0 = Sunday, 1 = Monday, etc.
    const hour = date.getHours();

    const isBusinessDay = this.timezoneConfig.businessDays.includes(day);
    const isBusinessHour = hour >= this.timezoneConfig.businessHours.start && 
                          hour < this.timezoneConfig.businessHours.end;

    return isBusinessDay && isBusinessHour;
  }

  /**
   * Get configuration for a specific updater
   */
  getUpdaterConfig(updaterName: string) {
    switch (updaterName) {
      case 'business_record_activities':
        return {
          enabled: this.executionConfig.enabledUpdaters.businessActivities,
          schedule: this.scheduleConfig.businessActivities,
          dataConfig: this.dataGenerationConfig.businessActivities,
        };
      case 'service_tickets':
        return {
          enabled: this.executionConfig.enabledUpdaters.serviceTickets,
          schedule: this.scheduleConfig.serviceTickets,
          dataConfig: this.dataGenerationConfig.serviceTickets,
        };
      case 'business_records':
        return {
          enabled: this.executionConfig.enabledUpdaters.newLeads,
          schedule: this.scheduleConfig.newLeads,
          dataConfig: this.dataGenerationConfig.newLeads,
        };
      default:
        return null;
    }
  }

  /**
   * Deep merge helper function
   */
  private mergeDeep(target: any, source: any): any {
    const result = { ...target };
    
    for (const key in source) {
      if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key])) {
        result[key] = this.mergeDeep(target[key] || {}, source[key]);
      } else {
        result[key] = source[key];
      }
    }
    
    return result;
  }

  /**
   * Validate UUID format
   */
  private isValidUuid(uuid: string): boolean {
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    return uuidRegex.test(uuid);
  }
}

export default UpdaterConfig;
