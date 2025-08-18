/**
 * Updater Registry
 * Central registry for managing database table updaters
 */

import { BaseUpdater } from './BaseUpdater';
import { Logger } from './Logger';

export interface RegistryEntry {
  name: string;
  updater: BaseUpdater;
  registeredAt: Date;
  category?: string;
  description?: string;
}

export class UpdaterRegistry {
  private updaters = new Map<string, RegistryEntry>();
  private logger: Logger;

  constructor(logger: Logger) {
    this.logger = logger;
  }

  /**
   * Register a new updater
   */
  register(name: string, updater: BaseUpdater, options?: {
    category?: string;
    description?: string;
  }): void {
    if (this.updaters.has(name)) {
      this.logger.warn(`Updater ${name} is already registered. Replacing existing updater.`);
    }

    const entry: RegistryEntry = {
      name,
      updater,
      registeredAt: new Date(),
      category: options?.category,
      description: options?.description,
    };

    this.updaters.set(name, entry);
    
    this.logger.info(`Registered updater: ${name}`, {
      category: entry.category,
      description: entry.description,
      config: updater.getConfig(),
    });
  }

  /**
   * Unregister an updater
   */
  unregister(name: string): boolean {
    const entry = this.updaters.get(name);
    if (!entry) {
      this.logger.warn(`Updater ${name} not found in registry`);
      return false;
    }

    this.updaters.delete(name);
    this.logger.info(`Unregistered updater: ${name}`);
    return true;
  }

  /**
   * Get an updater by name
   */
  get(name: string): BaseUpdater | undefined {
    const entry = this.updaters.get(name);
    return entry?.updater;
  }

  /**
   * Get all registered updaters
   */
  getAll(): BaseUpdater[] {
    return Array.from(this.updaters.values()).map(entry => entry.updater);
  }

  /**
   * Get all updater names
   */
  getNames(): string[] {
    return Array.from(this.updaters.keys());
  }

  /**
   * Get registry entries with metadata
   */
  getEntries(): RegistryEntry[] {
    return Array.from(this.updaters.values());
  }

  /**
   * Get updaters by category
   */
  getByCategory(category: string): BaseUpdater[] {
    return Array.from(this.updaters.values())
      .filter(entry => entry.category === category)
      .map(entry => entry.updater);
  }

  /**
   * Check if updater exists
   */
  has(name: string): boolean {
    return this.updaters.has(name);
  }

  /**
   * Get number of registered updaters
   */
  getUpdaterCount(): number {
    return this.updaters.size;
  }

  /**
   * Get registry statistics
   */
  getStatistics() {
    const entries = Array.from(this.updaters.values());
    const categories = new Map<string, number>();
    const statusCounts = {
      enabled: 0,
      disabled: 0,
    };

    entries.forEach(entry => {
      // Count by category
      const category = entry.category || 'uncategorized';
      categories.set(category, (categories.get(category) || 0) + 1);

      // Count by status
      if (entry.updater.isEnabled()) {
        statusCounts.enabled++;
      } else {
        statusCounts.disabled++;
      }
    });

    return {
      totalUpdaters: this.updaters.size,
      categories: Object.fromEntries(categories),
      statusCounts,
      registrationDates: entries.map(entry => ({
        name: entry.name,
        registeredAt: entry.registeredAt,
      })),
    };
  }

  /**
   * Execute all enabled updaters
   */
  async executeAll(): Promise<Map<string, any>> {
    const results = new Map<string, any>();
    const enabledUpdaters = Array.from(this.updaters.values())
      .filter(entry => entry.updater.isEnabled());

    this.logger.info(`Executing ${enabledUpdaters.length} enabled updaters`);

    for (const entry of enabledUpdaters) {
      try {
        const result = await entry.updater.execute();
        results.set(entry.name, result);
        
        this.logger.info(`Executed updater: ${entry.name}`, {
          success: result.success,
          recordsUpdated: result.recordsUpdated,
        });
      } catch (error) {
        const errorResult = {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
          recordsUpdated: 0,
          executionTime: 0,
        };
        
        results.set(entry.name, errorResult);
        
        this.logger.error(`Failed to execute updater: ${entry.name}`, error);
      }
    }

    return results;
  }

  /**
   * Execute specific updaters by name
   */
  async executeSpecific(names: string[]): Promise<Map<string, any>> {
    const results = new Map<string, any>();

    this.logger.info(`Executing specific updaters: ${names.join(', ')}`);

    for (const name of names) {
      const entry = this.updaters.get(name);
      if (!entry) {
        const errorResult = {
          success: false,
          error: `Updater not found: ${name}`,
          recordsUpdated: 0,
          executionTime: 0,
        };
        results.set(name, errorResult);
        continue;
      }

      if (!entry.updater.isEnabled()) {
        const errorResult = {
          success: false,
          error: `Updater is disabled: ${name}`,
          recordsUpdated: 0,
          executionTime: 0,
        };
        results.set(name, errorResult);
        continue;
      }

      try {
        const result = await entry.updater.execute();
        results.set(name, result);
        
        this.logger.info(`Executed updater: ${name}`, {
          success: result.success,
          recordsUpdated: result.recordsUpdated,
        });
      } catch (error) {
        const errorResult = {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
          recordsUpdated: 0,
          executionTime: 0,
        };
        
        results.set(name, errorResult);
        
        this.logger.error(`Failed to execute updater: ${name}`, error);
      }
    }

    return results;
  }

  /**
   * Validate all registered updaters
   */
  async validateAll(): Promise<Map<string, { isValid: boolean; errors: string[] }>> {
    const validationResults = new Map<string, { isValid: boolean; errors: string[] }>();

    this.logger.info('Validating all registered updaters');

    for (const entry of this.updaters.values()) {
      try {
        // Try to validate the updater configuration
        const config = entry.updater.getConfig();
        const errors: string[] = [];

        // Basic validation
        if (!config.tenantId) {
          errors.push('Missing tenant ID');
        }

        if (!config.name) {
          errors.push('Missing updater name');
        }

        // You can add more validation logic here based on your requirements

        validationResults.set(entry.name, {
          isValid: errors.length === 0,
          errors,
        });

        this.logger.debug(`Validated updater: ${entry.name}`, {
          isValid: errors.length === 0,
          errors,
        });
      } catch (error) {
        validationResults.set(entry.name, {
          isValid: false,
          errors: [error instanceof Error ? error.message : 'Validation failed'],
        });

        this.logger.error(`Validation failed for updater: ${entry.name}`, error);
      }
    }

    return validationResults;
  }

  /**
   * Get detailed status of all updaters
   */
  getDetailedStatus() {
    const entries = Array.from(this.updaters.values());
    
    return entries.map(entry => ({
      name: entry.name,
      category: entry.category,
      description: entry.description,
      registeredAt: entry.registeredAt,
      isEnabled: entry.updater.isEnabled(),
      config: entry.updater.getConfig(),
      metrics: entry.updater.getMetrics(),
      lastExecution: entry.updater.getLastExecution(),
    }));
  }

  /**
   * Enable/disable multiple updaters
   */
  setMultipleEnabled(names: string[], enabled: boolean): void {
    for (const name of names) {
      const entry = this.updaters.get(name);
      if (entry) {
        entry.updater.setEnabled(enabled);
        this.logger.info(`${enabled ? 'Enabled' : 'Disabled'} updater: ${name}`);
      } else {
        this.logger.warn(`Updater not found: ${name}`);
      }
    }
  }

  /**
   * Reset metrics for all updaters
   */
  resetAllMetrics(): void {
    for (const entry of this.updaters.values()) {
      entry.updater.resetMetrics();
    }
    
    this.logger.info('Reset metrics for all updaters');
  }

  /**
   * Clear the registry
   */
  clear(): void {
    const count = this.updaters.size;
    this.updaters.clear();
    this.logger.info(`Cleared registry: removed ${count} updaters`);
  }
}

export default UpdaterRegistry;
